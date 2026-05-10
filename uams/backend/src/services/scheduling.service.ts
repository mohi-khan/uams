import { eq, and, isNull, count, desc, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import {
  semesterOfferings, semesterOfferingAuditLogs,
  courseOfferings,  courseOfferingAuditLogs,
} from '../db/schema/scheduling'
import { programs, academicSessions, courses, teachers, programCourses } from '../db/schema/academic'
import { batches } from '../db/schema/enrollment'
import { users } from '../db/schema/users'
import type {
  CreateSemesterOfferingInput, UpdateSemesterOfferingInput,
  CreateCourseOfferingInput,   UpdateCourseOfferingInput,
  BulkSaveCourseOfferingsInput,
} from '../lib/validators/scheduling.validator'

// ── Semester Offerings ────────────────────────────────────────────────────────

export async function listSemesterOfferings(
  tenantId: string,
  page = 1, limit = 50,
  opts: { programId?: string; sessionId?: string; semesterNo?: number; status?: string } = {},
) {
  const offset = (page - 1) * limit
  const conds: any[] = [eq(semesterOfferings.tenantId, tenantId), isNull(semesterOfferings.deletedAt)]
  if (opts.programId)  conds.push(eq(semesterOfferings.programId,  opts.programId))
  if (opts.sessionId)  conds.push(eq(semesterOfferings.sessionId,  opts.sessionId))
  if (opts.semesterNo) conds.push(eq(semesterOfferings.semesterNo, opts.semesterNo))
  if (opts.status)     conds.push(eq(semesterOfferings.status,     opts.status as any))
  const where = and(...conds)

  const courseCountSq = db
    .select({ semId: courseOfferings.semesterOfferingId, cnt: count().as('cnt') })
    .from(courseOfferings)
    .where(and(eq(courseOfferings.tenantId, tenantId), isNull(courseOfferings.deletedAt)))
    .groupBy(courseOfferings.semesterOfferingId)
    .as('course_counts')

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:           semesterOfferings.id,
      programId:    semesterOfferings.programId,
      programName:  programs.name,
      programCode:  programs.code,
      sessionId:    semesterOfferings.sessionId,
      sessionName:  academicSessions.name,
      semesterNo:   semesterOfferings.semesterNo,
      status:       semesterOfferings.status,
      startDate:    semesterOfferings.startDate,
      endDate:      semesterOfferings.endDate,
      courseCount:  sql<number>`coalesce(${courseCountSq.cnt}, 0)`,
      createdAt:    semesterOfferings.createdAt,
      updatedAt:    semesterOfferings.updatedAt,
    })
    .from(semesterOfferings)
    .innerJoin(programs,         eq(semesterOfferings.programId,  programs.id))
    .innerJoin(academicSessions, eq(semesterOfferings.sessionId,  academicSessions.id))
    .leftJoin(courseCountSq,     eq(semesterOfferings.id,         courseCountSq.semId))
    .where(where)
    .orderBy(desc(semesterOfferings.createdAt))
    .limit(limit).offset(offset),

    db.select({ total: count() }).from(semesterOfferings).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getSemesterOfferingById(tenantId: string, id: string) {
  const [row] = await db.select({
    id:          semesterOfferings.id,
    programId:   semesterOfferings.programId,
    programName: programs.name,
    programCode: programs.code,
    durationSemesters: programs.durationSemesters,
    sessionId:   semesterOfferings.sessionId,
    sessionName: academicSessions.name,
    semesterNo:  semesterOfferings.semesterNo,
    status:      semesterOfferings.status,
    startDate:   semesterOfferings.startDate,
    endDate:     semesterOfferings.endDate,
    createdAt:   semesterOfferings.createdAt,
    updatedAt:   semesterOfferings.updatedAt,
  })
  .from(semesterOfferings)
  .innerJoin(programs,         eq(semesterOfferings.programId,  programs.id))
  .innerJoin(academicSessions, eq(semesterOfferings.sessionId,  academicSessions.id))
  .where(and(eq(semesterOfferings.id, id), eq(semesterOfferings.tenantId, tenantId), isNull(semesterOfferings.deletedAt)))
  .limit(1)

  if (!row) throw new Error('Semester offering not found.')
  return row
}

export async function createSemesterOffering(
  tenantId: string, performedBy: string, input: CreateSemesterOfferingInput,
) {
  const [dup] = await db
    .select({ id: semesterOfferings.id })
    .from(semesterOfferings)
    .where(and(
      eq(semesterOfferings.tenantId,   tenantId),
      eq(semesterOfferings.programId,  input.programId),
      eq(semesterOfferings.sessionId,  input.sessionId),
      eq(semesterOfferings.semesterNo, input.semesterNo),
      isNull(semesterOfferings.deletedAt),
    ))
    .limit(1)
  if (dup) throw new Error('A semester offering already exists for this program, session, and semester number.')

  const [row] = await db.insert(semesterOfferings).values({
    tenantId,
    programId:   input.programId,
    sessionId:   input.sessionId,
    semesterNo:  input.semesterNo,
    status:      input.status,
    startDate:   input.startDate ?? null,
    endDate:     input.endDate   ?? null,
    createdBy:   performedBy,
    updatedBy:   performedBy,
  }).returning()

  await db.insert(semesterOfferingAuditLogs).values({
    tenantId, semesterOfferingId: row.id, action: 'CREATE', performedBy, snapshot: row as any,
  })

  return getSemesterOfferingById(tenantId, row.id)
}

export async function updateSemesterOffering(
  tenantId: string, performedBy: string, id: string, input: UpdateSemesterOfferingInput,
) {
  const [before] = await db
    .select()
    .from(semesterOfferings)
    .where(and(eq(semesterOfferings.id, id), eq(semesterOfferings.tenantId, tenantId), isNull(semesterOfferings.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Semester offering not found.')

  const [after] = await db.update(semesterOfferings)
    .set({
      ...(input.status    !== undefined && { status:    input.status }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate   !== undefined && { endDate:   input.endDate }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(semesterOfferings.id, id), eq(semesterOfferings.tenantId, tenantId)))
    .returning()

  await db.insert(semesterOfferingAuditLogs).values({
    tenantId, semesterOfferingId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return getSemesterOfferingById(tenantId, id)
}

export async function deleteSemesterOffering(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(semesterOfferings)
    .where(and(eq(semesterOfferings.id, id), eq(semesterOfferings.tenantId, tenantId), isNull(semesterOfferings.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Semester offering not found.')

  await db.update(semesterOfferings)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(semesterOfferings.id, id), eq(semesterOfferings.tenantId, tenantId)))

  await db.insert(semesterOfferingAuditLogs).values({
    tenantId, semesterOfferingId: id, action: 'DELETE', performedBy, snapshot: existing as any,
  })
}

export async function getSemesterOfferingAuditLogs(tenantId: string, semesterOfferingId: string) {
  return db
    .select({
      id:              semesterOfferingAuditLogs.id,
      action:          semesterOfferingAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName},' ',${users.lastName}),'System')`,
      snapshot:        semesterOfferingAuditLogs.snapshot,
      createdAt:       semesterOfferingAuditLogs.createdAt,
    })
    .from(semesterOfferingAuditLogs)
    .leftJoin(users, eq(semesterOfferingAuditLogs.performedBy, users.id))
    .where(and(
      eq(semesterOfferingAuditLogs.tenantId,           tenantId),
      eq(semesterOfferingAuditLogs.semesterOfferingId, semesterOfferingId),
    ))
    .orderBy(desc(semesterOfferingAuditLogs.createdAt))
}

// ── Course Offerings ──────────────────────────────────────────────────────────

export async function listCourseOfferings(tenantId: string, semesterOfferingId: string) {
  return db.select({
    id:                 courseOfferings.id,
    semesterOfferingId: courseOfferings.semesterOfferingId,
    courseId:           courseOfferings.courseId,
    courseCode:         courses.code,
    courseTitle:        courses.title,
    credits:            courses.credits,
    courseType:         courses.type,
    batchId:            courseOfferings.batchId,
    batchName:          batches.name,
    batchCode:          batches.code,
    capacity:           courseOfferings.capacity,
    teacherId:          courseOfferings.teacherId,
    teacherName:        teachers.name,
    scheduleInfo:       courseOfferings.scheduleInfo,
    createdAt:          courseOfferings.createdAt,
    updatedAt:          courseOfferings.updatedAt,
  })
  .from(courseOfferings)
  .innerJoin(courses,  eq(courseOfferings.courseId,  courses.id))
  .leftJoin(teachers,  eq(courseOfferings.teacherId, teachers.id))
  .leftJoin(batches,   eq(courseOfferings.batchId,   batches.id))
  .where(and(
    eq(courseOfferings.tenantId,           tenantId),
    eq(courseOfferings.semesterOfferingId, semesterOfferingId),
    isNull(courseOfferings.deletedAt),
  ))
  .orderBy(courses.code)
}

export async function getAvailableCourses(tenantId: string, semesterOfferingId: string) {
  const [semOff] = await db
    .select({ programId: semesterOfferings.programId, semesterNo: semesterOfferings.semesterNo })
    .from(semesterOfferings)
    .where(and(eq(semesterOfferings.id, semesterOfferingId), eq(semesterOfferings.tenantId, tenantId)))
    .limit(1)
  if (!semOff) throw new Error('Semester offering not found.')

  return db.select({
    programCourseId: programCourses.id,
    courseId:        courses.id,
    courseCode:      courses.code,
    courseTitle:     courses.title,
    credits:         courses.credits,
    courseType:      courses.type,
    semesterNo:      programCourses.semesterNo,
    isMandatory:     programCourses.isMandatory,
  })
  .from(programCourses)
  .innerJoin(courses, eq(programCourses.courseId, courses.id))
  .where(and(
    eq(programCourses.tenantId,  tenantId),
    eq(programCourses.programId, semOff.programId),
    eq(programCourses.semesterNo, semOff.semesterNo),
    isNull(courses.deletedAt),
  ))
  .orderBy(courses.code)
}

async function getCourseOfferingById(tenantId: string, id: string) {
  const [row] = await db.select({
    id:                 courseOfferings.id,
    semesterOfferingId: courseOfferings.semesterOfferingId,
    courseId:           courseOfferings.courseId,
    courseCode:         courses.code,
    courseTitle:        courses.title,
    credits:            courses.credits,
    courseType:         courses.type,
    batchId:            courseOfferings.batchId,
    batchName:          batches.name,
    batchCode:          batches.code,
    capacity:           courseOfferings.capacity,
    teacherId:          courseOfferings.teacherId,
    teacherName:        teachers.name,
    scheduleInfo:       courseOfferings.scheduleInfo,
    createdAt:          courseOfferings.createdAt,
    updatedAt:          courseOfferings.updatedAt,
  })
  .from(courseOfferings)
  .innerJoin(courses,  eq(courseOfferings.courseId,  courses.id))
  .leftJoin(teachers,  eq(courseOfferings.teacherId, teachers.id))
  .leftJoin(batches,   eq(courseOfferings.batchId,   batches.id))
  .where(and(eq(courseOfferings.id, id), eq(courseOfferings.tenantId, tenantId), isNull(courseOfferings.deletedAt)))
  .limit(1)

  if (!row) throw new Error('Course offering not found.')
  return row
}

export async function createCourseOffering(
  tenantId: string, performedBy: string, input: CreateCourseOfferingInput,
) {
  const [dup] = await db
    .select({ id: courseOfferings.id })
    .from(courseOfferings)
    .where(and(
      eq(courseOfferings.tenantId,           tenantId),
      eq(courseOfferings.semesterOfferingId, input.semesterOfferingId),
      eq(courseOfferings.courseId,           input.courseId),
      input.batchId != null
        ? eq(courseOfferings.batchId, input.batchId)
        : isNull(courseOfferings.batchId),
      isNull(courseOfferings.deletedAt),
    ))
    .limit(1)
  if (dup) throw new Error('A course offering already exists for this course and section.')

  const [row] = await db.insert(courseOfferings).values({
    tenantId,
    semesterOfferingId: input.semesterOfferingId,
    courseId:           input.courseId,
    batchId:            input.batchId      ?? null,
    capacity:           input.capacity     ?? null,
    teacherId:          input.teacherId    ?? null,
    scheduleInfo:       input.scheduleInfo ?? null,
    createdBy:          performedBy,
    updatedBy:          performedBy,
  }).returning()

  await db.insert(courseOfferingAuditLogs).values({
    tenantId, courseOfferingId: row.id, action: 'CREATE', performedBy, snapshot: row as any,
  })

  return getCourseOfferingById(tenantId, row.id)
}

export async function updateCourseOffering(
  tenantId: string, performedBy: string, id: string, input: UpdateCourseOfferingInput,
) {
  const [before] = await db
    .select()
    .from(courseOfferings)
    .where(and(eq(courseOfferings.id, id), eq(courseOfferings.tenantId, tenantId), isNull(courseOfferings.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Course offering not found.')

  const [after] = await db.update(courseOfferings)
    .set({
      ...(input.batchId      !== undefined && { batchId:      input.batchId }),
      ...(input.capacity     !== undefined && { capacity:     input.capacity }),
      ...(input.teacherId    !== undefined && { teacherId:    input.teacherId }),
      ...(input.scheduleInfo !== undefined && { scheduleInfo: input.scheduleInfo }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(courseOfferings.id, id), eq(courseOfferings.tenantId, tenantId)))
    .returning()

  await db.insert(courseOfferingAuditLogs).values({
    tenantId, courseOfferingId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return getCourseOfferingById(tenantId, id)
}

export async function deleteCourseOffering(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(courseOfferings)
    .where(and(eq(courseOfferings.id, id), eq(courseOfferings.tenantId, tenantId), isNull(courseOfferings.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Course offering not found.')

  await db.update(courseOfferings)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseOfferings.id, id), eq(courseOfferings.tenantId, tenantId)))

  await db.insert(courseOfferingAuditLogs).values({
    tenantId, courseOfferingId: id, action: 'DELETE', performedBy, snapshot: existing as any,
  })
}

export async function bulkSaveCourseOfferings(
  tenantId: string, performedBy: string, input: BulkSaveCourseOfferingsInput,
) {
  const existing = await db
    .select({ id: courseOfferings.id, courseId: courseOfferings.courseId, batchId: courseOfferings.batchId })
    .from(courseOfferings)
    .where(and(
      eq(courseOfferings.tenantId,           tenantId),
      eq(courseOfferings.semesterOfferingId, input.semesterOfferingId),
      isNull(courseOfferings.deletedAt),
    ))

  const existingMap = new Map(existing.map(o => [`${o.courseId}::${o.batchId ?? 'null'}`, o.id]))

  for (const c of input.courses) {
    const key        = `${c.courseId}::${c.batchId ?? 'null'}`
    const existingId = existingMap.get(key)

    if (existingId) {
      await updateCourseOffering(tenantId, performedBy, existingId, {
        batchId:      c.batchId,
        capacity:     c.capacity,
        teacherId:    c.teacherId,
        scheduleInfo: c.scheduleInfo,
      })
    } else {
      await createCourseOffering(tenantId, performedBy, {
        semesterOfferingId: input.semesterOfferingId,
        courseId:           c.courseId,
        batchId:            c.batchId,
        capacity:           c.capacity,
        teacherId:          c.teacherId,
        scheduleInfo:       c.scheduleInfo,
      })
    }
  }

  return listCourseOfferings(tenantId, input.semesterOfferingId)
}

export async function getCourseOfferingAuditLogs(tenantId: string, courseOfferingId: string) {
  return db
    .select({
      id:              courseOfferingAuditLogs.id,
      action:          courseOfferingAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName},' ',${users.lastName}),'System')`,
      snapshot:        courseOfferingAuditLogs.snapshot,
      createdAt:       courseOfferingAuditLogs.createdAt,
    })
    .from(courseOfferingAuditLogs)
    .leftJoin(users, eq(courseOfferingAuditLogs.performedBy, users.id))
    .where(and(
      eq(courseOfferingAuditLogs.tenantId,         tenantId),
      eq(courseOfferingAuditLogs.courseOfferingId, courseOfferingId),
    ))
    .orderBy(desc(courseOfferingAuditLogs.createdAt))
}
