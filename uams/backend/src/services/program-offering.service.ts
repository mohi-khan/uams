import { eq, and, isNull, count, desc, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { programOfferings, programOfferingAuditLogs, studentEnrollments } from '../db/schema/student-enrollment'
import { programs, academicSessions } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateProgramOfferingInput, UpdateProgramOfferingInput, BulkSaveOfferingsInput } from '../lib/validators/enrollment-txn.validator'

export async function listProgramOfferings(
  tenantId: string,
  page = 1, limit = 50,
  opts: { programId?: string; sessionId?: string; status?: string } = {},
) {
  const offset = (page - 1) * limit
  const conds: any[] = [eq(programOfferings.tenantId, tenantId), isNull(programOfferings.deletedAt)]
  if (opts.programId) conds.push(eq(programOfferings.programId,         opts.programId))
  if (opts.sessionId) conds.push(eq(programOfferings.academicSessionId, opts.sessionId))
  if (opts.status)    conds.push(eq(programOfferings.status,            opts.status as any))
  const where = and(...conds)

  const enrolledSq = db
    .select({ offeringId: studentEnrollments.programOfferingId, cnt: count().as('cnt') })
    .from(studentEnrollments)
    .where(and(eq(studentEnrollments.tenantId, tenantId), isNull(studentEnrollments.deletedAt)))
    .groupBy(studentEnrollments.programOfferingId)
    .as('enrolled_counts')

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id:                 programOfferings.id,
      programId:          programOfferings.programId,
      programName:        programs.name,
      programCode:        programs.code,
      academicSessionId:  programOfferings.academicSessionId,
      sessionName:        academicSessions.name,
      admissionStartDate: programOfferings.admissionStartDate,
      admissionEndDate:   programOfferings.admissionEndDate,
      capacity:           programOfferings.capacity,
      status:             programOfferings.status,
      enrolledCount:      sql<number>`coalesce(${enrolledSq.cnt}, 0)`,
      createdAt:          programOfferings.createdAt,
    })
    .from(programOfferings)
    .innerJoin(programs,         eq(programOfferings.programId,         programs.id))
    .innerJoin(academicSessions, eq(programOfferings.academicSessionId, academicSessions.id))
    .leftJoin(enrolledSq,        eq(programOfferings.id,                enrolledSq.offeringId))
    .where(where)
    .orderBy(desc(programOfferings.createdAt))
    .limit(limit).offset(offset),

    db.select({ total: count() }).from(programOfferings).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getProgramOfferingById(tenantId: string, id: string) {
  const [row] = await db.select({
    id:                 programOfferings.id,
    programId:          programOfferings.programId,
    programName:        programs.name,
    programCode:        programs.code,
    academicSessionId:  programOfferings.academicSessionId,
    sessionName:        academicSessions.name,
    admissionStartDate: programOfferings.admissionStartDate,
    admissionEndDate:   programOfferings.admissionEndDate,
    capacity:           programOfferings.capacity,
    status:             programOfferings.status,
  })
  .from(programOfferings)
  .innerJoin(programs,         eq(programOfferings.programId,         programs.id))
  .innerJoin(academicSessions, eq(programOfferings.academicSessionId, academicSessions.id))
  .where(and(eq(programOfferings.id, id), eq(programOfferings.tenantId, tenantId), isNull(programOfferings.deletedAt)))
  .limit(1)

  if (!row) throw new Error('Program offering not found.')
  return row
}

export async function createProgramOffering(
  tenantId: string, performedBy: string, input: CreateProgramOfferingInput,
) {
  const [row] = await db.insert(programOfferings).values({
    tenantId,
    programId:          input.programId,
    academicSessionId:  input.academicSessionId,
    admissionStartDate: input.admissionStartDate ?? null,
    admissionEndDate:   input.admissionEndDate   ?? null,
    capacity:           input.capacity           ?? null,
    status:             input.status,
    createdBy:          performedBy,
    updatedBy:          performedBy,
  }).returning()

  await db.insert(programOfferingAuditLogs).values({
    tenantId, offeringId: row.id, action: 'CREATE', performedBy, snapshot: row as any,
  })

  return getProgramOfferingById(tenantId, row.id)
}

export async function updateProgramOffering(
  tenantId: string, performedBy: string, id: string, input: UpdateProgramOfferingInput,
) {
  const [before] = await db
    .select()
    .from(programOfferings)
    .where(and(eq(programOfferings.id, id), eq(programOfferings.tenantId, tenantId), isNull(programOfferings.deletedAt)))
    .limit(1)
  if (!before) throw new Error('Program offering not found.')

  const [after] = await db.update(programOfferings)
    .set({
      ...(input.admissionStartDate !== undefined && { admissionStartDate: input.admissionStartDate }),
      ...(input.admissionEndDate   !== undefined && { admissionEndDate:   input.admissionEndDate }),
      ...(input.capacity           !== undefined && { capacity:           input.capacity }),
      ...(input.status             !== undefined && { status:             input.status }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(programOfferings.id, id), eq(programOfferings.tenantId, tenantId)))
    .returning()

  await db.insert(programOfferingAuditLogs).values({
    tenantId, offeringId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return getProgramOfferingById(tenantId, id)
}

export async function deleteProgramOffering(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(programOfferings)
    .where(and(eq(programOfferings.id, id), eq(programOfferings.tenantId, tenantId), isNull(programOfferings.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Program offering not found.')

  await db.update(programOfferings)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(programOfferings.id, id), eq(programOfferings.tenantId, tenantId)))

  await db.insert(programOfferingAuditLogs).values({
    tenantId, offeringId: id, action: 'DELETE', performedBy, snapshot: existing as any,
  })
}

export async function bulkSaveOfferings(
  tenantId: string, performedBy: string, input: BulkSaveOfferingsInput,
) {
  const existing = await db
    .select({ id: programOfferings.id, programId: programOfferings.programId })
    .from(programOfferings)
    .where(and(
      eq(programOfferings.tenantId,          tenantId),
      eq(programOfferings.academicSessionId, input.academicSessionId),
      isNull(programOfferings.deletedAt),
    ))

  const existingMap = new Map(existing.map(o => [o.programId, o.id]))

  for (const prog of input.programs) {
    const existingId = existingMap.get(prog.programId)
    if (existingId) {
      await updateProgramOffering(tenantId, performedBy, existingId, {
        admissionStartDate: prog.admissionStartDate,
        admissionEndDate:   prog.admissionEndDate,
        capacity:           prog.capacity,
        status:             prog.status,
      })
    } else {
      await createProgramOffering(tenantId, performedBy, {
        programId:          prog.programId,
        academicSessionId:  input.academicSessionId,
        admissionStartDate: prog.admissionStartDate ?? undefined,
        admissionEndDate:   prog.admissionEndDate   ?? undefined,
        capacity:           prog.capacity           ?? undefined,
        status:             prog.status,
      })
    }
  }

  return listProgramOfferings(tenantId, 1, 200, { sessionId: input.academicSessionId })
}

export async function getProgramOfferingAuditLogs(tenantId: string, offeringId: string) {
  return db
    .select({
      id:              programOfferingAuditLogs.id,
      action:          programOfferingAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName},' ',${users.lastName}),'System')`,
      snapshot:        programOfferingAuditLogs.snapshot,
      createdAt:       programOfferingAuditLogs.createdAt,
    })
    .from(programOfferingAuditLogs)
    .leftJoin(users, eq(programOfferingAuditLogs.performedBy, users.id))
    .where(and(
      eq(programOfferingAuditLogs.tenantId,   tenantId),
      eq(programOfferingAuditLogs.offeringId, offeringId),
    ))
    .orderBy(desc(programOfferingAuditLogs.createdAt))
}
