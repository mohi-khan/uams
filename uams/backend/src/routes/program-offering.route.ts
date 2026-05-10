import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createProgramOfferingSchema, updateProgramOfferingSchema, bulkSaveOfferingsSchema } from '../lib/validators/enrollment-txn.validator'
import {
  listProgramOfferings, createProgramOffering,
  updateProgramOffering, deleteProgramOffering,
  getProgramOfferingAuditLogs, bulkSaveOfferings,
} from '../services/program-offering.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const offeringRoute = new Hono<{ Variables: Variables }>()

offeringRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin', 'academic_coordinator')

offeringRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page      = Number(c.req.query('page')      ?? 1)
  const limit     = Number(c.req.query('limit')     ?? 50)
  const programId = c.req.query('programId')
  const sessionId = c.req.query('sessionId')
  const status    = c.req.query('status')
  return c.json(await listProgramOfferings(tenantId, page, limit, { programId, sessionId, status }))
})

offeringRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getProgramOfferingAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

offeringRoute.post('/bulk', writeRbac, zValidator('json', bulkSaveOfferingsSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await bulkSaveOfferings(tenantId, sub, c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

offeringRoute.post('/', writeRbac, zValidator('json', createProgramOfferingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createProgramOffering(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('already exists') ? 409 : 400)
  }
})

offeringRoute.put('/:id', writeRbac, zValidator('json', updateProgramOfferingSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateProgramOffering(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

offeringRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    await deleteProgramOffering(tenantId, sub, c.req.param('id'))
    return c.json({ message: 'Deleted.' })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default offeringRoute
