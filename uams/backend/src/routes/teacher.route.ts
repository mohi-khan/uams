import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createTeacherSchema, updateTeacherSchema } from '../lib/validators/academic.validator'
import {
  createTeacher, listTeachers, getTeacherById,
  updateTeacher, toggleTeacherStatus, resendTeacherInvitation,
  getTeacherAuditLogs, getMyAssignedCourses,
} from '../services/teacher.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const teacherRoute = new Hono<{ Variables: Variables }>()

teacherRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator', 'dean')
const writeRbac = rbac('admin', 'super_admin')

teacherRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page         = Number(c.req.query('page')         ?? 1)
  const limit        = Number(c.req.query('limit')        ?? 20)
  const departmentId = c.req.query('departmentId')
  const facultyId    = c.req.query('facultyId')
  const search       = c.req.query('search')
  return c.json(await listTeachers(tenantId, page, limit, departmentId, facultyId, search))
})

teacherRoute.get('/me/courses', rbac('teacher'), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await getMyAssignedCourses(tenantId, sub))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

teacherRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getTeacherAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

teacherRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getTeacherById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

teacherRoute.post('/', writeRbac, zValidator('json', createTeacherSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createTeacher(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

teacherRoute.put('/:id', writeRbac, zValidator('json', updateTeacherSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateTeacher(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

teacherRoute.patch('/:id/toggle-status', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await toggleTeacherStatus(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

teacherRoute.post('/:id/resend-invitation', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await resendTeacherInvitation(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default teacherRoute
