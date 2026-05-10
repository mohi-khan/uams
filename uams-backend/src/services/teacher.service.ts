import { eq, and, ilike, isNull, count, desc, sql, or, asc } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { redis } from '../lib/redis'
import { teachers, teacherAuditLogs, departments, faculties, courses, programs, academicSessions } from '../db/schema/academic'
import { semesterOfferings, courseOfferings } from '../db/schema/scheduling'
import { batches } from '../db/schema/enrollment'
import { users } from '../db/schema/users'
import { tenants } from '../db/schema/tenants'
import { sendTeacherInvitationEmail } from '../lib/email'
import type { CreateTeacherInput, UpdateTeacherInput } from '../lib/validators/academic.validator'

const INVITE_TTL = 60 * 60 * 24 // 24 hours

function splitName(name: string): { firstName: string; lastName: string } {
  const idx = name.indexOf(' ')
  if (idx === -1) return { firstName: name, lastName: '.' }
  return { firstName: name.slice(0, idx), lastName: name.slice(idx + 1) }
}

export async function createTeacher(tenantId: string, performedBy: string, input: CreateTeacherInput) {
  const [faculty] = await db
    .select({ id: faculties.id })
    .from(faculties)
    .where(and(eq(faculties.id, input.facultyId), eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)))
    .limit(1)
  if (!faculty) throw new Error('Faculty not found.')

  const [department] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(
      eq(departments.id, input.departmentId),
      eq(departments.tenantId, tenantId),
      eq(departments.facultyId, input.facultyId),
      isNull(departments.deletedAt),
    ))
    .limit(1)
  if (!department) throw new Error('Department not found in this faculty.')

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, input.email)))
    .limit(1)
  if (existingUser) throw new Error('A user with this email already exists in this institution.')

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const { firstName, lastName } = splitName(input.name)

  // Create inactive user account (teacher sets password via invitation link)
  const tempPasswordHash = await bcrypt.hash(randomBytes(16).toString('hex'), 10)

  const [user] = await db.insert(users).values({
    tenantId,
    email:        input.email,
    passwordHash: tempPasswordHash,
    firstName,
    lastName,
    role:         'teacher',
    authProvider: 'email',
    isActive:     false,
  }).returning()

  const [teacher] = await db.insert(teachers).values({
    tenantId,
    departmentId: input.departmentId,
    facultyId:    input.facultyId,
    userId:       user.id,
    name:         input.name,
    email:        input.email,
    phone:        input.phone,
    designation:  input.designation,
    joiningDate:  input.joiningDate,
    isActive:     false,
    createdBy:    performedBy,
    updatedBy:    performedBy,
  }).returning()

  await db.insert(teacherAuditLogs).values({
    tenantId,
    teacherId:   teacher.id,
    action:      'CREATE',
    performedBy,
    snapshot:    teacher as any,
  })

  // Generate invitation token and store in Redis
  const token = randomBytes(32).toString('hex')
  await redis.set(`invite:teacher:${token}`, teacher.id, 'EX', INVITE_TTL)

  await sendTeacherInvitationEmail(input.email, input.name, tenant?.name ?? 'UAMS', token)

  return teacher
}

export async function listTeachers(
  tenantId: string,
  page = 1,
  limit = 20,
  departmentId?: string,
  facultyId?: string,
  search?: string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(teachers.tenantId, tenantId), isNull(teachers.deletedAt)]
  if (departmentId) conditions.push(eq(teachers.departmentId, departmentId))
  if (facultyId)    conditions.push(eq(teachers.facultyId, facultyId))
  if (search) {
    conditions.push(or(
      ilike(teachers.name,  `%${search}%`),
      ilike(teachers.email, `%${search}%`),
    )!)
  }
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:             teachers.id,
      departmentId:   teachers.departmentId,
      departmentName: departments.name,
      facultyId:      teachers.facultyId,
      facultyName:    faculties.name,
      name:           teachers.name,
      email:          teachers.email,
      phone:          teachers.phone,
      designation:    teachers.designation,
      joiningDate:    teachers.joiningDate,
      isActive:       teachers.isActive,
      createdAt:      teachers.createdAt,
      updatedAt:      teachers.updatedAt,
    })
    .from(teachers)
    .leftJoin(departments, eq(teachers.departmentId, departments.id))
    .leftJoin(faculties,   eq(teachers.facultyId,    faculties.id))
    .where(where)
    .orderBy(teachers.name)
    .limit(limit)
    .offset(offset),
    db.select({ total: count() }).from(teachers).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getTeacherById(tenantId: string, id: string) {
  const [row] = await db
    .select({
      id:             teachers.id,
      tenantId:       teachers.tenantId,
      departmentId:   teachers.departmentId,
      departmentName: departments.name,
      facultyId:      teachers.facultyId,
      facultyName:    faculties.name,
      userId:         teachers.userId,
      name:           teachers.name,
      email:          teachers.email,
      phone:          teachers.phone,
      designation:    teachers.designation,
      joiningDate:    teachers.joiningDate,
      isActive:       teachers.isActive,
      createdAt:      teachers.createdAt,
      updatedAt:      teachers.updatedAt,
    })
    .from(teachers)
    .leftJoin(departments, eq(teachers.departmentId, departments.id))
    .leftJoin(faculties,   eq(teachers.facultyId,    faculties.id))
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId), isNull(teachers.deletedAt)))
    .limit(1)

  if (!row) throw new Error('Teacher not found.')
  return row
}

export async function updateTeacher(tenantId: string, performedBy: string, id: string, input: UpdateTeacherInput) {
  const [before] = await db
    .select()
    .from(teachers)
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId), isNull(teachers.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Teacher not found.')

  if (input.facultyId && input.facultyId !== before.facultyId) {
    const [f] = await db.select({ id: faculties.id }).from(faculties)
      .where(and(eq(faculties.id, input.facultyId), eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)))
      .limit(1)
    if (!f) throw new Error('Faculty not found.')
  }

  if (input.departmentId && input.departmentId !== before.departmentId) {
    const targetFaculty = input.facultyId ?? before.facultyId
    const [d] = await db.select({ id: departments.id }).from(departments)
      .where(and(
        eq(departments.id, input.departmentId),
        eq(departments.tenantId, tenantId),
        eq(departments.facultyId, targetFaculty),
        isNull(departments.deletedAt),
      ))
      .limit(1)
    if (!d) throw new Error('Department not found in this faculty.')
  }

  const updateData: Record<string, unknown> = { updatedBy: performedBy, updatedAt: new Date() }
  if (input.name         !== undefined) updateData.name         = input.name
  if (input.phone        !== undefined) updateData.phone        = input.phone
  if (input.designation  !== undefined) updateData.designation  = input.designation
  if (input.joiningDate  !== undefined) updateData.joiningDate  = input.joiningDate
  if (input.departmentId !== undefined) updateData.departmentId = input.departmentId
  if (input.facultyId    !== undefined) updateData.facultyId    = input.facultyId

  if (input.isActive !== undefined && input.isActive !== before.isActive) {
    updateData.isActive = input.isActive
    await db.update(users)
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where(eq(users.id, before.userId))
  }

  const [after] = await db
    .update(teachers)
    .set(updateData as any)
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId)))
    .returning()

  await db.insert(teacherAuditLogs).values({
    tenantId,
    teacherId:   id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before, after } as any,
  })

  return after
}

export async function toggleTeacherStatus(tenantId: string, performedBy: string, id: string) {
  const [teacher] = await db
    .select()
    .from(teachers)
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId), isNull(teachers.deletedAt)))
    .limit(1)
  if (!teacher) throw new Error('Teacher not found.')

  const newStatus = !teacher.isActive

  const [after] = await db
    .update(teachers)
    .set({ isActive: newStatus, updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId)))
    .returning()

  await db.update(users)
    .set({ isActive: newStatus, updatedAt: new Date() })
    .where(eq(users.id, teacher.userId))

  await db.insert(teacherAuditLogs).values({
    tenantId,
    teacherId:   id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before: teacher, after } as any,
  })

  return after
}

export async function resendTeacherInvitation(tenantId: string, id: string) {
  const [teacher] = await db
    .select()
    .from(teachers)
    .where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId), isNull(teachers.deletedAt)))
    .limit(1)
  if (!teacher) throw new Error('Teacher not found.')

  const [user] = await db.select({ isActive: users.isActive }).from(users)
    .where(eq(users.id, teacher.userId)).limit(1)
  if (user?.isActive) throw new Error('Teacher has already activated their account.')

  const [tenant] = await db.select({ name: tenants.name }).from(tenants)
    .where(eq(tenants.id, tenantId)).limit(1)

  const token = randomBytes(32).toString('hex')
  await redis.set(`invite:teacher:${token}`, teacher.id, 'EX', INVITE_TTL)

  await sendTeacherInvitationEmail(teacher.email, teacher.name, tenant?.name ?? 'UAMS', token)

  return { message: 'Invitation resent.' }
}

export async function getTeacherAuditLogs(tenantId: string, teacherId: string) {
  const [t] = await db.select({ id: teachers.id }).from(teachers)
    .where(and(eq(teachers.id, teacherId), eq(teachers.tenantId, tenantId)))
    .limit(1)
  if (!t) throw new Error('Teacher not found.')

  return db
    .select({
      id:              teacherAuditLogs.id,
      action:          teacherAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        teacherAuditLogs.snapshot,
      createdAt:       teacherAuditLogs.createdAt,
    })
    .from(teacherAuditLogs)
    .leftJoin(users, eq(teacherAuditLogs.performedBy, users.id))
    .where(and(eq(teacherAuditLogs.tenantId, tenantId), eq(teacherAuditLogs.teacherId, teacherId)))
    .orderBy(desc(teacherAuditLogs.createdAt))
}

// ── Teacher self-service ──────────────────────────────────────────────────────

export async function getMyAssignedCourses(tenantId: string, userId: string) {
  const [teacher] = await db
    .select({ id: teachers.id, name: teachers.name, designation: teachers.designation })
    .from(teachers)
    .where(and(eq(teachers.userId, userId), eq(teachers.tenantId, tenantId), isNull(teachers.deletedAt)))
    .limit(1)

  if (!teacher) throw new Error('Teacher profile not found.')

  const rows = await db
    .select({
      courseOfferingId:   courseOfferings.id,
      courseId:           courseOfferings.courseId,
      courseCode:         courses.code,
      courseTitle:        courses.title,
      credits:            courses.credits,
      courseType:         courses.type,
      batchId:            courseOfferings.batchId,
      batchName:          batches.name,
      batchCode:          batches.code,
      capacity:           courseOfferings.capacity,
      scheduleInfo:       courseOfferings.scheduleInfo,
      semesterOfferingId: courseOfferings.semesterOfferingId,
      semesterNo:         semesterOfferings.semesterNo,
      semesterStatus:     semesterOfferings.status,
      semesterStartDate:  semesterOfferings.startDate,
      semesterEndDate:    semesterOfferings.endDate,
      programId:          semesterOfferings.programId,
      programName:        programs.name,
      programCode:        programs.code,
      sessionId:          semesterOfferings.sessionId,
      sessionName:        academicSessions.name,
    })
    .from(courseOfferings)
    .innerJoin(courses,           eq(courseOfferings.courseId,           courses.id))
    .innerJoin(semesterOfferings, eq(courseOfferings.semesterOfferingId, semesterOfferings.id))
    .innerJoin(programs,          eq(semesterOfferings.programId,        programs.id))
    .innerJoin(academicSessions,  eq(semesterOfferings.sessionId,        academicSessions.id))
    .leftJoin(batches,            eq(courseOfferings.batchId,            batches.id))
    .where(and(
      eq(courseOfferings.teacherId, teacher.id),
      eq(courseOfferings.tenantId,  tenantId),
      isNull(courseOfferings.deletedAt),
    ))
    .orderBy(asc(semesterOfferings.semesterNo), asc(courses.code))

  return { teacher, data: rows }
}
