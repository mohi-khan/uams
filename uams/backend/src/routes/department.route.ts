import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createDepartmentSchema, updateDepartmentSchema } from '../lib/validators/academic.validator'
import {
  createDepartment, listDepartments, getDepartmentById,
  updateDepartment, deleteDepartment, getDepartmentAuditLogs,
} from '../services/department.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const departmentRoute = new Hono<{ Variables: Variables }>()

departmentRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator')
const writeRbac = rbac('admin', 'super_admin')

departmentRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page      = Number(c.req.query('page')  ?? 1)
  const limit     = Number(c.req.query('limit') ?? 20)
  const facultyId = c.req.query('facultyId')
  const search    = c.req.query('search')
  return c.json(await listDepartments(tenantId, page, limit, facultyId, search))
})

departmentRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getDepartmentAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

departmentRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getDepartmentById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

departmentRoute.post('/', writeRbac, zValidator('json', createDepartmentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createDepartment(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

departmentRoute.put('/:id', writeRbac, zValidator('json', updateDepartmentSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateDepartment(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

departmentRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteDepartment(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default departmentRoute
