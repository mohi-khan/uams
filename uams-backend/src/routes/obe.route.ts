import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createCloSchema, updateCloSchema,
  createPloSchema, updatePloSchema,
  createMappingSchema, updateMappingSchema,
} from '../lib/validators/obe.validator'
import {
  listClos, createClo, getCloById, updateClo, deleteClo, getCloAuditLogs,
  listPlos, createPlo, getPloById, updatePlo, deletePlo, getPloAuditLogs,
  listMappings, createMapping, updateMapping, deleteMapping,
} from '../services/obe.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const obeRoute = new Hono<{ Variables: Variables }>()

obeRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean', 'teacher')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')
const auditRbac = rbac('admin', 'super_admin')

// ── CLO endpoints ─────────────────────────────────────────────────────────────

obeRoute.get('/clos', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const courseId = c.req.query('courseId')
  if (!courseId) return c.json({ error: 'courseId query param is required.' }, 400)
  try {
    return c.json({ data: await listClos(tenantId, courseId) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

obeRoute.post('/clos', writeRbac, zValidator('json', createCloSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createClo(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

obeRoute.get('/clos/:id/audit', auditRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getCloAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

obeRoute.get('/clos/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getCloById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

obeRoute.put('/clos/:id', writeRbac, zValidator('json', updateCloSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateClo(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

obeRoute.delete('/clos/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteClo(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// ── PLO endpoints ─────────────────────────────────────────────────────────────

obeRoute.get('/plos', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const programId = c.req.query('programId')
  if (!programId) return c.json({ error: 'programId query param is required.' }, 400)
  try {
    return c.json({ data: await listPlos(tenantId, programId) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

obeRoute.post('/plos', writeRbac, zValidator('json', createPloSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createPlo(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

obeRoute.get('/plos/:id/audit', auditRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getPloAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

obeRoute.get('/plos/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getPloById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

obeRoute.put('/plos/:id', writeRbac, zValidator('json', updatePloSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updatePlo(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

obeRoute.delete('/plos/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deletePlo(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// ── Mapping endpoints ─────────────────────────────────────────────────────────

obeRoute.get('/mappings', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const cloId    = c.req.query('cloId')
  const ploId    = c.req.query('ploId')
  const courseId = c.req.query('courseId')
  if (!cloId && !ploId && !courseId) return c.json({ error: 'At least one of cloId, ploId, or courseId is required.' }, 400)
  try {
    return c.json({ data: await listMappings(tenantId, cloId, ploId, courseId) })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

obeRoute.post('/mappings', writeRbac, zValidator('json', createMappingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createMapping(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

obeRoute.put('/mappings/:id', writeRbac, zValidator('json', updateMappingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateMapping(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

obeRoute.delete('/mappings/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteMapping(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default obeRoute
