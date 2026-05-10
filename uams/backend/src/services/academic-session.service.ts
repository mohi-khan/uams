import { eq, and, ilike, isNull, count, desc, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { academicSessions, academicSessionAuditLogs } from '../db/schema/academic'
import { users } from '../db/schema/users'
import type { CreateSessionInput, UpdateSessionInput } from '../lib/validators/academic.validator'

export async function createSession(tenantId: string, performedBy: string, input: CreateSessionInput) {
  if (input.endDate <= input.startDate) {
    throw new Error('End date must be after start date.')
  }

  const [existing] = await db
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(and(
      eq(academicSessions.tenantId, tenantId),
      eq(academicSessions.year,     input.year),
      eq(academicSessions.term,     input.term),
      isNull(academicSessions.deletedAt),
    ))
    .limit(1)

  if (existing) throw new Error(`A ${input.term} ${input.year} session already exists.`)

  const [session] = await db.insert(academicSessions).values({
    tenantId,
    name:      input.name,
    year:      input.year,
    term:      input.term,
    startDate: input.startDate,
    endDate:   input.endDate,
    status:    input.status,
    createdBy: performedBy,
    updatedBy: performedBy,
  }).returning()

  await db.insert(academicSessionAuditLogs).values({
    tenantId,
    sessionId:   session.id,
    action:      'CREATE',
    performedBy,
    snapshot:    session as any,
  })

  return session
}

export async function listSessions(
  tenantId: string,
  page  = 1,
  limit = 20,
  search?: string,
) {
  const offset = (page - 1) * limit

  const conditions: any[] = [
    eq(academicSessions.tenantId, tenantId),
    isNull(academicSessions.deletedAt),
  ]
  if (search) conditions.push(ilike(academicSessions.name, `%${search}%`))
  const where = and(...conditions)

  const [rows, [{ total }]] = await Promise.all([
    db.select()
      .from(academicSessions)
      .where(where)
      .orderBy(desc(academicSessions.year), academicSessions.term)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(academicSessions).where(where),
  ])

  return { data: rows, total: Number(total), page, limit }
}

export async function getSessionById(tenantId: string, id: string) {
  const [session] = await db
    .select()
    .from(academicSessions)
    .where(and(
      eq(academicSessions.id,       id),
      eq(academicSessions.tenantId, tenantId),
      isNull(academicSessions.deletedAt),
    ))
    .limit(1)

  if (!session) throw new Error('Session not found.')
  return session
}

export async function updateSession(
  tenantId: string,
  performedBy: string,
  id: string,
  input: UpdateSessionInput,
) {
  const [before] = await db
    .select()
    .from(academicSessions)
    .where(and(
      eq(academicSessions.id,       id),
      eq(academicSessions.tenantId, tenantId),
      isNull(academicSessions.deletedAt),
    ))
    .limit(1)

  if (!before) throw new Error('Session not found.')

  const newYear      = input.year      ?? before.year
  const newTerm      = input.term      ?? before.term
  const newStartDate = input.startDate ?? before.startDate
  const newEndDate   = input.endDate   ?? before.endDate

  if (newEndDate <= newStartDate) throw new Error('End date must be after start date.')

  if ((input.year || input.term) && (newYear !== before.year || newTerm !== before.term)) {
    const [dup] = await db
      .select({ id: academicSessions.id })
      .from(academicSessions)
      .where(and(
        eq(academicSessions.tenantId, tenantId),
        eq(academicSessions.year,     newYear),
        eq(academicSessions.term,     newTerm),
        isNull(academicSessions.deletedAt),
      ))
      .limit(1)
    if (dup && dup.id !== id) throw new Error(`A ${newTerm} ${newYear} session already exists.`)
  }

  const [after] = await db
    .update(academicSessions)
    .set({
      ...(input.name      !== undefined && { name:      input.name }),
      ...(input.year      !== undefined && { year:      input.year }),
      ...(input.term      !== undefined && { term:      input.term }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.endDate   !== undefined && { endDate:   input.endDate }),
      ...(input.status    !== undefined && { status:    input.status }),
      updatedBy: performedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(academicSessions.id, id), eq(academicSessions.tenantId, tenantId)))
    .returning()

  await db.insert(academicSessionAuditLogs).values({
    tenantId,
    sessionId:   id,
    action:      'UPDATE',
    performedBy,
    snapshot:    { before, after } as any,
  })

  return after
}

export async function deleteSession(tenantId: string, performedBy: string, id: string) {
  const [existing] = await db
    .select()
    .from(academicSessions)
    .where(and(
      eq(academicSessions.id,       id),
      eq(academicSessions.tenantId, tenantId),
      isNull(academicSessions.deletedAt),
    ))
    .limit(1)

  if (!existing) throw new Error('Session not found.')
  if (existing.status === 'active') throw new Error('Cannot delete an active session.')

  await db
    .update(academicSessions)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(academicSessions.id, id), eq(academicSessions.tenantId, tenantId)))

  await db.insert(academicSessionAuditLogs).values({
    tenantId,
    sessionId:   id,
    action:      'DELETE',
    performedBy,
    snapshot:    existing as any,
  })

  return { message: 'Session deleted successfully.' }
}

export async function getSessionAuditLogs(tenantId: string, sessionId: string) {
  const [s] = await db
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(and(eq(academicSessions.id, sessionId), eq(academicSessions.tenantId, tenantId)))
    .limit(1)

  if (!s) throw new Error('Session not found.')

  return db
    .select({
      id:              academicSessionAuditLogs.id,
      action:          academicSessionAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        academicSessionAuditLogs.snapshot,
      createdAt:       academicSessionAuditLogs.createdAt,
    })
    .from(academicSessionAuditLogs)
    .leftJoin(users, eq(academicSessionAuditLogs.performedBy, users.id))
    .where(and(
      eq(academicSessionAuditLogs.tenantId,  tenantId),
      eq(academicSessionAuditLogs.sessionId, sessionId),
    ))
    .orderBy(desc(academicSessionAuditLogs.createdAt))
}
