import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createSlotSchema, updateSlotSchema, bulkCreateSlotsSchema,
} from '../lib/validators/timetable.validator'
import {
  listSlots, createSlot, updateSlot, deleteSlot, bulkUpsertSlots,
} from '../services/timetable.service'

const slotsRoute = new Hono()
const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean', 'teacher')
const writeRbac = rbac('admin', 'super_admin')

slotsRoute.use('*', authMiddleware)

slotsRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const activeOnly   = c.req.query('active') === 'true'
  return c.json({ data: await listSlots(tenantId, activeOnly) })
})

slotsRoute.post('/', writeRbac, zValidator('json', createSlotSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await createSlot(tenantId, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message.includes('unique') ? 'A slot with that name already exists.' : err.message }, 400)
  }
})

slotsRoute.post('/bulk', writeRbac, zValidator('json', bulkCreateSlotsSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    const result = await bulkUpsertSlots(tenantId, c.req.valid('json').rows)
    return c.json({ inserted: result.length, data: result }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

slotsRoute.put('/:id', writeRbac, zValidator('json', updateSlotSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await updateSlot(tenantId, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

slotsRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await deleteSlot(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default slotsRoute
