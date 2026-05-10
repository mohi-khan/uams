import { eq, and, isNull, desc, sql, count } from 'drizzle-orm'
import { db } from '../lib/db'
import { users } from '../db/schema/users'
import { courses, programs } from '../db/schema/academic'
import {
  courseLearningOutcomes, cloAuditLogs,
  programLearningOutcomes, ploAuditLogs,
  cloPloMappings, cloPloMappingAuditLogs,
} from '../db/schema/obe'
import type {
  CreateCloInput, UpdateCloInput,
  CreatePloInput, UpdatePloInput,
  CreateMappingInput, UpdateMappingInput,
} from '../lib/validators/obe.validator'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function nextCloCode(tenantId: string, courseId: string): Promise<string> {
  const [row] = await db
    .select({ n: count() })
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.tenantId, tenantId),
      eq(courseLearningOutcomes.courseId, courseId),
    ))
  return `CLO${Number(row.n) + 1}`
}

async function nextPloCode(tenantId: string, programId: string): Promise<string> {
  const [row] = await db
    .select({ n: count() })
    .from(programLearningOutcomes)
    .where(and(
      eq(programLearningOutcomes.tenantId, tenantId),
      eq(programLearningOutcomes.programId, programId),
    ))
  return `PLO${Number(row.n) + 1}`
}

// ── CLO ───────────────────────────────────────────────────────────────────────

export async function listClos(tenantId: string, courseId: string) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  return db
    .select({
      id:          courseLearningOutcomes.id,
      courseId:    courseLearningOutcomes.courseId,
      code:        courseLearningOutcomes.code,
      description: courseLearningOutcomes.description,
      bloomsLevel: courseLearningOutcomes.bloomsLevel,
      createdAt:   courseLearningOutcomes.createdAt,
      updatedAt:   courseLearningOutcomes.updatedAt,
    })
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.tenantId, tenantId),
      eq(courseLearningOutcomes.courseId, courseId),
      isNull(courseLearningOutcomes.deletedAt),
    ))
    .orderBy(
      sql`length(${courseLearningOutcomes.code})`,
      courseLearningOutcomes.code,
    )
}

export async function createClo(tenantId: string, performedBy: string, input: CreateCloInput) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  const code = await nextCloCode(tenantId, input.courseId)

  const [clo] = await db
    .insert(courseLearningOutcomes)
    .values({
      tenantId,
      courseId:    input.courseId,
      code,
      description: input.description,
      bloomsLevel: input.bloomsLevel ?? null,
      createdBy:   performedBy,
      updatedBy:   performedBy,
    })
    .returning()

  await db.insert(cloAuditLogs).values({
    tenantId, cloId: clo.id, action: 'CREATE', performedBy, snapshot: clo as any,
  })

  return clo
}

export async function getCloById(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.id, id),
      eq(courseLearningOutcomes.tenantId, tenantId),
      isNull(courseLearningOutcomes.deletedAt),
    ))
    .limit(1)
  if (!row) throw new Error('CLO not found.')
  return row
}

export async function updateClo(tenantId: string, performedBy: string, id: string, input: UpdateCloInput) {
  const before = await getCloById(tenantId, id)

  const updateData: Record<string, unknown> = { updatedBy: performedBy, updatedAt: new Date() }
  if (input.description !== undefined) updateData.description = input.description
  if (input.bloomsLevel !== undefined) updateData.bloomsLevel = input.bloomsLevel

  const [after] = await db
    .update(courseLearningOutcomes)
    .set(updateData as any)
    .where(and(eq(courseLearningOutcomes.id, id), eq(courseLearningOutcomes.tenantId, tenantId)))
    .returning()

  await db.insert(cloAuditLogs).values({
    tenantId, cloId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

export async function deleteClo(tenantId: string, performedBy: string, id: string) {
  const before = await getCloById(tenantId, id)

  await db
    .update(courseLearningOutcomes)
    .set({ deletedAt: new Date(), deletedBy: performedBy })
    .where(and(eq(courseLearningOutcomes.id, id), eq(courseLearningOutcomes.tenantId, tenantId)))

  await db.insert(cloAuditLogs).values({
    tenantId, cloId: id, action: 'DELETE', performedBy, snapshot: before as any,
  })

  return { success: true }
}

export async function getCloAuditLogs(tenantId: string, cloId: string) {
  await getCloById(tenantId, cloId)  // existence check (includes soft-deleted? no — throw if deleted)

  return db
    .select({
      id:              cloAuditLogs.id,
      action:          cloAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        cloAuditLogs.snapshot,
      createdAt:       cloAuditLogs.createdAt,
    })
    .from(cloAuditLogs)
    .leftJoin(users, eq(cloAuditLogs.performedBy, users.id))
    .where(and(eq(cloAuditLogs.tenantId, tenantId), eq(cloAuditLogs.cloId, cloId)))
    .orderBy(desc(cloAuditLogs.createdAt))
}

// ── PLO ───────────────────────────────────────────────────────────────────────

export async function listPlos(tenantId: string, programId: string) {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId), isNull(programs.deletedAt)))
    .limit(1)
  if (!program) throw new Error('Program not found.')

  return db
    .select({
      id:          programLearningOutcomes.id,
      programId:   programLearningOutcomes.programId,
      code:        programLearningOutcomes.code,
      description: programLearningOutcomes.description,
      createdAt:   programLearningOutcomes.createdAt,
      updatedAt:   programLearningOutcomes.updatedAt,
    })
    .from(programLearningOutcomes)
    .where(and(
      eq(programLearningOutcomes.tenantId, tenantId),
      eq(programLearningOutcomes.programId, programId),
      isNull(programLearningOutcomes.deletedAt),
    ))
    .orderBy(
      sql`length(${programLearningOutcomes.code})`,
      programLearningOutcomes.code,
    )
}

export async function createPlo(tenantId: string, performedBy: string, input: CreatePloInput) {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, input.programId), eq(programs.tenantId, tenantId), isNull(programs.deletedAt)))
    .limit(1)
  if (!program) throw new Error('Program not found.')

  const code = await nextPloCode(tenantId, input.programId)

  const [plo] = await db
    .insert(programLearningOutcomes)
    .values({
      tenantId,
      programId:   input.programId,
      code,
      description: input.description,
      createdBy:   performedBy,
      updatedBy:   performedBy,
    })
    .returning()

  await db.insert(ploAuditLogs).values({
    tenantId, ploId: plo.id, action: 'CREATE', performedBy, snapshot: plo as any,
  })

  return plo
}

export async function getPloById(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(programLearningOutcomes)
    .where(and(
      eq(programLearningOutcomes.id, id),
      eq(programLearningOutcomes.tenantId, tenantId),
      isNull(programLearningOutcomes.deletedAt),
    ))
    .limit(1)
  if (!row) throw new Error('PLO not found.')
  return row
}

export async function updatePlo(tenantId: string, performedBy: string, id: string, input: UpdatePloInput) {
  const before = await getPloById(tenantId, id)

  const [after] = await db
    .update(programLearningOutcomes)
    .set({ description: input.description, updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(programLearningOutcomes.id, id), eq(programLearningOutcomes.tenantId, tenantId)))
    .returning()

  await db.insert(ploAuditLogs).values({
    tenantId, ploId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

export async function deletePlo(tenantId: string, performedBy: string, id: string) {
  const before = await getPloById(tenantId, id)

  // Block delete if any active mappings exist
  const [{ n }] = await db
    .select({ n: count() })
    .from(cloPloMappings)
    .where(eq(cloPloMappings.ploId, id))
  if (Number(n) > 0) throw new Error('Cannot delete PLO with existing CLO mappings.')

  await db
    .update(programLearningOutcomes)
    .set({ deletedAt: new Date(), deletedBy: performedBy })
    .where(and(eq(programLearningOutcomes.id, id), eq(programLearningOutcomes.tenantId, tenantId)))

  await db.insert(ploAuditLogs).values({
    tenantId, ploId: id, action: 'DELETE', performedBy, snapshot: before as any,
  })

  return { success: true }
}

export async function getPloAuditLogs(tenantId: string, ploId: string) {
  await getPloById(tenantId, ploId)

  return db
    .select({
      id:              ploAuditLogs.id,
      action:          ploAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        ploAuditLogs.snapshot,
      createdAt:       ploAuditLogs.createdAt,
    })
    .from(ploAuditLogs)
    .leftJoin(users, eq(ploAuditLogs.performedBy, users.id))
    .where(and(eq(ploAuditLogs.tenantId, tenantId), eq(ploAuditLogs.ploId, ploId)))
    .orderBy(desc(ploAuditLogs.createdAt))
}

// ── CLO–PLO Mappings ──────────────────────────────────────────────────────────

export async function listMappings(
  tenantId: string,
  cloId?: string,
  ploId?: string,
  courseId?: string,
) {
  const conditions: any[] = [eq(cloPloMappings.tenantId, tenantId)]
  if (cloId)    conditions.push(eq(cloPloMappings.cloId, cloId))
  if (ploId)    conditions.push(eq(cloPloMappings.ploId, ploId))
  if (courseId) conditions.push(eq(courseLearningOutcomes.courseId, courseId))

  return db
    .select({
      id:             cloPloMappings.id,
      cloId:          cloPloMappings.cloId,
      cloCode:        courseLearningOutcomes.code,
      cloDescription: courseLearningOutcomes.description,
      ploId:          cloPloMappings.ploId,
      ploCode:        programLearningOutcomes.code,
      ploDescription: programLearningOutcomes.description,
      weight:         cloPloMappings.weight,
      createdAt:      cloPloMappings.createdAt,
      updatedAt:      cloPloMappings.updatedAt,
    })
    .from(cloPloMappings)
    .innerJoin(courseLearningOutcomes,  eq(cloPloMappings.cloId, courseLearningOutcomes.id))
    .innerJoin(programLearningOutcomes, eq(cloPloMappings.ploId, programLearningOutcomes.id))
    .where(and(...conditions))
    .orderBy(
      sql`length(${courseLearningOutcomes.code})`,
      courseLearningOutcomes.code,
      sql`length(${programLearningOutcomes.code})`,
      programLearningOutcomes.code,
    )
}

export async function createMapping(tenantId: string, performedBy: string, input: CreateMappingInput) {
  // Validate CLO and PLO belong to tenant
  const [clo] = await db
    .select({ id: courseLearningOutcomes.id })
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.id, input.cloId),
      eq(courseLearningOutcomes.tenantId, tenantId),
      isNull(courseLearningOutcomes.deletedAt),
    ))
    .limit(1)
  if (!clo) throw new Error('CLO not found.')

  const [plo] = await db
    .select({ id: programLearningOutcomes.id })
    .from(programLearningOutcomes)
    .where(and(
      eq(programLearningOutcomes.id, input.ploId),
      eq(programLearningOutcomes.tenantId, tenantId),
      isNull(programLearningOutcomes.deletedAt),
    ))
    .limit(1)
  if (!plo) throw new Error('PLO not found.')

  const [mapping] = await db
    .insert(cloPloMappings)
    .values({
      tenantId,
      cloId:     input.cloId,
      ploId:     input.ploId,
      weight:    String(input.weight),
      createdBy: performedBy,
      updatedBy: performedBy,
    })
    .returning()

  await db.insert(cloPloMappingAuditLogs).values({
    tenantId, mappingId: mapping.id, action: 'CREATE', performedBy, snapshot: mapping as any,
  })

  return mapping
}

export async function updateMapping(
  tenantId: string,
  performedBy: string,
  id: string,
  input: UpdateMappingInput,
) {
  const [before] = await db
    .select()
    .from(cloPloMappings)
    .where(and(eq(cloPloMappings.id, id), eq(cloPloMappings.tenantId, tenantId)))
    .limit(1)
  if (!before) throw new Error('Mapping not found.')

  const [after] = await db
    .update(cloPloMappings)
    .set({ weight: String(input.weight), updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(cloPloMappings.id, id), eq(cloPloMappings.tenantId, tenantId)))
    .returning()

  await db.insert(cloPloMappingAuditLogs).values({
    tenantId, mappingId: id, action: 'UPDATE', performedBy, snapshot: { before, after } as any,
  })

  return after
}

export async function deleteMapping(tenantId: string, performedBy: string, id: string) {
  const [before] = await db
    .select()
    .from(cloPloMappings)
    .where(and(eq(cloPloMappings.id, id), eq(cloPloMappings.tenantId, tenantId)))
    .limit(1)
  if (!before) throw new Error('Mapping not found.')

  await db
    .delete(cloPloMappings)
    .where(and(eq(cloPloMappings.id, id), eq(cloPloMappings.tenantId, tenantId)))

  await db.insert(cloPloMappingAuditLogs).values({
    tenantId, mappingId: id, action: 'DELETE', performedBy, snapshot: before as any,
  })

  return { success: true }
}
