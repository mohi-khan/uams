import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createRoomSchema, updateRoomSchema, bulkCreateRoomsSchema,
} from '../lib/validators/timetable.validator'
import {
  listRooms, createRoom, updateRoom, deleteRoom, bulkUpsertRooms,
} from '../services/timetable.service'

const roomsRoute = new Hono()
const readRbac   = rbac('admin', 'super_admin', 'academic_coordinator', 'dean', 'teacher')
const writeRbac  = rbac('admin', 'super_admin')

roomsRoute.use('*', authMiddleware)

roomsRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const activeOnly   = c.req.query('active') === 'true'
  const type         = c.req.query('type') as 'THEORY' | 'LAB' | undefined
  return c.json({ data: await listRooms(tenantId, activeOnly, type) })
})

roomsRoute.post('/', writeRbac, zValidator('json', createRoomSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await createRoom(tenantId, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message.includes('unique') ? 'A room with that name already exists.' : err.message }, 400)
  }
})

roomsRoute.post('/bulk', writeRbac, zValidator('json', bulkCreateRoomsSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    const result = await bulkUpsertRooms(tenantId, c.req.valid('json').rows)
    return c.json({ inserted: result.length, data: result }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

roomsRoute.put('/:id', writeRbac, zValidator('json', updateRoomSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await updateRoom(tenantId, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

roomsRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await deleteRoom(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default roomsRoute
