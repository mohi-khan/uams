import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createFeeStructureSchema, updateFeeStructureSchema } from '../lib/validators/enrollment-txn.validator'
import {
  listFeeStructures, createFeeStructure, updateFeeStructure,
  deleteFeeStructure, getFeeStructureAuditLogs,
} from '../services/fee-structure.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const feeStructureRoute = new Hono<{ Variables: Variables }>()

feeStructureRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')

feeStructureRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page      = Number(c.req.query('page')      ?? 1)
  const limit     = Number(c.req.query('limit')     ?? 50)
  const programId = c.req.query('programId')
  const search    = c.req.query('search')
  return c.json(await listFeeStructures(tenantId, page, limit, programId, search))
})

feeStructureRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getFeeStructureAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

feeStructureRoute.post('/', writeRbac, zValidator('json', createFeeStructureSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createFeeStructure(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

feeStructureRoute.put('/:id', writeRbac, zValidator('json', updateFeeStructureSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateFeeStructure(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

feeStructureRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    await deleteFeeStructure(tenantId, sub, c.req.param('id'))
    return c.json({ message: 'Deleted.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default feeStructureRoute
