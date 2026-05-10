import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import { createCourseSchema, updateCourseSchema, addPrerequisiteSchema } from '../lib/validators/academic.validator'
import {
  createCourse, listCourses, getCourseById,
  updateCourse, deleteCourse, getCourseAuditLogs,
} from '../services/course.service'
import {
  listPrerequisites, addPrerequisite, removePrerequisite,
} from '../services/course-prerequisite.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const courseRoute = new Hono<{ Variables: Variables }>()

courseRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator')
const writeRbac = rbac('admin', 'super_admin')

courseRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page         = Number(c.req.query('page')  ?? 1)
  const limit        = Number(c.req.query('limit') ?? 20)
  const departmentId = c.req.query('departmentId')
  const search       = c.req.query('search')
  return c.json(await listCourses(tenantId, page, limit, departmentId, search))
})

courseRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getCourseAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Prerequisites ─────────────────────────────────────────────────────────────

courseRoute.get('/:id/prerequisites', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await listPrerequisites(tenantId, c.req.param('id')) })
  } catch (err: any) {
    console.error(err)
    return c.json({ error: err.message }, 500)
  }
})

courseRoute.post('/:id/prerequisites', writeRbac, zValidator('json', addPrerequisiteSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await addPrerequisite(tenantId, sub, c.req.param('id'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

courseRoute.delete('/:id/prerequisites/:prereqId', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await removePrerequisite(tenantId, c.req.param('id'), c.req.param('prereqId')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ─────────────────────────────────────────────────────────────────────────────

courseRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getCourseById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

courseRoute.post('/', writeRbac, zValidator('json', createCourseSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createCourse(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

courseRoute.put('/:id', writeRbac, zValidator('json', updateCourseSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateCourse(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

courseRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteCourse(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default courseRoute
