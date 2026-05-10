import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createSyllabusSchema,
  upsertTopicSchema,
  updateTopicSchema,
  reorderTopicsSchema,
} from '../lib/validators/syllabus.validator'
import {
  listSyllabiForCourse,
  createSyllabus,
  getSyllabusWithTopics,
  finalizeSyllabus,
  setDefaultSyllabus,
  deleteSyllabus,
  getSyllabusAuditLogs,
  createTopic,
  updateTopic,
  deleteTopic,
  reorderTopics,
} from '../services/syllabus.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const syllabusRoute = new Hono<{ Variables: Variables }>()

syllabusRoute.use('*', authMiddleware)

const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')
const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean', 'teacher', 'student')

// ── Syllabi ───────────────────────────────────────────────────────────────────

syllabusRoute.get('/', readRbac, async (c) => {
  const { tenantId, role } = c.get('user')
  const courseId = c.req.query('courseId')
  if (!courseId) return c.json({ error: 'courseId query param is required.' }, 400)
  return c.json({ data: await listSyllabiForCourse(tenantId, courseId, role as any) })
})

syllabusRoute.post('/', writeRbac, zValidator('json', createSyllabusSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createSyllabus(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

syllabusRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getSyllabusAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

syllabusRoute.put('/:id/finalize', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await finalizeSyllabus(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

syllabusRoute.put('/:id/set-default', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await setDefaultSyllabus(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// ── Topics ────────────────────────────────────────────────────────────────────

syllabusRoute.post('/:id/topics', writeRbac, zValidator('json', upsertTopicSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createTopic(tenantId, sub, c.req.param('id'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

syllabusRoute.put('/:id/topics/reorder', writeRbac, zValidator('json', reorderTopicsSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await reorderTopics(tenantId, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

syllabusRoute.put('/:id/topics/:topicId', writeRbac, zValidator('json', updateTopicSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateTopic(tenantId, sub, c.req.param('topicId'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

syllabusRoute.delete('/:id/topics/:topicId', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteTopic(tenantId, sub, c.req.param('topicId')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

syllabusRoute.get('/:id', readRbac, async (c) => {
  const { tenantId, role } = c.get('user')
  try {
    return c.json(await getSyllabusWithTopics(tenantId, c.req.param('id'), role as any))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

syllabusRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteSyllabus(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default syllabusRoute
