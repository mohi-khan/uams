import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createBatchSchema, updateBatchSchema } from '../lib/validators/enrollment.validator'
import {
  createBatch, listBatches, getBatchById,
  updateBatch, deleteBatch, getBatchAuditLogs,
} from '../services/batch.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const batchRoute = new Hono<{ Variables: Variables }>()

batchRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')

batchRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page      = Number(c.req.query('page')  ?? 1)
  const limit     = Number(c.req.query('limit') ?? 20)
  const programId = c.req.query('programId')
  const search    = c.req.query('search')
  return c.json(await listBatches(tenantId, page, limit, programId, search))
})

batchRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getBatchAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

batchRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getBatchById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

batchRoute.post('/', writeRbac, zValidator('json', createBatchSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createBatch(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

batchRoute.put('/:id', writeRbac, zValidator('json', updateBatchSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateBatch(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

batchRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteBatch(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default batchRoute
