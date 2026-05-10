import { eq, and, ilike, isNull, count, desc, sql, or } from 'drizzle-orm'
import { db } from '../lib/db'
import { faculties, facultyAuditLogs } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateFacultyInput, UpdateFacultyInput } from '../lib/validators/academic.validator'

export async function createFaculty(tenantId: string, performedBy: string, input: CreateFacultyInput) {
  const code = input.code.toUpperCase()

  const [existing] = await db
    .select({ id: faculties.id })
    .from(faculties)
    .where(and(eq(faculties.tenantId, tenantId), eq(faculties.code, code), isNull(faculties.deletedAt)))
    .limit(1)

  if (existing) throw new Error('A faculty with this code already exists.')

  const [faculty] = await db.insert(faculties).values({
    tenantId,
    name:        input.name,
    code,
    description: input.description,
    createdBy:   performedBy,
    updatedBy:   performedBy,
  }).returning()

  await db.insert(facultyAuditLogs).values({
    tenantId,
    facultyId:   faculty.id,
    action:      'CREATE',
    performedBy,
    snapshot:    faculty as any,
  })

  return faculty
}

export async function listFaculties(tenantId: string, page = 1, limit = 20, search?: string) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)]
  if (search) {
    conditions.push(or(ilike(faculties.name, `%${search}%`), ilike(faculties.code, `%${search}%`))!)
  }
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:          faculties.id,
      name:        faculties.name,
      code:        faculties.code,
      description: faculties.description,
      isActive:    faculties.isActive,
      createdAt:   faculties.createdAt,
      updatedAt:   faculties.updatedAt,
    }).from(faculties).where(where).orderBy(faculties.name).limit(limit).offset(offset),
    db.select({ total: count() }).from(faculties).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getFacultyById(tenantId: string, id: string) {
  const [faculty] = await db
    .select()
    .from(faculties)
    .where(and(eq(faculties.id, id), eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)))
    .limit(1)

  if (!faculty) throw new Error('Faculty not found.')
  return faculty
}

export async function updateFaculty(tenantId: string, performedBy: string, id: string, input: UpdateFacultyInput) {
  const [before] = await db
    .select()
    .from(faculties)
    .where(and(eq(faculties.id, id), eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)))
    .limit(1)

  if (!before) throw new Error('Faculty not found.')

  if (input.code) {
    const code = input.code.toUpperCase()
    if (code !== before.code) {
      const [dup] = await db
        .select({ id: faculties.id })
        .from(faculties)
        .where(and(eq(faculties.tenantId, tenantId), eq(faculties.code, code), isNull(faculties.deletedAt)))
        .limit(1)
      if (dup) throw new Error('A faculty with this code already exists.')
    }
  }

  const [after] = await db
    .update(faculties)
    .set({
      ...(input.name        !== undefined && { name:        input.name }),
      ...(input.code        !== undefined && { code:        input.code.toUpperCase() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive    !== undefined && { isActive:    input.isActive }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(faculties.id, id), eq(faculties.tenantId, tenantId)))
    .returning()

  await db.insert(facultyAuditLogs).values({
    tenantId,
    facultyId:   id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before, after } as any,
  })

  return after
}

export async function deleteFaculty(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(faculties)
    .where(and(eq(faculties.id, id), eq(faculties.tenantId, tenantId), isNull(faculties.deletedAt)))
    .limit(1)

  if (!existing) throw new Error('Faculty not found.')

  await db
    .update(faculties)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(faculties.id, id), eq(faculties.tenantId, tenantId)))

  await db.insert(facultyAuditLogs).values({
    tenantId,
    facultyId:   id,
    action:      'DELETE',
    performedBy,
    snapshot:    existing as any,
  })

  return { message: 'Faculty deleted successfully.' }
}

export async function getFacultyAuditLogs(tenantId: string, facultyId: string) {
  const [faculty] = await db
    .select({ id: faculties.id })
    .from(faculties)
    .where(and(eq(faculties.id, facultyId), eq(faculties.tenantId, tenantId)))
    .limit(1)

  if (!faculty) throw new Error('Faculty not found.')

  return db
    .select({
      id:              facultyAuditLogs.id,
      action:          facultyAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        facultyAuditLogs.snapshot,
      createdAt:       facultyAuditLogs.createdAt,
    })
    .from(facultyAuditLogs)
    .leftJoin(users, eq(facultyAuditLogs.performedBy, users.id))
    .where(and(eq(facultyAuditLogs.tenantId, tenantId), eq(facultyAuditLogs.facultyId, facultyId)))
    .orderBy(desc(facultyAuditLogs.createdAt))
}
