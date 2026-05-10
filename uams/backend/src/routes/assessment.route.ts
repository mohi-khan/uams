import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createAssessmentPlanSchema,
  copyAssessmentPlanSchema,
  createComponentSchema,
  updateComponentSchema,
  addCloLinkSchema,
} from '../lib/validators/assessment.validator'
import {
  listPlans, createPlan, copyPlan, getPlanWithComponents,
  finalizePlan, setDefaultPlan, deletePlan, getPlanAuditLogs,
  createComponent, updateComponent, deleteComponent,
  addCloLink, removeCloLink,
} from '../services/assessment.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const assessmentRoute = new Hono<{ Variables: Variables }>()

assessmentRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean', 'teacher', 'student')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')

// ── Plans ─────────────────────────────────────────────────────────────────────

assessmentRoute.get('/', readRbac, async (c) => {
  const { tenantId, role } = c.get('user')
  const courseId  = c.req.query('courseId')
  const sessionId = c.req.query('sessionId')
  if (!courseId) return c.json({ error: 'courseId query param is required.' }, 400)
  return c.json({ data: await listPlans(tenantId, courseId, sessionId, role as any) })
})

assessmentRoute.post('/', writeRbac, zValidator('json', createAssessmentPlanSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createPlan(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

assessmentRoute.post('/copy', writeRbac, zValidator('json', copyAssessmentPlanSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await copyPlan(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

assessmentRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getPlanAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

assessmentRoute.put('/:id/finalize', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await finalizePlan(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

assessmentRoute.put('/:id/set-default', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await setDefaultPlan(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// ── Components — declare specific sub-paths before :id ────────────────────────

assessmentRoute.post('/:id/components', writeRbac, zValidator('json', createComponentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createComponent(tenantId, sub, c.req.param('id'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

assessmentRoute.put('/:id/components/:componentId', writeRbac, zValidator('json', updateComponentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateComponent(tenantId, sub, c.req.param('componentId'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

assessmentRoute.delete('/:id/components/:componentId', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteComponent(tenantId, sub, c.req.param('componentId')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// ── CLO Links ─────────────────────────────────────────────────────────────────

assessmentRoute.post('/:id/components/:componentId/clos', writeRbac, zValidator('json', addCloLinkSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await addCloLink(tenantId, c.req.param('componentId'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

assessmentRoute.delete('/:id/components/:componentId/clos/:linkId', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await removeCloLink(tenantId, c.req.param('linkId')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// ── Get plan with components (must be after sub-routes) ───────────────────────

assessmentRoute.get('/:id', readRbac, async (c) => {
  const { tenantId, role } = c.get('user')
  try {
    return c.json(await getPlanWithComponents(tenantId, c.req.param('id'), role as any))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

assessmentRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deletePlan(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default assessmentRoute
