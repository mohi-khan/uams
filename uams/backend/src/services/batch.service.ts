import { eq, and, ilike, isNull, count, desc, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { batches, batchAuditLogs } from '../db/schema/enrollment'
import { programs, academicSessions } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateBatchInput, UpdateBatchInput } from '../lib/validators/enrollment.validator'

export async function createBatch(tenantId: string, performedBy: string, input: CreateBatchInput) {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, input.programId), eq(programs.tenantId, tenantId), isNull(programs.deletedAt)))
    .limit(1)
  if (!program) throw new Error('Program not found.')

  if (input.sessionId) {
    const [session] = await db
      .select({ id: academicSessions.id })
      .from(academicSessions)
      .where(and(eq(academicSessions.id, input.sessionId), eq(academicSessions.tenantId, tenantId), isNull(academicSessions.deletedAt)))
      .limit(1)
    if (!session) throw new Error('Academic session not found.')
  }

  const code = input.code.toLowerCase()

  const [dup] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.tenantId, tenantId), eq(batches.code, code), isNull(batches.deletedAt)))
    .limit(1)
  if (dup) throw new Error('A batch with this code already exists.')

  const [batch] = await db.insert(batches).values({
    tenantId,
    programId: input.programId,
    sessionId: input.sessionId,
    code,
    name:      input.name,
    capacity:  input.capacity,
    createdBy: performedBy,
    updatedBy: performedBy,
  }).returning()

  await db.insert(batchAuditLogs).values({
    tenantId,
    batchId:     batch.id,
    action:      'CREATE',
    performedBy,
    snapshot:    batch as any,
  })

  return batch
}

export async function listBatches(
  tenantId: string,
  page      = 1,
  limit     = 20,
  programId?: string,
  search?:    string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [eq(batches.tenantId, tenantId), isNull(batches.deletedAt)]
  if (programId) conditions.push(eq(batches.programId, programId))
  if (search)    conditions.push(ilike(batches.code, `%${search}%`))
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:          batches.id,
      tenantId:    batches.tenantId,
      programId:   batches.programId,
      programName: programs.name,
      sessionId:   batches.sessionId,
      sessionName: academicSessions.name,
      code:        batches.code,
      name:        batches.name,
      capacity:    batches.capacity,
      isActive:    batches.isActive,
      createdAt:   batches.createdAt,
      updatedAt:   batches.updatedAt,
    })
    .from(batches)
    .leftJoin(programs,          eq(batches.programId, programs.id))
    .leftJoin(academicSessions,  eq(batches.sessionId, academicSessions.id))
    .where(where)
    .orderBy(batches.code)
    .limit(limit).offset(offset),
    db.select({ total: count() }).from(batches).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getBatchById(tenantId: string, id: string) {
  const [row] = await db
    .select({
      id:          batches.id,
      tenantId:    batches.tenantId,
      programId:   batches.programId,
      programName: programs.name,
      sessionId:   batches.sessionId,
      sessionName: academicSessions.name,
      code:        batches.code,
      name:        batches.name,
      capacity:    batches.capacity,
      isActive:    batches.isActive,
      createdAt:   batches.createdAt,
      updatedAt:   batches.updatedAt,
    })
    .from(batches)
    .leftJoin(programs,          eq(batches.programId, programs.id))
    .leftJoin(academicSessions,  eq(batches.sessionId, academicSessions.id))
    .where(and(eq(batches.id, id), eq(batches.tenantId, tenantId), isNull(batches.deletedAt)))
    .limit(1)

  if (!row) throw new Error('Batch not found.')
  return row
}

export async function updateBatch(
  tenantId: string,
  performedBy: string,
  id: string,
  input: UpdateBatchInput,
) {
  const [before] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.tenantId, tenantId), isNull(batches.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Batch not found.')

  if (input.code && input.code.toLowerCase() !== before.code) {
    const [dup] = await db
      .select({ id: batches.id })
      .from(batches)
      .where(and(eq(batches.tenantId, tenantId), eq(batches.code, input.code.toLowerCase()), isNull(batches.deletedAt)))
      .limit(1)
    if (dup) throw new Error('A batch with this code already exists.')
  }

  if (input.programId && input.programId !== before.programId) {
    const [p] = await db.select({ id: programs.id }).from(programs)
      .where(and(eq(programs.id, input.programId), eq(programs.tenantId, tenantId), isNull(programs.deletedAt))).limit(1)
    if (!p) throw new Error('Program not found.')
  }

  const [after] = await db
    .update(batches)
    .set({
      ...(input.programId !== undefined && { programId: input.programId }),
      ...(input.sessionId !== undefined && { sessionId: input.sessionId }),
      ...(input.code      !== undefined && { code:      input.code.toLowerCase() }),
      ...(input.name      !== undefined && { name:      input.name }),
      ...(input.capacity  !== undefined && { capacity:  input.capacity }),
      ...(input.isActive  !== undefined && { isActive:  input.isActive }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(batches.id, id), eq(batches.tenantId, tenantId)))
    .returning()

  await db.insert(batchAuditLogs).values({
    tenantId,
    batchId:     id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before, after } as any,
  })

  return after
}

export async function deleteBatch(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), eq(batches.tenantId, tenantId), isNull(batches.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Batch not found.')

  await db
    .update(batches)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(batches.id, id), eq(batches.tenantId, tenantId)))

  await db.insert(batchAuditLogs).values({
    tenantId,
    batchId:     id,
    action:      'DELETE',
    performedBy,
    snapshot:    existing as any,
  })

  return { message: 'Batch deleted successfully.' }
}

export async function getBatchAuditLogs(tenantId: string, batchId: string) {
  const [b] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.id, batchId), eq(batches.tenantId, tenantId)))
    .limit(1)
  if (!b) throw new Error('Batch not found.')

  return db
    .select({
      id:              batchAuditLogs.id,
      action:          batchAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        batchAuditLogs.snapshot,
      createdAt:       batchAuditLogs.createdAt,
    })
    .from(batchAuditLogs)
    .leftJoin(users, eq(batchAuditLogs.performedBy, users.id))
    .where(and(eq(batchAuditLogs.tenantId, tenantId), eq(batchAuditLogs.batchId, batchId)))
    .orderBy(desc(batchAuditLogs.createdAt))
}
