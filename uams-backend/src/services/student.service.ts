import { eq, and, ilike, isNull, count, desc, sql, or } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { students, studentAuditLogs, studentNidRevealLogs } from '../db/schema/enrollment'
import { users } from '../db/schema/users'
import { getPhotoUploadUrl } from '../lib/s3'
import type { CreateStudentInput, UpdateStudentInput, PhotoUploadInput } from '../lib/validators/enrollment.validator'

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

// Returns last-4 visible, everything else replaced with bullet characters.
function maskNid(nid: string): string {
  if (nid.length <= 4) return '•'.repeat(nid.length)
  return '•'.repeat(nid.length - 4) + nid.slice(-4)
}

function maskRow<T extends { nidBirthReg: string | null }>(row: T): T {
  return { ...row, nidBirthReg: row.nidBirthReg ? maskNid(row.nidBirthReg) : null }
}

export async function getPhotoUploadSignedUrl(tenantId: string, input: PhotoUploadInput) {
  const ext = input.filename.split('.').pop() ?? 'jpg'
  const key = `tenants/${tenantId}/students/${randomUUID()}.${ext}`
  return getPhotoUploadUrl(key, input.contentType)
}

export async function createStudent(tenantId: string, performedBy: string, input: CreateStudentInput) {
  const [dupCode] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.studentCode, input.studentCode), isNull(students.deletedAt)))
    .limit(1)
  if (dupCode) throw new Error('Student code already exists.')

  const [dupEmail] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.email, input.email), isNull(students.deletedAt)))
    .limit(1)
  if (dupEmail) throw new Error('A student with this email already exists.')

  const [dupGmail] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.gmailAccount, input.gmailAccount), isNull(students.deletedAt)))
    .limit(1)
  if (dupGmail) throw new Error('A student with this Gmail account already exists.')

  const [dupUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, input.gmailAccount)))
    .limit(1)
  if (dupUser) throw new Error('A user account with this Gmail address already exists.')

  const student = await db.transaction(async (tx) => {
    const { firstName, lastName } = splitName(input.name)

    await tx.insert(users).values({
      tenantId,
      email:        input.gmailAccount,
      authProvider: 'google',
      role:         'student',
      firstName,
      lastName,
      status:       'active',
      isActive:     true,
    })

    const [row] = await tx.insert(students).values({
      tenantId,
      studentCode:    input.studentCode,
      name:           input.name,
      email:          input.email,
      gmailAccount:   input.gmailAccount,
      phone:          input.phone,
      address:        input.address,
      emergencyPhone: input.emergencyPhone,
      nidBirthReg:    input.nidBirthReg,
      photoUrl:       input.photoUrl,
      createdBy:      performedBy,
      updatedBy:      performedBy,
    }).returning()

    await tx.insert(studentAuditLogs).values({
      tenantId,
      studentId:   row.id,
      action:      'CREATE',
      performedBy,
      snapshot:    row as any,
    })

    return row
  })

  return student
}

export async function listStudents(
  tenantId: string,
  page  = 1,
  limit = 20,
  search?: string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(students.tenantId, tenantId), isNull(students.deletedAt)]
  if (search) {
    conditions.push(or(
      ilike(students.name,        `%${search}%`),
      ilike(students.studentCode, `%${search}%`),
      ilike(students.email,       `%${search}%`),
    )!)
  }
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(students).where(where)
      .orderBy(desc(students.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(students).where(where),
  ])

  return { data: rows.map(maskRow), total: Number(total), page, limit }
}

export async function getStudentById(tenantId: string, id: string) {
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.tenantId, tenantId), isNull(students.deletedAt)))
    .limit(1)

  if (!student) throw new Error('Student not found.')
  return maskRow(student)
}

export async function getStudentByGmail(tenantId: string, gmailAccount: string) {
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.gmailAccount, gmailAccount), eq(students.tenantId, tenantId), isNull(students.deletedAt)))
    .limit(1)

  if (!student) throw new Error('Student record not found.')
  return maskRow(student)
}

export async function updateStudent(
  tenantId: string,
  performedBy: string,
  id: string,
  input: UpdateStudentInput,
) {
  const [before] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.tenantId, tenantId), isNull(students.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Student not found.')

  if (input.studentCode && input.studentCode !== before.studentCode) {
    const [dup] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.studentCode, input.studentCode), isNull(students.deletedAt)))
      .limit(1)
    if (dup) throw new Error('Student code already exists.')
  }

  if (input.gmailAccount && input.gmailAccount !== before.gmailAccount) {
    const [dup] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.gmailAccount, input.gmailAccount), isNull(students.deletedAt)))
      .limit(1)
    if (dup) throw new Error('A student with this Gmail account already exists.')
  }

  const after = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(students)
      .set({
        ...(input.studentCode    !== undefined && { studentCode:    input.studentCode }),
        ...(input.name           !== undefined && { name:           input.name }),
        ...(input.gmailAccount   !== undefined && { gmailAccount:   input.gmailAccount }),
        ...(input.phone          !== undefined && { phone:          input.phone }),
        ...(input.address        !== undefined && { address:        input.address }),
        ...(input.emergencyPhone !== undefined && { emergencyPhone: input.emergencyPhone }),
        ...(input.nidBirthReg    !== undefined && { nidBirthReg:    input.nidBirthReg }),
        ...(input.photoUrl       !== undefined && { photoUrl:       input.photoUrl }),
        ...(input.isActive       !== undefined && { isActive:       input.isActive }),
        updatedBy: performedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, id), eq(students.tenantId, tenantId)))
      .returning()

    // Keep linked user account email in sync
    if (input.gmailAccount && before.gmailAccount && input.gmailAccount !== before.gmailAccount) {
      await tx.update(users)
        .set({ email: input.gmailAccount, updatedAt: new Date() })
        .where(and(eq(users.tenantId, tenantId), eq(users.email, before.gmailAccount)))
    }

    if (input.name !== undefined) {
      const { firstName, lastName } = splitName(input.name)
      const gmailForLookup = input.gmailAccount ?? before.gmailAccount
      if (gmailForLookup) {
        await tx.update(users)
          .set({ firstName, lastName, updatedAt: new Date() })
          .where(and(eq(users.tenantId, tenantId), eq(users.email, gmailForLookup)))
      }
    }

    await tx.insert(studentAuditLogs).values({
      tenantId,
      studentId:   id,
      action:      'UPDATE',
      performedBy,
      snapshot:    { before, after: row } as any,
    })

    return row
  })

  return after
}

export async function deleteStudent(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.tenantId, tenantId), isNull(students.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Student not found.')

  await db
    .update(students)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(students.id, id), eq(students.tenantId, tenantId)))

  await db.insert(studentAuditLogs).values({
    tenantId,
    studentId:   id,
    action:      'DELETE',
    performedBy,
    snapshot:    existing as any,
  })

  return { message: 'Student deleted successfully.' }
}

export async function revealStudentNid(
  tenantId: string,
  performedBy: string,
  studentId: string,
  password: string,
): Promise<string> {
  const [student] = await db
    .select({ nidBirthReg: students.nidBirthReg })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), isNull(students.deletedAt)))
    .limit(1)
  if (!student) throw new Error('Student not found.')
  if (!student.nidBirthReg) throw new Error('No NID/Birth Reg on record for this student.')

  const [actor] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, performedBy))
    .limit(1)
  if (!actor?.passwordHash) throw new Error('Incorrect password.')

  const valid = await bcrypt.compare(password, actor.passwordHash)
  if (!valid) throw new Error('Incorrect password.')

  await db.insert(studentNidRevealLogs).values({ tenantId, studentId, performedBy })

  return student.nidBirthReg
}

export async function getStudentAuditLogs(tenantId: string, studentId: string) {
  const [s] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId)))
    .limit(1)
  if (!s) throw new Error('Student not found.')

  return db
    .select({
      id:              studentAuditLogs.id,
      action:          studentAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        studentAuditLogs.snapshot,
      createdAt:       studentAuditLogs.createdAt,
    })
    .from(studentAuditLogs)
    .leftJoin(users, eq(studentAuditLogs.performedBy, users.id))
    .where(and(eq(studentAuditLogs.tenantId, tenantId), eq(studentAuditLogs.studentId, studentId)))
    .orderBy(desc(studentAuditLogs.createdAt))
}

// ── Student self-service: all enrolled course offerings ───────────────────────

export async function getStudentCourses(tenantId: string, userId: string) {
  const result = await db.execute(sql`
    SELECT
      co.id                                       AS offering_id,
      c.id                                        AS course_id,
      c.code                                      AS course_code,
      c.title                                     AS course_title,
      c.credits,
      c.type                                      AS course_type,
      so.semester_no,
      so.status                                   AS semester_status,
      so.start_date::text                         AS semester_start_date,
      so.end_date::text                           AS semester_end_date,
      p.name                                      AS program_name,
      p.code                                      AS program_code,
      sess.name                                   AS session_name,
      b.id                                        AS batch_id,
      b.name                                      AS batch_name,
      b.code                                      AS batch_code,
      u.first_name || ' ' || u.last_name          AS teacher_name,
      EXISTS (
        SELECT 1 FROM class_schedules cs
        WHERE  cs.course_offering_id = co.id
          AND  cs.deleted_at IS NULL
      )                                           AS has_schedule
    FROM   course_offerings  co
    JOIN   courses            c    ON c.id    = co.course_id
    JOIN   semester_offerings so   ON so.id   = co.semester_offering_id
    JOIN   programs           p    ON p.id    = so.program_id
    JOIN   academic_sessions  sess ON sess.id  = so.session_id
    LEFT JOIN batches          b   ON b.id    = co.batch_id
    LEFT JOIN teachers         t   ON t.id    = co.teacher_id
    LEFT JOIN users            u   ON u.id    = t.user_id
    WHERE  co.tenant_id   = ${tenantId}
      AND  co.deleted_at IS NULL
      AND  co.batch_id   IN (
             SELECT se.batch_id
             FROM   student_enrollments se
             JOIN   students            s  ON s.id    = se.student_id
             JOIN   users              us  ON us.email = s.gmail_account
             WHERE  us.id        = ${userId}::uuid
               AND  se.tenant_id = ${tenantId}
               AND  se.deleted_at IS NULL
               AND  se.batch_id IS NOT NULL
           )
    ORDER BY so.status, c.code
  `)
  return result.rows as Array<{
    offering_id:         string
    course_id:           string
    course_code:         string
    course_title:        string
    credits:             number
    course_type:         string
    semester_no:         number
    semester_status:     string
    semester_start_date: string | null
    semester_end_date:   string | null
    program_name:        string
    program_code:        string
    session_name:        string
    batch_id:            string | null
    batch_name:          string | null
    batch_code:          string | null
    teacher_name:        string | null
    has_schedule:        boolean
  }>
}
