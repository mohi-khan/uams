import { eq, and, isNull, desc, sum, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { users } from '../db/schema/users'
import { courses, academicSessions } from '../db/schema/academic'
import { courseLearningOutcomes } from '../db/schema/obe'
import {
  courseAssessmentPlans,
  assessmentPlanAuditLogs,
  courseAssessmentComponents,
  assessmentComponentClos,
} from '../db/schema/assessment'
import type {
  CreateAssessmentPlanInput,
  CopyAssessmentPlanInput,
  CreateComponentInput,
  UpdateComponentInput,
  AddCloLinkInput,
} from '../lib/validators/assessment.validator'

type ViewerRole = 'admin' | 'super_admin' | 'academic_coordinator' | 'dean' | 'teacher' | 'student'

function canSeeDraft(role: ViewerRole) {
  return ['admin', 'super_admin', 'academic_coordinator'].includes(role)
}

function nextVersion(existing: string[]): string {
  if (existing.length === 0) return 'v1'
  const nums = existing.map(v => parseInt(v.replace('v', ''), 10)).filter(n => !isNaN(n))
  return `v${Math.max(...nums) + 1}`
}

// ── Helper: assert plan is draft ──────────────────────────────────────────────

async function assertDraftPlan(tenantId: string, planId: string) {
  const [plan] = await db
    .select({ id: courseAssessmentPlans.id, status: courseAssessmentPlans.status })
    .from(courseAssessmentPlans)
    .where(and(
      eq(courseAssessmentPlans.id, planId),
      eq(courseAssessmentPlans.tenantId, tenantId),
      isNull(courseAssessmentPlans.deletedAt),
    ))
    .limit(1)
  if (!plan) throw new Error('Assessment plan not found.')
  if (plan.status === 'final') throw new Error('This assessment plan is finalized and cannot be modified.')
  return plan
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function listPlans(
  tenantId: string,
  courseId: string,
  sessionId: string | undefined,
  role: ViewerRole,
) {
  const conditions: any[] = [
    eq(courseAssessmentPlans.tenantId, tenantId),
    eq(courseAssessmentPlans.courseId, courseId),
    isNull(courseAssessmentPlans.deletedAt),
  ]
  if (sessionId) conditions.push(eq(courseAssessmentPlans.academicSessionId, sessionId))
  if (!canSeeDraft(role)) conditions.push(eq(courseAssessmentPlans.status, 'final'))

  return db
    .select({
      id:                courseAssessmentPlans.id,
      courseId:          courseAssessmentPlans.courseId,
      academicSessionId: courseAssessmentPlans.academicSessionId,
      version:           courseAssessmentPlans.version,
      status:            courseAssessmentPlans.status,
      isDefault:         courseAssessmentPlans.isDefault,
      createdAt:         courseAssessmentPlans.createdAt,
      updatedAt:         courseAssessmentPlans.updatedAt,
    })
    .from(courseAssessmentPlans)
    .where(and(...conditions))
    .orderBy(desc(courseAssessmentPlans.createdAt))
}

export async function createPlan(
  tenantId: string,
  performedBy: string,
  input: CreateAssessmentPlanInput,
) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  const [session] = await db
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(and(eq(academicSessions.id, input.academicSessionId), eq(academicSessions.tenantId, tenantId)))
    .limit(1)
  if (!session) throw new Error('Academic session not found.')

  const existing = await db
    .select({ version: courseAssessmentPlans.version })
    .from(courseAssessmentPlans)
    .where(and(
      eq(courseAssessmentPlans.tenantId, tenantId),
      eq(courseAssessmentPlans.courseId, input.courseId),
      eq(courseAssessmentPlans.academicSessionId, input.academicSessionId),
      isNull(courseAssessmentPlans.deletedAt),
    ))

  const version   = nextVersion(existing.map(r => r.version))
  const isDefault = existing.length === 0

  const [plan] = await db
    .insert(courseAssessmentPlans)
    .values({
      tenantId,
      courseId:          input.courseId,
      academicSessionId: input.academicSessionId,
      version,
      status:    'draft',
      isDefault,
      createdBy: performedBy,
      updatedBy: performedBy,
    })
    .returning()

  await db.insert(assessmentPlanAuditLogs).values({
    tenantId, planId: plan.id, action: 'CREATE', performedBy, snapshot: plan as any,
  })

  return plan
}

export async function copyPlan(
  tenantId: string,
  performedBy: string,
  input: CopyAssessmentPlanInput,
) {
  // Pick the default final plan in the source session (fall back to most recent final)
  const [sourcePlan] = await db
    .select()
    .from(courseAssessmentPlans)
    .where(and(
      eq(courseAssessmentPlans.tenantId, tenantId),
      eq(courseAssessmentPlans.courseId, input.courseId),
      eq(courseAssessmentPlans.academicSessionId, input.sourceSessionId),
      eq(courseAssessmentPlans.status, 'final'),
      isNull(courseAssessmentPlans.deletedAt),
    ))
    .orderBy(desc(courseAssessmentPlans.isDefault), desc(courseAssessmentPlans.createdAt))
    .limit(1)
  if (!sourcePlan) throw new Error('No finalized assessment plan found in the source session.')

  const [targetSession] = await db
    .select({ id: academicSessions.id })
    .from(academicSessions)
    .where(and(eq(academicSessions.id, input.targetSessionId), eq(academicSessions.tenantId, tenantId)))
    .limit(1)
  if (!targetSession) throw new Error('Target session not found.')

  const existingInTarget = await db
    .select({ version: courseAssessmentPlans.version })
    .from(courseAssessmentPlans)
    .where(and(
      eq(courseAssessmentPlans.tenantId, tenantId),
      eq(courseAssessmentPlans.courseId, input.courseId),
      eq(courseAssessmentPlans.academicSessionId, input.targetSessionId),
      isNull(courseAssessmentPlans.deletedAt),
    ))

  const version   = nextVersion(existingInTarget.map(r => r.version))
  const isDefault = existingInTarget.length === 0

  const [newPlan] = await db
    .insert(courseAssessmentPlans)
    .values({
      tenantId,
      courseId:          input.courseId,
      academicSessionId: input.targetSessionId,
      version,
      status:    'draft',
      isDefault,
      createdBy: performedBy,
      updatedBy: performedBy,
    })
    .returning()

  // Copy components + CLO links
  const sourceComponents = await db
    .select()
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.planId, sourcePlan.id),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))
    .orderBy(courseAssessmentComponents.orderNo)

  for (const comp of sourceComponents) {
    const [newComp] = await db
      .insert(courseAssessmentComponents)
      .values({
        tenantId,
        planId:           newPlan.id,
        name:             comp.name,
        componentType:    comp.componentType,
        weightPercentage: comp.weightPercentage,
        totalMarks:       comp.totalMarks,
        assessmentCount:  comp.assessmentCount,
        cloMapped:        comp.cloMapped,
        orderNo:          comp.orderNo,
        createdBy:        performedBy,
        updatedBy:        performedBy,
      })
      .returning()

    const cloLinks = await db
      .select()
      .from(assessmentComponentClos)
      .where(and(
        eq(assessmentComponentClos.componentId, comp.id),
        eq(assessmentComponentClos.tenantId, tenantId),
      ))

    if (cloLinks.length > 0) {
      await db.insert(assessmentComponentClos).values(
        cloLinks.map(link => ({
          tenantId,
          componentId: newComp.id,
          cloId:       link.cloId,
          weight:      link.weight,
        }))
      )
    }
  }

  await db.insert(assessmentPlanAuditLogs).values({
    tenantId,
    planId:     newPlan.id,
    action:     'CREATE',
    performedBy,
    snapshot: { action: 'copy', copiedFromPlanId: sourcePlan.id, sourceSessionId: input.sourceSessionId } as any,
  })

  return newPlan
}

export async function getPlanWithComponents(
  tenantId: string,
  planId: string,
  role: ViewerRole,
) {
  const conditions: any[] = [
    eq(courseAssessmentPlans.id, planId),
    eq(courseAssessmentPlans.tenantId, tenantId),
    isNull(courseAssessmentPlans.deletedAt),
  ]
  if (!canSeeDraft(role)) conditions.push(eq(courseAssessmentPlans.status, 'final'))

  const [plan] = await db
    .select()
    .from(courseAssessmentPlans)
    .where(and(...conditions))
    .limit(1)
  if (!plan) throw new Error('Assessment plan not found.')

  // Components with CLO links
  const components = await db
    .select({
      id:               courseAssessmentComponents.id,
      planId:           courseAssessmentComponents.planId,
      name:             courseAssessmentComponents.name,
      componentType:    courseAssessmentComponents.componentType,
      weightPercentage: courseAssessmentComponents.weightPercentage,
      totalMarks:       courseAssessmentComponents.totalMarks,
      assessmentCount:  courseAssessmentComponents.assessmentCount,
      cloMapped:        courseAssessmentComponents.cloMapped,
      orderNo:          courseAssessmentComponents.orderNo,
      createdAt:        courseAssessmentComponents.createdAt,
      updatedAt:        courseAssessmentComponents.updatedAt,
    })
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.planId, planId),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))
    .orderBy(courseAssessmentComponents.orderNo, courseAssessmentComponents.createdAt)

  // CLO links for all components
  const componentIds = components.map(c => c.id)
  const cloLinks = componentIds.length > 0
    ? await db
        .select({
          id:          assessmentComponentClos.id,
          componentId: assessmentComponentClos.componentId,
          cloId:       assessmentComponentClos.cloId,
          cloCode:     courseLearningOutcomes.code,
          cloDesc:     courseLearningOutcomes.description,
          weight:      assessmentComponentClos.weight,
        })
        .from(assessmentComponentClos)
        .innerJoin(courseLearningOutcomes, eq(assessmentComponentClos.cloId, courseLearningOutcomes.id))
        .where(and(
          sql`${assessmentComponentClos.componentId} = ANY(ARRAY[${sql.join(componentIds.map(id => sql`${id}::uuid`), sql`, `)}])`,
          eq(assessmentComponentClos.tenantId, tenantId),
        ))
    : []

  const cloLinksByComponent = cloLinks.reduce<Record<string, typeof cloLinks>>((acc, l) => {
    ;(acc[l.componentId] ??= []).push(l)
    return acc
  }, {})

  return {
    ...plan,
    components: components.map(c => ({
      ...c,
      cloLinks: cloLinksByComponent[c.id] ?? [],
    })),
  }
}

export async function finalizePlan(tenantId: string, performedBy: string, planId: string) {
  const plan = await assertDraftPlan(tenantId, planId)

  // Ensure total weight = 100
  const [{ total }] = await db
    .select({ total: sum(courseAssessmentComponents.weightPercentage) })
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.planId, planId),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))

  const totalWeight = Number(total ?? 0)
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`Cannot finalize: total weight is ${totalWeight.toFixed(2)}% (must equal 100%).`)
  }

  const [after] = await db
    .update(courseAssessmentPlans)
    .set({ status: 'final', updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseAssessmentPlans.id, planId), eq(courseAssessmentPlans.tenantId, tenantId)))
    .returning()

  await db.insert(assessmentPlanAuditLogs).values({
    tenantId, planId, action: 'UPDATE', performedBy,
    snapshot: { action: 'finalize', before: plan, after } as any,
  })

  return after
}

export async function setDefaultPlan(tenantId: string, performedBy: string, planId: string) {
  const [plan] = await db
    .select()
    .from(courseAssessmentPlans)
    .where(and(
      eq(courseAssessmentPlans.id, planId),
      eq(courseAssessmentPlans.tenantId, tenantId),
      isNull(courseAssessmentPlans.deletedAt),
    ))
    .limit(1)
  if (!plan) throw new Error('Assessment plan not found.')
  if (plan.status !== 'final') throw new Error('Only a finalized plan can be set as default.')

  await db
    .update(courseAssessmentPlans)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(
      eq(courseAssessmentPlans.tenantId, tenantId),
      eq(courseAssessmentPlans.courseId, plan.courseId),
      eq(courseAssessmentPlans.academicSessionId, plan.academicSessionId),
      eq(courseAssessmentPlans.isDefault, true),
    ))

  const [after] = await db
    .update(courseAssessmentPlans)
    .set({ isDefault: true, updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseAssessmentPlans.id, planId), eq(courseAssessmentPlans.tenantId, tenantId)))
    .returning()

  await db.insert(assessmentPlanAuditLogs).values({
    tenantId, planId, action: 'UPDATE', performedBy, snapshot: { action: 'set-default' } as any,
  })

  return after
}

export async function deletePlan(tenantId: string, performedBy: string, planId: string) {
  await assertDraftPlan(tenantId, planId)

  await db
    .update(courseAssessmentPlans)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseAssessmentPlans.id, planId), eq(courseAssessmentPlans.tenantId, tenantId)))

  await db.insert(assessmentPlanAuditLogs).values({
    tenantId, planId, action: 'DELETE', performedBy, snapshot: null,
  })

  return { success: true }
}

export async function getPlanAuditLogs(tenantId: string, planId: string) {
  return db
    .select({
      id:              assessmentPlanAuditLogs.id,
      action:          assessmentPlanAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        assessmentPlanAuditLogs.snapshot,
      createdAt:       assessmentPlanAuditLogs.createdAt,
    })
    .from(assessmentPlanAuditLogs)
    .leftJoin(users, eq(assessmentPlanAuditLogs.performedBy, users.id))
    .where(and(eq(assessmentPlanAuditLogs.tenantId, tenantId), eq(assessmentPlanAuditLogs.planId, planId)))
    .orderBy(desc(assessmentPlanAuditLogs.createdAt))
}

// ── Components ────────────────────────────────────────────────────────────────

async function currentTotalWeight(tenantId: string, planId: string, excludeId?: string) {
  const conditions: any[] = [
    eq(courseAssessmentComponents.planId, planId),
    eq(courseAssessmentComponents.tenantId, tenantId),
    isNull(courseAssessmentComponents.deletedAt),
  ]
  if (excludeId) conditions.push(sql`${courseAssessmentComponents.id} != ${excludeId}::uuid`)

  const [{ total }] = await db
    .select({ total: sum(courseAssessmentComponents.weightPercentage) })
    .from(courseAssessmentComponents)
    .where(and(...conditions))

  return Number(total ?? 0)
}

export async function createComponent(
  tenantId: string,
  performedBy: string,
  planId: string,
  input: CreateComponentInput,
) {
  await assertDraftPlan(tenantId, planId)

  const existing = await currentTotalWeight(tenantId, planId)
  if (existing + input.weightPercentage > 100.001) {
    throw new Error(
      `Adding ${input.weightPercentage}% would exceed 100% (current total: ${existing.toFixed(2)}%).`
    )
  }

  // Auto order_no
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${courseAssessmentComponents.orderNo}), 0)` })
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.planId, planId),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))

  const [component] = await db
    .insert(courseAssessmentComponents)
    .values({
      tenantId,
      planId,
      name:             input.name,
      componentType:    input.componentType,
      weightPercentage: String(input.weightPercentage),
      totalMarks:       input.totalMarks ?? 100,
      assessmentCount:  input.assessmentCount ?? 1,
      cloMapped:        input.cloMapped ?? false,
      orderNo:          maxOrder + 1,
      createdBy:        performedBy,
      updatedBy:        performedBy,
    })
    .returning()

  return component
}

export async function updateComponent(
  tenantId: string,
  performedBy: string,
  componentId: string,
  input: UpdateComponentInput,
) {
  const [component] = await db
    .select({ id: courseAssessmentComponents.id, planId: courseAssessmentComponents.planId })
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.id, componentId),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))
    .limit(1)
  if (!component) throw new Error('Component not found.')

  await assertDraftPlan(tenantId, component.planId)

  if (input.weightPercentage !== undefined) {
    const existing = await currentTotalWeight(tenantId, component.planId, componentId)
    if (existing + input.weightPercentage > 100.001) {
      throw new Error(
        `Weight ${input.weightPercentage}% would exceed 100% (remaining capacity: ${(100 - existing).toFixed(2)}%).`
      )
    }
  }

  const updateData: Record<string, unknown> = { updatedBy: performedBy, updatedAt: new Date() }
  if (input.name             !== undefined) updateData.name             = input.name
  if (input.componentType    !== undefined) updateData.componentType    = input.componentType
  if (input.weightPercentage !== undefined) updateData.weightPercentage = String(input.weightPercentage)
  if (input.totalMarks       !== undefined) updateData.totalMarks       = input.totalMarks
  if (input.assessmentCount  !== undefined) updateData.assessmentCount  = input.assessmentCount
  if (input.cloMapped        !== undefined) updateData.cloMapped        = input.cloMapped

  const [after] = await db
    .update(courseAssessmentComponents)
    .set(updateData as any)
    .where(and(eq(courseAssessmentComponents.id, componentId), eq(courseAssessmentComponents.tenantId, tenantId)))
    .returning()

  return after
}

export async function deleteComponent(tenantId: string, performedBy: string, componentId: string) {
  const [component] = await db
    .select({ id: courseAssessmentComponents.id, planId: courseAssessmentComponents.planId })
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.id, componentId),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))
    .limit(1)
  if (!component) throw new Error('Component not found.')

  await assertDraftPlan(tenantId, component.planId)

  await db
    .update(courseAssessmentComponents)
    .set({ deletedAt: new Date(), deletedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseAssessmentComponents.id, componentId), eq(courseAssessmentComponents.tenantId, tenantId)))

  return { success: true }
}

// ── CLO Links ─────────────────────────────────────────────────────────────────

export async function addCloLink(
  tenantId: string,
  componentId: string,
  input: AddCloLinkInput,
) {
  const [component] = await db
    .select({ id: courseAssessmentComponents.id, planId: courseAssessmentComponents.planId })
    .from(courseAssessmentComponents)
    .where(and(
      eq(courseAssessmentComponents.id, componentId),
      eq(courseAssessmentComponents.tenantId, tenantId),
      isNull(courseAssessmentComponents.deletedAt),
    ))
    .limit(1)
  if (!component) throw new Error('Component not found.')

  await assertDraftPlan(tenantId, component.planId)

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

  const [link] = await db
    .insert(assessmentComponentClos)
    .values({
      tenantId,
      componentId,
      cloId:  input.cloId,
      weight: String(input.weight ?? 100),
    })
    .returning()

  return link
}

export async function removeCloLink(tenantId: string, linkId: string) {
  const [link] = await db
    .select({ id: assessmentComponentClos.id, componentId: assessmentComponentClos.componentId })
    .from(assessmentComponentClos)
    .where(and(
      eq(assessmentComponentClos.id, linkId),
      eq(assessmentComponentClos.tenantId, tenantId),
    ))
    .limit(1)
  if (!link) throw new Error('CLO link not found.')

  const [component] = await db
    .select({ planId: courseAssessmentComponents.planId })
    .from(courseAssessmentComponents)
    .where(eq(courseAssessmentComponents.id, link.componentId))
    .limit(1)
  if (component) await assertDraftPlan(tenantId, component.planId)

  await db
    .delete(assessmentComponentClos)
    .where(and(eq(assessmentComponentClos.id, linkId), eq(assessmentComponentClos.tenantId, tenantId)))

  return { success: true }
}
