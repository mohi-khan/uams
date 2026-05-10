import { eq, and, ilike, isNull, count, desc, sql, or } from 'drizzle-orm'
import { db } from '../lib/db'
import { courses, courseAuditLogs, departments, faculties } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateCourseInput, UpdateCourseInput } from '../lib/validators/academic.validator'

// Convert Drizzle numeric strings to numbers in the result
function toNum(row: any) {
  return {
    ...row,
    originalFee: Number(row.originalFee),
    retakeFee:   Number(row.retakeFee),
  }
}

export async function createCourse(tenantId: string, performedBy: string, input: CreateCourseInput) {
  const code = input.code.toUpperCase()

  // Verify department belongs to tenant
  const [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, input.departmentId), eq(departments.tenantId, tenantId), isNull(departments.deletedAt)))
    .limit(1)
  if (!dept) throw new Error('Department not found.')

  // Unique code per tenant
  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.tenantId, tenantId), eq(courses.code, code), isNull(courses.deletedAt)))
    .limit(1)
  if (existing) throw new Error('A course with this code already exists.')

  const [course] = await db.insert(courses).values({
    tenantId,
    departmentId: input.departmentId,
    code,
    title:       input.title,
    credits:     input.credits,
    type:        input.type,
    status:      input.status ?? 'active',
    originalFee: String(input.originalFee),
    retakeFee:   String(input.retakeFee),
    createdBy:   performedBy,
    updatedBy:   performedBy,
  }).returning()

  await db.insert(courseAuditLogs).values({
    tenantId,
    courseId:    course.id,
    action:      'CREATE',
    performedBy,
    snapshot:    toNum(course) as any,
  })

  return toNum(course)
}

export async function listCourses(
  tenantId: string,
  page = 1,
  limit = 20,
  departmentId?: string,
  search?: string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(courses.tenantId, tenantId), isNull(courses.deletedAt)]
  if (departmentId) conditions.push(eq(courses.departmentId, departmentId))
  if (search) {
    conditions.push(or(
      ilike(courses.code,  `%${search}%`),
      ilike(courses.title, `%${search}%`),
    )!)
  }
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:             courses.id,
      departmentId:   courses.departmentId,
      departmentName: departments.name,
      facultyName:    faculties.name,
      code:           courses.code,
      title:          courses.title,
      credits:        courses.credits,
      type:           courses.type,
      status:         courses.status,
      originalFee:    courses.originalFee,
      retakeFee:      courses.retakeFee,
      createdAt:      courses.createdAt,
      updatedAt:      courses.updatedAt,
    })
    .from(courses)
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(where)
    .orderBy(courses.code)
    .limit(limit)
    .offset(offset),
    db.select({ total: count() }).from(courses).where(where),
  ])

  return { data: rows.map(toNum), total: Number(total), page, limit }
}

export async function getCourseById(tenantId: string, id: string) {
  const [course] = await db
    .select({
      id:             courses.id,
      tenantId:       courses.tenantId,
      departmentId:   courses.departmentId,
      departmentName: departments.name,
      facultyName:    faculties.name,
      code:           courses.code,
      title:          courses.title,
      credits:        courses.credits,
      type:           courses.type,
      status:         courses.status,
      originalFee:    courses.originalFee,
      retakeFee:      courses.retakeFee,
      createdAt:      courses.createdAt,
      updatedAt:      courses.updatedAt,
    })
    .from(courses)
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)

  if (!course) throw new Error('Course not found.')
  return toNum(course)
}

export async function updateCourse(tenantId: string, performedBy: string, id: string, input: UpdateCourseInput) {
  const [before] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Course not found.')

  if (input.code) {
    const code = input.code.toUpperCase()
    if (code !== before.code) {
      const [dup] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.tenantId, tenantId), eq(courses.code, code), isNull(courses.deletedAt)))
        .limit(1)
      if (dup) throw new Error('A course with this code already exists.')
    }
  }

  if (input.departmentId && input.departmentId !== before.departmentId) {
    const [dept] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, input.departmentId), eq(departments.tenantId, tenantId), isNull(departments.deletedAt)))
      .limit(1)
    if (!dept) throw new Error('Department not found.')
  }

  const [after] = await db
    .update(courses)
    .set({
      ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
      ...(input.code         !== undefined && { code:         input.code.toUpperCase() }),
      ...(input.title        !== undefined && { title:        input.title }),
      ...(input.credits      !== undefined && { credits:      input.credits }),
      ...(input.type         !== undefined && { type:         input.type }),
      ...(input.status       !== undefined && { status:       input.status }),
      ...(input.originalFee  !== undefined && { originalFee:  String(input.originalFee) }),
      ...(input.retakeFee    !== undefined && { retakeFee:    String(input.retakeFee) }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId)))
    .returning()

  await db.insert(courseAuditLogs).values({
    tenantId,
    courseId:    id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before: toNum(before), after: toNum(after) } as any,
  })

  return toNum(after)
}

export async function deleteCourse(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Course not found.')

  await db
    .update(courses)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId)))

  await db.insert(courseAuditLogs).values({
    tenantId,
    courseId:    id,
    action:      'DELETE',
    performedBy,
    snapshot:    toNum(existing) as any,
  })

  return { message: 'Course deleted successfully.' }
}

export async function getCourseAuditLogs(tenantId: string, courseId: string) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  return db
    .select({
      id:              courseAuditLogs.id,
      action:          courseAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        courseAuditLogs.snapshot,
      createdAt:       courseAuditLogs.createdAt,
    })
    .from(courseAuditLogs)
    .leftJoin(users, eq(courseAuditLogs.performedBy, users.id))
    .where(and(eq(courseAuditLogs.tenantId, tenantId), eq(courseAuditLogs.courseId, courseId)))
    .orderBy(desc(courseAuditLogs.createdAt))
}
