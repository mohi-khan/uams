import { eq, and, ilike, isNull, count, desc, sql, or } from 'drizzle-orm'
import { db } from '../lib/db'
import { departments, departmentAuditLogs, faculties } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateDepartmentInput, UpdateDepartmentInput } from '../lib/validators/academic.validator'

export async function createDepartment(tenantId: string, performedBy: string, input: CreateDepartmentInput) {
  const code = input.code.toUpperCase()

  const [faculty] = await db
    .select({ id: faculties.id })
    .from(faculties)
    .where(and(eq(faculties.id, input.facultyId), eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)))
    .limit(1)

  if (!faculty) throw new Error('Faculty not found.')

  const [existing] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(
      eq(departments.tenantId, tenantId),
      eq(departments.facultyId, input.facultyId),
      eq(departments.code, code),
      isNull(departments.deletedAt),
    ))
    .limit(1)

  if (existing) throw new Error('A department with this code already exists in this faculty.')

  const [department] = await db.insert(departments).values({
    tenantId,
    facultyId:   input.facultyId,
    name:        input.name,
    code,
    description: input.description,
    createdBy:   performedBy,
    updatedBy:   performedBy,
  }).returning()

  await db.insert(departmentAuditLogs).values({
    tenantId,
    departmentId: department.id,
    action:       'CREATE',
    performedBy,
    snapshot:     department as any,
  })

  return department
}

export async function listDepartments(
  tenantId: string,
  page = 1,
  limit = 20,
  facultyId?: string,
  search?: string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(departments.tenantId, tenantId), isNull(departments.deletedAt)]
  if (facultyId) conditions.push(eq(departments.facultyId, facultyId))
  if (search) {
    conditions.push(or(ilike(departments.name, `%${search}%`), ilike(departments.code, `%${search}%`))!)
  }
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:          departments.id,
      facultyId:   departments.facultyId,
      facultyName: faculties.name,
      name:        departments.name,
      code:        departments.code,
      description: departments.description,
      isActive:    departments.isActive,
      createdAt:   departments.createdAt,
      updatedAt:   departments.updatedAt,
    })
    .from(departments)
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(where)
    .orderBy(departments.name)
    .limit(limit)
    .offset(offset),
    db.select({ total: count() }).from(departments).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getDepartmentById(tenantId: string, id: string) {
  const [dept] = await db
    .select({
      id:          departments.id,
      tenantId:    departments.tenantId,
      facultyId:   departments.facultyId,
      facultyName: faculties.name,
      name:        departments.name,
      code:        departments.code,
      description: departments.description,
      isActive:    departments.isActive,
      createdAt:   departments.createdAt,
      updatedAt:   departments.updatedAt,
    })
    .from(departments)
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId), isNull(departments.deletedAt)))
    .limit(1)

  if (!dept) throw new Error('Department not found.')
  return dept
}

export async function updateDepartment(tenantId: string, performedBy: string, id: string, input: UpdateDepartmentInput) {
  const [before] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId), isNull(departments.deletedAt)))
    .limit(1)

  if (!before) throw new Error('Department not found.')

  if (input.code) {
    const code = input.code.toUpperCase()
    if (code !== before.code) {
      const [dup] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(
          eq(departments.tenantId, tenantId),
          eq(departments.facultyId, before.facultyId),
          eq(departments.code, code),
          isNull(departments.deletedAt),
        ))
        .limit(1)
      if (dup) throw new Error('A department with this code already exists in this faculty.')
    }
  }

  const [after] = await db
    .update(departments)
    .set({
      ...(input.name        !== undefined && { name:        input.name }),
      ...(input.code        !== undefined && { code:        input.code.toUpperCase() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive    !== undefined && { isActive:    input.isActive }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))
    .returning()

  await db.insert(departmentAuditLogs).values({
    tenantId,
    departmentId: id,
    action:       'UPDATE',
    performedBy,
    snapshot:     { before, after } as any,
  })

  return after
}

export async function deleteDepartment(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId), isNull(departments.deletedAt)))
    .limit(1)

  if (!existing) throw new Error('Department not found.')

  await db
    .update(departments)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(departments.id, id), eq(departments.tenantId, tenantId)))

  await db.insert(departmentAuditLogs).values({
    tenantId,
    departmentId: id,
    action:       'DELETE',
    performedBy,
    snapshot:     existing as any,
  })

  return { message: 'Department deleted successfully.' }
}

export async function getDepartmentAuditLogs(tenantId: string, departmentId: string) {
  const [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
    .limit(1)

  if (!dept) throw new Error('Department not found.')

  return db
    .select({
      id:              departmentAuditLogs.id,
      action:          departmentAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        departmentAuditLogs.snapshot,
      createdAt:       departmentAuditLogs.createdAt,
    })
    .from(departmentAuditLogs)
    .leftJoin(users, eq(departmentAuditLogs.performedBy, users.id))
    .where(and(eq(departmentAuditLogs.tenantId, tenantId), eq(departmentAuditLogs.departmentId, departmentId)))
    .orderBy(desc(departmentAuditLogs.createdAt))
}
