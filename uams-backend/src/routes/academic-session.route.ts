import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createSessionSchema, updateSessionSchema } from '../lib/validators/academic.validator'
import {
  createSession, listSessions, getSessionById,
  updateSession, deleteSession, getSessionAuditLogs,
} from '../services/academic-session.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const sessionRoute = new Hono<{ Variables: Variables }>()

sessionRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin')

sessionRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page   = Number(c.req.query('page')  ?? 1)
  const limit  = Number(c.req.query('limit') ?? 20)
  const search = c.req.query('search')
  return c.json(await listSessions(tenantId, page, limit, search))
})

sessionRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getSessionAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

sessionRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getSessionById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

sessionRoute.post('/', writeRbac, zValidator('json', createSessionSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createSession(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

sessionRoute.put('/:id', writeRbac, zValidator('json', updateSessionSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateSession(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

sessionRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteSession(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default sessionRoute
