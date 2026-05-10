import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createSemesterOfferingSchema, updateSemesterOfferingSchema,
  createCourseOfferingSchema,   updateCourseOfferingSchema,
  bulkSaveCourseOfferingsSchema,
} from '../lib/validators/scheduling.validator'
import {
  listSemesterOfferings, getSemesterOfferingById, createSemesterOffering,
  updateSemesterOffering, deleteSemesterOffering, getSemesterOfferingAuditLogs,
  listCourseOfferings, getAvailableCourses,
  createCourseOffering, updateCourseOffering, deleteCourseOffering,
  bulkSaveCourseOfferings, getCourseOfferingAuditLogs,
} from '../services/scheduling.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const schedulingRoute = new Hono<{ Variables: Variables }>()

schedulingRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')

// ── Semester Offerings ────────────────────────────────────────────────────────

schedulingRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page       = Number(c.req.query('page')       ?? 1)
  const limit      = Number(c.req.query('limit')      ?? 50)
  const programId  = c.req.query('programId')
  const sessionId  = c.req.query('sessionId')
  const semesterNo = c.req.query('semesterNo') ? Number(c.req.query('semesterNo')) : undefined
  const status     = c.req.query('status')
  return c.json(await listSemesterOfferings(tenantId, page, limit, { programId, sessionId, semesterNo, status }))
})

schedulingRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getSemesterOfferingAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

schedulingRoute.get('/:id/courses/available', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getAvailableCourses(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

schedulingRoute.get('/:id/courses', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  return c.json({ data: await listCourseOfferings(tenantId, c.req.param('id')) })
})

schedulingRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getSemesterOfferingById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

schedulingRoute.post('/', writeRbac, zValidator('json', createSemesterOfferingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createSemesterOffering(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('already exists') ? 409 : 400)
  }
})

schedulingRoute.put('/:id', writeRbac, zValidator('json', updateSemesterOfferingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateSemesterOffering(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

schedulingRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    await deleteSemesterOffering(tenantId, sub, c.req.param('id'))
    return c.json({ message: 'Deleted.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Course Offerings ──────────────────────────────────────────────────────────

schedulingRoute.post('/:id/courses/bulk', writeRbac, zValidator('json', bulkSaveCourseOfferingsSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  const body = c.req.valid('json')
  if (body.semesterOfferingId !== c.req.param('id')) {
    return c.json({ error: 'semesterOfferingId mismatch.' }, 400)
  }
  try {
    return c.json({ data: await bulkSaveCourseOfferings(tenantId, sub, body) })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

schedulingRoute.post('/:id/courses', writeRbac, zValidator('json', createCourseOfferingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  const body = c.req.valid('json')
  if (body.semesterOfferingId !== c.req.param('id')) {
    return c.json({ error: 'semesterOfferingId mismatch.' }, 400)
  }
  try {
    return c.json(await createCourseOffering(tenantId, sub, body), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('already exists') ? 409 : 400)
  }
})

schedulingRoute.get('/:id/courses/:courseOffId/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getCourseOfferingAuditLogs(tenantId, c.req.param('courseOffId')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

schedulingRoute.put('/:id/courses/:courseOffId', writeRbac, zValidator('json', updateCourseOfferingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateCourseOffering(tenantId, sub, c.req.param('courseOffId'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

schedulingRoute.delete('/:id/courses/:courseOffId', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    await deleteCourseOffering(tenantId, sub, c.req.param('courseOffId'))
    return c.json({ message: 'Deleted.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default schedulingRoute
