import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  createProgramSchema, updateProgramSchema,
  addProgramCourseSchema, updateProgramCourseSchema,
} from '../lib/validators/academic.validator'
import {
  createProgram, listPrograms, getProgramById,
  updateProgram, deleteProgram, getProgramAuditLogs,
} from '../services/program.service'
import {
  listProgramCourses, addCourseToProgram,
  updateProgramCourse, removeCourseFromProgram,
} from '../services/program-course.service'
import type { JwtPayload } from '../types'

type Variables = { user: JwtPayload }
const programRoute = new Hono<{ Variables: Variables }>()

programRoute.use('*', authMiddleware)

const readRbac  = rbac('admin', 'super_admin', 'academic_coordinator')
const writeRbac = rbac('admin', 'super_admin')

// ── Program CRUD ──────────────────────────────────────────────────────────────

programRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const page         = Number(c.req.query('page')  ?? 1)
  const limit        = Number(c.req.query('limit') ?? 20)
  const departmentId = c.req.query('departmentId')
  const search       = c.req.query('search')
  return c.json(await listPrograms(tenantId, page, limit, departmentId, search))
})

programRoute.get('/:id/audit', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await getProgramAuditLogs(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Program-Course mapping ────────────────────────────────────────────────────

programRoute.get('/:id/courses', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json({ data: await listProgramCourses(tenantId, c.req.param('id')) })
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

programRoute.post('/:id/courses', writeRbac, zValidator('json', addProgramCourseSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await addCourseToProgram(tenantId, sub, c.req.param('id'), c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

programRoute.put('/:id/courses/:mappingId', writeRbac, zValidator('json', updateProgramCourseSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await updateProgramCourse(
      tenantId, c.req.param('id'), c.req.param('mappingId'), c.req.valid('json'),
    ))
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

programRoute.delete('/:id/courses/:mappingId', writeRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await removeCourseFromProgram(tenantId, c.req.param('id'), c.req.param('mappingId')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

// ── Single program (after nested routes to avoid param conflicts) ──────────────

programRoute.get('/:id', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  try {
    return c.json(await getProgramById(tenantId, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

programRoute.post('/', writeRbac, zValidator('json', createProgramSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await createProgram(tenantId, sub, c.req.valid('json')), 201)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

programRoute.put('/:id', writeRbac, zValidator('json', updateProgramSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateProgram(tenantId, sub, c.req.param('id'), c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

programRoute.delete('/:id', writeRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await deleteProgram(tenantId, sub, c.req.param('id')))
  } catch (err: any) {
    return c.json({ error: err.message }, 404)
  }
})

export default programRoute
