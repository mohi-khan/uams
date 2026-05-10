import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { rbac } from '../middleware/rbac'
import {
  bulkCreateSchedulesSchema,
  checkConflictsSchema,
  updateScheduleSchema,
} from '../lib/validators/class-schedule.validator'
import {
  getPendingRoutineCount,
  listOfferingsForRoutine,
  checkConflicts,
  bulkCreateSchedules,
  listSchedulesByOffering,
  updateSchedule,
  cancelSchedule,
  getMyUpcomingClasses,
  getStudentSchedule,
  getStudentUpcomingTomorrow,
} from '../services/class-schedule.service'

const classScheduleRoute = new Hono()
const coordRbac   = rbac('admin', 'super_admin', 'academic_coordinator')
const readRbac    = rbac('admin', 'super_admin', 'academic_coordinator', 'dean', 'teacher')
const teacherRbac = rbac('teacher')
const studentRbac = rbac('student')

classScheduleRoute.use('*', authMiddleware)

// Student: full schedule for all enrolled courses
classScheduleRoute.get('/student-schedule', studentRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json({ data: await getStudentSchedule(tenantId, sub) })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// Student: tomorrow's classes only
classScheduleRoute.get('/student-upcoming', studentRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json({ data: await getStudentUpcomingTomorrow(tenantId, sub) })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// Pending routine count — for dashboard badge
classScheduleRoute.get('/pending-count', coordRbac, async (c) => {
  const { tenantId } = c.get('user')
  return c.json({ count: await getPendingRoutineCount(tenantId) })
})

// List course offerings for routine builder (enriched with routine status)
classScheduleRoute.get('/offerings', coordRbac, async (c) => {
  const { tenantId } = c.get('user')
  return c.json({ data: await listOfferingsForRoutine(tenantId) })
})

// Teacher: upcoming classes on their dashboard
classScheduleRoute.get('/my-upcoming', teacherRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json({ data: await getMyUpcomingClasses(tenantId, sub) })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// Teacher: assign syllabus topic to a scheduled class
classScheduleRoute.patch('/:id/topic', teacherRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    const body = await c.req.json()
    const syllabusTopicId = body.syllabusTopicId ?? null
    return c.json(await updateSchedule(tenantId, c.req.param('id'), sub, { syllabusTopicId }))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// List schedules for a specific offering
classScheduleRoute.get('/', readRbac, async (c) => {
  const { tenantId } = c.get('user')
  const offeringId   = c.req.query('offeringId')
  if (!offeringId) return c.json({ error: 'offeringId is required.' }, 400)
  return c.json({ data: await listSchedulesByOffering(tenantId, offeringId) })
})

// Conflict check — called from preview pane before final submit
classScheduleRoute.post('/check-conflicts', coordRbac, zValidator('json', checkConflictsSchema), async (c) => {
  const { tenantId } = c.get('user')
  try {
    const conflicts = await checkConflicts(tenantId, c.req.valid('json'))
    return c.json({ conflicts })
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// Bulk create from preview
classScheduleRoute.post('/bulk', coordRbac, zValidator('json', bulkCreateSchedulesSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    const result = await bulkCreateSchedules(tenantId, sub, c.req.valid('json'))
    return c.json({ inserted: result.length, data: result }, 201)
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// Update single schedule
classScheduleRoute.put('/:id', coordRbac, zValidator('json', updateScheduleSchema), async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await updateSchedule(tenantId, c.req.param('id'), sub, c.req.valid('json')))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

// Cancel / soft-delete
classScheduleRoute.delete('/:id', coordRbac, async (c) => {
  const { tenantId, sub } = c.get('user')
  try {
    return c.json(await cancelSchedule(tenantId, c.req.param('id'), sub))
  } catch (err: any) {
    return c.json({ error: err.message }, err.message.includes('not found') ? 404 : 400)
  }
})

export default classScheduleRoute
