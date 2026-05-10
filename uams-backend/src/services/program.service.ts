import { eq, and, ilike, isNull, count, desc, sql, or } from 'drizzle-orm'
import { db } from '../lib/db'
import { programs, programAuditLogs, departments, faculties } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateProgramInput, UpdateProgramInput } from '../lib/validators/academic.validator'

export async function createProgram(tenantId: string, performedBy: string, input: CreateProgramInput) {
  const code = input.code.toUpperCase()

  const [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, input.departmentId), eq(departments.tenantId, tenantId), isNull(departments.deletedAt)))
    .limit(1)
  if (!dept) throw new Error('Department not found.')

  const [existing] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.tenantId, tenantId), eq(programs.code, code), isNull(programs.deletedAt)))
    .limit(1)
  if (existing) throw new Error('A program with this code already exists.')

  const [program] = await db.insert(programs).values({
    tenantId,
    departmentId:      input.departmentId,
    name:              input.name,
    code,
    degreeLevel:       input.degreeLevel,
    totalCredits:      input.totalCredits,
    durationSemesters: input.durationSemesters,
    status:            input.status ?? 'active',
    createdBy:         performedBy,
    updatedBy:         performedBy,
  }).returning()

  await db.insert(programAuditLogs).values({
    tenantId,
    programId:   program.id,
    action:      'CREATE',
    performedBy,
    snapshot:    program as any,
  })

  return program
}

export async function listPrograms(
  tenantId: string,
  page = 1,
  limit = 20,
  departmentId?: string,
  search?: string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(programs.tenantId, tenantId), isNull(programs.deletedAt)]
  if (departmentId) conditions.push(eq(programs.departmentId, departmentId))
  if (search) {
    conditions.push(or(
      ilike(programs.code, `%${search}%`),
      ilike(programs.name, `%${search}%`),
    )!)
  }
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:                programs.id,
      departmentId:      programs.departmentId,
      departmentName:    departments.name,
      facultyName:       faculties.name,
      name:              programs.name,
      code:              programs.code,
      degreeLevel:       programs.degreeLevel,
      totalCredits:      programs.totalCredits,
      durationSemesters: programs.durationSemesters,
      status:            programs.status,
      createdAt:         programs.createdAt,
      updatedAt:         programs.updatedAt,
    })
    .from(programs)
    .leftJoin(departments, eq(programs.departmentId, departments.id))
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(where)
    .orderBy(programs.code)
    .limit(limit)
    .offset(offset),
    db.select({ total: count() }).from(programs).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getProgramById(tenantId: string, id: string) {
  const [program] = await db
    .select({
      id:                programs.id,
      tenantId:          programs.tenantId,
      departmentId:      programs.departmentId,
      departmentName:    departments.name,
      facultyName:       faculties.name,
      name:              programs.name,
      code:              programs.code,
      degreeLevel:       programs.degreeLevel,
      totalCredits:      programs.totalCredits,
      durationSemesters: programs.durationSemesters,
      status:            programs.status,
      createdAt:         programs.createdAt,
      updatedAt:         programs.updatedAt,
    })
    .from(programs)
    .leftJoin(departments, eq(programs.departmentId, departments.id))
    .leftJoin(faculties, eq(departments.facultyId, faculties.id))
    .where(and(eq(programs.id, id), eq(programs.tenantId, tenantId), isNull(programs.deletedAt)))
    .limit(1)

  if (!program) throw new Error('Program not found.')
  return program
}

export async function updateProgram(tenantId: string, performedBy: string, id: string, input: UpdateProgramInput) {
  const [before] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.tenantId, tenantId), isNull(programs.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Program not found.')

  if (input.code) {
    const code = input.code.toUpperCase()
    if (code !== before.code) {
      const [dup] = await db
        .select({ id: programs.id })
        .from(programs)
        .where(and(eq(programs.tenantId, tenantId), eq(programs.code, code), isNull(programs.deletedAt)))
        .limit(1)
      if (dup) throw new Error('A program with this code already exists.')
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
    .update(programs)
    .set({
      ...(input.departmentId      !== undefined && { departmentId:      input.departmentId }),
      ...(input.code              !== undefined && { code:              input.code.toUpperCase() }),
      ...(input.name              !== undefined && { name:              input.name }),
      ...(input.degreeLevel       !== undefined && { degreeLevel:       input.degreeLevel }),
      ...(input.totalCredits      !== undefined && { totalCredits:      input.totalCredits }),
      ...(input.durationSemesters !== undefined && { durationSemesters: input.durationSemesters }),
      ...(input.status            !== undefined && { status:            input.status }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(programs.id, id), eq(programs.tenantId, tenantId)))
    .returning()

  await db.insert(programAuditLogs).values({
    tenantId,
    programId:   id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before, after } as any,
  })

  return after
}

export async function deleteProgram(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.tenantId, tenantId), isNull(programs.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Program not found.')

  await db
    .update(programs)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(programs.id, id), eq(programs.tenantId, tenantId)))

  await db.insert(programAuditLogs).values({
    tenantId,
    programId:   id,
    action:      'DELETE',
    performedBy,
    snapshot:    existing as any,
  })

  return { message: 'Program deleted successfully.' }
}

export async function getProgramAuditLogs(tenantId: string, programId: string) {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId)))
    .limit(1)
  if (!program) throw new Error('Program not found.')

  return db
    .select({
      id:              programAuditLogs.id,
      action:          programAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        programAuditLogs.snapshot,
      createdAt:       programAuditLogs.createdAt,
    })
    .from(programAuditLogs)
    .leftJoin(users, eq(programAuditLogs.performedBy, users.id))
    .where(and(eq(programAuditLogs.tenantId, tenantId), eq(programAuditLogs.programId, programId)))
    .orderBy(desc(programAuditLogs.createdAt))
}
