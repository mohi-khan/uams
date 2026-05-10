import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createFacultySchema, updateFacultySchema } from '../lib/validators/academic.validator'
import {
  createFaculty, listFaculties, getFacultyById,
  updateFaculty, deleteFaculty, getFacultyAuditLogs,
} from '../services/faculty.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const facultyRoute = new Hono<{ Variables: Variables }>()

facultyRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator')
const writeRbac = rbac('admin', 'super_admin')

facultyRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page   = Number(c.req.query('page')  ?? 1)
  const limit  = Number(c.req.query('limit') ?? 20)
  const search = c.req.query('search')
  return c.json(await listFaculties(tenantId, page, limit, search))
})

facultyRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getFacultyAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

facultyRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getFacultyById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

facultyRoute.post('/', writeRbac, zValidator('json', createFacultySchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createFaculty(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

facultyRoute.put('/:id', writeRbac, zValidator('json', updateFacultySchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateFaculty(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

facultyRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteFaculty(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default facultyRoute
