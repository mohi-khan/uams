import { eq, and, isNull, desc, asc, inArray, max, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { users } from '../db/schema/users'
import { courses, auditActionEnum } from '../db/schema/academic'
import { courseSyllabi, syllabusTopics, syllabusAuditLogs } from '../db/schema/syllabus'
import type { CreateSyllabusInput, UpsertTopicInput, UpdateTopicInput, ReorderTopicsInput } from '../lib/validators/syllabus.validator'

type ViewerRole = 'admin' | 'super_admin' | 'academic_coordinator' | 'dean' | 'teacher' | 'student'

// ── Helpers ───────────────────────────────────────────────────────────────────

function canSeeDraft(role: ViewerRole) {
  return ['admin', 'super_admin', 'academic_coordinator'].includes(role)
}

function nextVersion(existing: string[]): string {
  if (existing.length === 0) return 'v1'
  const nums = existing
    .map(v => parseInt(v.replace('v', ''), 10))
    .filter(n => !isNaN(n))
  return `v${Math.max(...nums) + 1}`
}

// ── Syllabi ───────────────────────────────────────────────────────────────────

export async function listSyllabiForCourse(tenantId: string, courseId: string, role: ViewerRole) {
  const conditions = [
    eq(courseSyllabi.tenantId, tenantId),
    eq(courseSyllabi.courseId, courseId),
    isNull(courseSyllabi.deletedAt),
  ]
  if (!canSeeDraft(role)) conditions.push(eq(courseSyllabi.status, 'final'))

  return db
    .select({
      id:        courseSyllabi.id,
      courseId:  courseSyllabi.courseId,
      version:   courseSyllabi.version,
      isDefault: courseSyllabi.isDefault,
      status:    courseSyllabi.status,
      createdAt: courseSyllabi.createdAt,
      updatedAt: courseSyllabi.updatedAt,
    })
    .from(courseSyllabi)
    .where(and(...conditions))
    .orderBy(desc(courseSyllabi.createdAt))
}

export async function createSyllabus(tenantId: string, performedBy: string, input: CreateSyllabusInput) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), eq(courses.tenantId, tenantId), isNull(courses.deletedAt)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  const existing = await db
    .select({ version: courseSyllabi.version })
    .from(courseSyllabi)
    .where(and(
      eq(courseSyllabi.tenantId, tenantId),
      eq(courseSyllabi.courseId, input.courseId),
      isNull(courseSyllabi.deletedAt),
    ))

  const version   = nextVersion(existing.map(r => r.version))
  const isDefault = existing.length === 0

  const [syllabus] = await db
    .insert(courseSyllabi)
    .values({
      tenantId,
      courseId:  input.courseId,
      version,
      isDefault,
      status:    'draft',
      createdBy: performedBy,
      updatedBy: performedBy,
    })
    .returning()

  await db.insert(syllabusAuditLogs).values({
    tenantId,
    syllabusId:  syllabus.id,
    action:      'CREATE',
    performedBy,
    snapshot:    syllabus as any,
  })

  return syllabus
}

export async function getSyllabusWithTopics(tenantId: string, syllabusId: string, role: ViewerRole) {
  const conditions = [
    eq(courseSyllabi.id, syllabusId),
    eq(courseSyllabi.tenantId, tenantId),
    isNull(courseSyllabi.deletedAt),
  ]
  if (!canSeeDraft(role)) conditions.push(eq(courseSyllabi.status, 'final'))

  const [syllabus] = await db
    .select()
    .from(courseSyllabi)
    .where(and(...conditions))
    .limit(1)
  if (!syllabus) throw new Error('Syllabus not found.')

  const topics = await db
    .select()
    .from(syllabusTopics)
    .where(and(eq(syllabusTopics.syllabusId, syllabusId), eq(syllabusTopics.tenantId, tenantId)))
    .orderBy(asc(syllabusTopics.orderNo), asc(syllabusTopics.createdAt))

  return { ...syllabus, topics }
}

export async function finalizeSyllabus(tenantId: string, performedBy: string, syllabusId: string) {
  const [syllabus] = await db
    .select()
    .from(courseSyllabi)
    .where(and(
      eq(courseSyllabi.id, syllabusId),
      eq(courseSyllabi.tenantId, tenantId),
      isNull(courseSyllabi.deletedAt),
    ))
    .limit(1)
  if (!syllabus) throw new Error('Syllabus not found.')
  if (syllabus.status === 'final') throw new Error('Syllabus is already finalized.')

  const [after] = await db
    .update(courseSyllabi)
    .set({ status: 'final', updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseSyllabi.id, syllabusId), eq(courseSyllabi.tenantId, tenantId)))
    .returning()

  await db
    .update(syllabusTopics)
    .set({ status: 'final', updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(syllabusTopics.syllabusId, syllabusId), eq(syllabusTopics.tenantId, tenantId)))

  await db.insert(syllabusAuditLogs).values({
    tenantId,
    syllabusId,
    action:      'UPDATE',
    performedBy,
    snapshot:    { action: 'finalize', before: syllabus, after } as any,
  })

  return after
}

export async function setDefaultSyllabus(tenantId: string, performedBy: string, syllabusId: string) {
  const [syllabus] = await db
    .select()
    .from(courseSyllabi)
    .where(and(
      eq(courseSyllabi.id, syllabusId),
      eq(courseSyllabi.tenantId, tenantId),
      isNull(courseSyllabi.deletedAt),
    ))
    .limit(1)
  if (!syllabus) throw new Error('Syllabus not found.')
  if (syllabus.status !== 'final') throw new Error('Only a finalized syllabus can be set as default.')

  // Clear existing default for this course
  await db
    .update(courseSyllabi)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(
      eq(courseSyllabi.tenantId, tenantId),
      eq(courseSyllabi.courseId, syllabus.courseId),
      eq(courseSyllabi.isDefault, true),
    ))

  const [after] = await db
    .update(courseSyllabi)
    .set({ isDefault: true, updatedBy: performedBy, updatedAt: new Date() })
    .where(and(eq(courseSyllabi.id, syllabusId), eq(courseSyllabi.tenantId, tenantId)))
    .returning()

  await db.insert(syllabusAuditLogs).values({
    tenantId,
    syllabusId,
    action:      'UPDATE',
    performedBy,
    snapshot:    { action: 'set-default' } as any,
  })

  return after
}

export async function deleteSyllabus(tenantId: string, performedBy: string, syllabusId: string) {
  const [syllabus] = await db
    .select()
    .from(courseSyllabi)
    .where(and(
      eq(courseSyllabi.id, syllabusId),
      eq(courseSyllabi.tenantId, tenantId),
      isNull(courseSyllabi.deletedAt),
    ))
    .limit(1)
  if (!syllabus) throw new Error('Syllabus not found.')
  if (syllabus.status === 'final') throw new Error('Finalized syllabi cannot be deleted.')

  await db
    .update(courseSyllabi)
    .set({ deletedAt: new Date(), deletedBy: performedBy })
    .where(and(eq(courseSyllabi.id, syllabusId), eq(courseSyllabi.tenantId, tenantId)))

  await db.insert(syllabusAuditLogs).values({
    tenantId,
    syllabusId,
    action:      'DELETE',
    performedBy,
    snapshot:    syllabus as any,
  })

  return { success: true }
}

export async function getSyllabusAuditLogs(tenantId: string, syllabusId: string) {
  const [s] = await db
    .select({ id: courseSyllabi.id })
    .from(courseSyllabi)
    .where(and(eq(courseSyllabi.id, syllabusId), eq(courseSyllabi.tenantId, tenantId)))
    .limit(1)
  if (!s) throw new Error('Syllabus not found.')

  return db
    .select({
      id:              syllabusAuditLogs.id,
      action:          syllabusAuditLogs.action,
      performedByName: sql<string>`coalesce(concat(${users.firstName}, ' ', ${users.lastName}), 'System')`,
      snapshot:        syllabusAuditLogs.snapshot,
      createdAt:       syllabusAuditLogs.createdAt,
    })
    .from(syllabusAuditLogs)
    .leftJoin(users, eq(syllabusAuditLogs.performedBy, users.id))
    .where(and(
      eq(syllabusAuditLogs.tenantId, tenantId),
      eq(syllabusAuditLogs.syllabusId, syllabusId),
    ))
    .orderBy(desc(syllabusAuditLogs.createdAt))
}

// ── Topics ────────────────────────────────────────────────────────────────────

async function assertDraftSyllabus(tenantId: string, syllabusId: string) {
  const [syllabus] = await db
    .select({ status: courseSyllabi.status })
    .from(courseSyllabi)
    .where(and(
      eq(courseSyllabi.id, syllabusId),
      eq(courseSyllabi.tenantId, tenantId),
      isNull(courseSyllabi.deletedAt),
    ))
    .limit(1)
  if (!syllabus) throw new Error('Syllabus not found.')
  if (syllabus.status === 'final') throw new Error('Cannot modify a finalized syllabus. Create a new version.')
  return syllabus
}

export async function createTopic(
  tenantId: string,
  performedBy: string,
  syllabusId: string,
  input: UpsertTopicInput,
) {
  await assertDraftSyllabus(tenantId, syllabusId)

  const [maxRow] = await db
    .select({ mx: sql<number>`coalesce(max(${syllabusTopics.orderNo}), 0)` })
    .from(syllabusTopics)
    .where(and(eq(syllabusTopics.syllabusId, syllabusId), eq(syllabusTopics.tenantId, tenantId)))

  const orderNo = input.orderNo ?? (Number(maxRow?.mx ?? 0) + 1)

  const [topic] = await db
    .insert(syllabusTopics)
    .values({
      tenantId,
      syllabusId,
      title:          input.title,
      description:    input.description ?? null,
      orderNo,
      estimatedHours: input.estimatedHours != null ? String(input.estimatedHours) : null,
      status:         'draft',
      createdBy:      performedBy,
      updatedBy:      performedBy,
    })
    .returning()

  return topic
}

export async function updateTopic(
  tenantId: string,
  performedBy: string,
  topicId: string,
  input: UpdateTopicInput,
) {
  const [topic] = await db
    .select({ id: syllabusTopics.id, syllabusId: syllabusTopics.syllabusId, status: syllabusTopics.status })
    .from(syllabusTopics)
    .where(and(eq(syllabusTopics.id, topicId), eq(syllabusTopics.tenantId, tenantId)))
    .limit(1)
  if (!topic) throw new Error('Topic not found.')

  await assertDraftSyllabus(tenantId, topic.syllabusId)

  const updateData: Record<string, unknown> = { updatedBy: performedBy, updatedAt: new Date() }
  if (input.title          !== undefined) updateData.title          = input.title
  if (input.description    !== undefined) updateData.description    = input.description
  if (input.orderNo        !== undefined) updateData.orderNo        = input.orderNo
  if (input.estimatedHours !== undefined) {
    updateData.estimatedHours = input.estimatedHours != null ? String(input.estimatedHours) : null
  }

  const [after] = await db
    .update(syllabusTopics)
    .set(updateData as any)
    .where(and(eq(syllabusTopics.id, topicId), eq(syllabusTopics.tenantId, tenantId)))
    .returning()

  return after
}

export async function deleteTopic(tenantId: string, performedBy: string, topicId: string) {
  const [topic] = await db
    .select({ id: syllabusTopics.id, syllabusId: syllabusTopics.syllabusId })
    .from(syllabusTopics)
    .where(and(eq(syllabusTopics.id, topicId), eq(syllabusTopics.tenantId, tenantId)))
    .limit(1)
  if (!topic) throw new Error('Topic not found.')

  await assertDraftSyllabus(tenantId, topic.syllabusId)

  await db
    .delete(syllabusTopics)
    .where(and(eq(syllabusTopics.id, topicId), eq(syllabusTopics.tenantId, tenantId)))

  return { success: true }
}

export async function reorderTopics(
  tenantId: string,
  syllabusId: string,
  input: ReorderTopicsInput,
) {
  await assertDraftSyllabus(tenantId, syllabusId)

  await Promise.all(
    input.orderedIds.map((id, idx) =>
      db
        .update(syllabusTopics)
        .set({ orderNo: idx + 1, updatedAt: new Date() })
        .where(and(
          eq(syllabusTopics.id, id),
          eq(syllabusTopics.syllabusId, syllabusId),
          eq(syllabusTopics.tenantId, tenantId),
        )),
    ),
  )

  return { success: true }
}
