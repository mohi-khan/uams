import { eq, and, ilike, isNull, count, desc, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import {
  feeStructures, feeStructureAuditLogs,
} from '../db/schema/student-enrollment'
import { programs }  from '../db/schema/academic'
import { users }     from '../db/schema/users'
import type { CreateFeeStructureInput, UpdateFeeStructureInput } from '../lib/validators/enrollment-txn.validator'

export async function listFeeStructures(
  tenantId: string,
  page = 1, limit = 50,
  programId?: string, search?: string,
) {
  const offset = (page - 1) * limit
  const conds: any[] = [eq(feeStructures.tenantId, tenantId), isNull(feeStructures.deletedAt)]
  if (programId) conds.push(eq(feeStructures.programId, programId))
  if (search)    conds.push(ilike(feeStructures.description, `%${search}%`))
  const where = and(...conds)

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:          feeStructures.id,
      programId:   feeStructures.programId,
      programName: sql<string>`${programs.name}`,
      programCode: sql<string>`${programs.code}`,
      description: feeStructures.description,
      feeType:     feeStructures.feeType,
      amount:      feeStructures.amount,
      isActive:    feeStructures.isActive,
      createdAt:   feeStructures.createdAt,
    })
    .from(feeStructures)
    .innerJoin(programs, eq(feeStructures.programId, programs.id))
    .where(where)
    .orderBy(programs.code, feeStructures.feeType)
    .limit(limit).offset(offset),
    db.select({ total: count() }).from(feeStructures).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function createFeeStructure(
  tenantId: string, performedBy: string, input: CreateFeeStructureInput,
) {
  const [row] = await db.insert(feeStructures).values({
    tenantId,
    programId:   input.programId,
    description: input.description,
    feeType:     input.feeType,
    amount:      String(input.amount),
    createdBy:   performedBy,
    updatedBy:   performedBy,
  }).returning()

  await db.insert(feeStructureAuditLogs).values({
    tenantId, feeStructureId: row.id, action: 'CREATE', performedBy, snapshot: row as any,
  })

  return row
}

export async function updateFeeStructure(
  tenantId: string, performedBy: string, id: string, input: UpdateFeeStructureInput,
) {
  const [before] = await db
    .select()
    .from(feeStructures)
    .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId), isNull(feeStructures.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Fee structure not found.')

  const [after] = await db.update(feeStructures)
    .set({
      ...(input.description !== undefined && { description: input.description }),
      ...(input.feeType     !== undefined && { feeType:     input.feeType }),
      ...(input.amount      !== undefined && { amount:      String(input.amount) }),
      ...(input.isActive    !== undefined && { isActive:    input.isActive }),
      updatedBy: performedBy, updatedAt: new Date(),
    })
    .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)))
    .returning()

  await db.insert(feeStructureAuditLogs).values({
    tenantId, feeStructureId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

export async function deleteFeeStructure(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(feeStructures)
    .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId), isNull(feeStructures.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Fee structure not found.')

  await db.update(feeStructures)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)))

  await db.insert(feeStructureAuditLogs).values({
    tenantId, feeStructureId: id, action: 'DELETE', performedBy, snapshot: existing as any,
  })
}

export async function getFeeStructureAuditLogs(tenantId: string, id: string) {
  return db
    .select({
      id:              feeStructureAuditLogs.id,
      action:          feeStructureAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName},' ',${users.lastName}),'System')`,
      snapshot:        feeStructureAuditLogs.snapshot,
      createdAt:       feeStructureAuditLogs.createdAt,
    })
    .from(feeStructureAuditLogs)
    .leftJoin(users, eq(feeStructureAuditLogs.performedBy, users.id))
    .where(and(eq(feeStructureAuditLogs.tenantId, tenantId), eq(feeStructureAuditLogs.feeStructureId, id)))
    .orderBy(desc(feeStructureAuditLogs.createdAt))
}
