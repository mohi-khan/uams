import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import tenantRoute from './routes/tenant.route'
import authRoute from './routes/auth.route'
import userRoute from './routes/user.route'
import facultyRoute from './routes/faculty.route'
import departmentRoute from './routes/department.route'
import courseRoute from './routes/course.route'
import programRoute from './routes/program.route'
import teacherRoute from './routes/teacher.route'
import sessionRoute from './routes/academic-session.route'
import studentRoute     from './routes/student.route'
import batchRoute       from './routes/batch.route'
import feeStructureRoute from './routes/fee-structure.route'
import enrollmentRoute   from './routes/student-enrollment.route'
import offeringRoute     from './routes/program-offering.route'
import schedulingRoute   from './routes/scheduling.route'
import syllabusRoute     from './routes/syllabus.route'
import obeRoute          from './routes/obe.route'
import assessmentRoute   from './routes/assessment.route'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
}))

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.route('/api/tenants', tenantRoute)
app.route('/api/auth', authRoute)
app.route('/api/users', userRoute)
app.route('/api/faculties', facultyRoute)
app.route('/api/departments', departmentRoute)
app.route('/api/courses', courseRoute)
app.route('/api/programs', programRoute)
app.route('/api/teachers', teacherRoute)
app.route('/api/sessions', sessionRoute)
app.route('/api/students',       studentRoute)
app.route('/api/batches',        batchRoute)
app.route('/api/fee-structures',    feeStructureRoute)
app.route('/api/enrollments',       enrollmentRoute)
app.route('/api/program-offerings',  offeringRoute)
app.route('/api/semester-offerings', schedulingRoute)
app.route('/api/syllabi',            syllabusRoute)
app.route('/api/obe',                obeRoute)
app.route('/api/assessment-plans',   assessmentRoute)

const PORT = Number(process.env.PORT) ?? 8000

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`UAMS API running on http://localhost:${PORT}`)
  console.log(`  DB:    ${process.env.DATABASE_URL?.split('@')[1]}`)
  console.log(`  Redis: ${process.env.REDIS_URL}`)
  console.log(`  Email: ${process.env.RESEND_FROM}`)
})

export default app
