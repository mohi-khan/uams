import { drizzle }     from 'drizzle-orm/node-postgres'
import { Pool }         from 'pg'
import { eq, and, ilike, isNull, desc } from 'drizzle-orm'
import { courses, academicSessions }    from './schema/academic'
import { tenants }                      from './schema/tenants'
import { courseLearningOutcomes }       from './schema/obe'
import {
  courseAssessmentPlans,
  courseAssessmentComponents,
  assessmentComponentClos,
} from './schema/assessment'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db   = drizzle(pool)

// ── Plan design: CSE101 - Fundamental of Computer Science ─────────────────────
//
//  Component          Type         Weight   Marks  Count  CLO-mapped
//  ─────────────────  ──────────   ──────   ─────  ─────  ──────────
//  Quiz               quiz           10%      20      3     yes
//  Assignment         assignment     20%      30      4     yes
//  Lab Practical      lab            10%      20      5     yes
//  Mid-Term Exam      midterm        25%      50      1     yes
//  Final Exam         final          35%     100      1     yes
//                                  ─────
//                                  100%

type ComponentType = 'quiz'|'assignment'|'lab'|'midterm'|'final'

const COMPONENTS: Array<{
  name:             string
  componentType:    ComponentType
  weightPercentage: string
  totalMarks:       number
  assessmentCount:  number
  cloMapped:        boolean
  orderNo:          number
  cloCodes:         string[]   // which CLOs to link
  cloWeights:       number[]   // weight per CLO link (%)
}> = [
  {
    name:             'Quiz',
    componentType:    'quiz',
    weightPercentage: '10.00',
    totalMarks:       20,
    assessmentCount:  3,
    cloMapped:        true,
    orderNo:          1,
    // Recall & number-system quizzes → CLO1, CLO2, CLO3
    cloCodes:   ['CLO1', 'CLO2', 'CLO3'],
    cloWeights: [30,     40,     30],
  },
  {
    name:             'Assignment',
    componentType:    'assignment',
    weightPercentage: '20.00',
    totalMarks:       30,
    assessmentCount:  4,
    cloMapped:        true,
    orderNo:          2,
    // Programming & applied tasks → CLO7, CLO10, CLO11
    cloCodes:   ['CLO7', 'CLO10', 'CLO11'],
    cloWeights: [40,     30,      30],
  },
  {
    name:             'Lab Practical',
    componentType:    'lab',
    weightPercentage: '10.00',
    totalMarks:       20,
    assessmentCount:  5,
    cloMapped:        true,
    orderNo:          3,
    // Hands-on number systems & SQL → CLO2, CLO10
    cloCodes:   ['CLO2', 'CLO10'],
    cloWeights: [50,     50],
  },
  {
    name:             'Mid-Term Exam',
    componentType:    'midterm',
    weightPercentage: '25.00',
    totalMarks:       50,
    assessmentCount:  1,
    cloMapped:        true,
    orderNo:          4,
    // Hardware, OS, data structures topics → CLO4, CLO5, CLO6, CLO8
    cloCodes:   ['CLO4', 'CLO5', 'CLO6', 'CLO8'],
    cloWeights: [30,     20,     25,     25],
  },
  {
    name:             'Final Exam',
    componentType:    'final',
    weightPercentage: '35.00',
    totalMarks:       100,
    assessmentCount:  1,
    cloMapped:        true,
    orderNo:          5,
    // Comprehensive — networking, SDLC, security + design/evaluate CLOs
    cloCodes:   ['CLO7', 'CLO8', 'CLO9', 'CLO11', 'CLO12'],
    cloWeights: [20,     20,     20,     20,       20],
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .limit(1)
  if (!tenant) throw new Error('No active tenant found.')
  console.log(`Tenant : ${tenant.name} (${tenant.id})`)

  // Course
  const [course] = await db
    .select({ id: courses.id, code: courses.code, title: courses.title })
    .from(courses)
    .where(and(
      eq(courses.tenantId, tenant.id),
      ilike(courses.title, '%fundamental%computer%'),
      isNull(courses.deletedAt),
    ))
    .limit(1)
  if (!course) throw new Error('Course "Fundamentals of Computer Science" not found.')
  console.log(`Course : ${course.code} — ${course.title} (${course.id})`)

  // Academic session — pick the most recent active/completed one
  const [session] = await db
    .select({ id: academicSessions.id, name: academicSessions.name, year: academicSessions.year, term: academicSessions.term })
    .from(academicSessions)
    .where(and(
      eq(academicSessions.tenantId, tenant.id),
      isNull(academicSessions.deletedAt),
    ))
    .orderBy(desc(academicSessions.year), desc(academicSessions.createdAt))
    .limit(1)
  if (!session) throw new Error('No academic session found. Create a session first.')
  console.log(`Session: ${session.name} ${session.year} ${session.term} (${session.id})`)

  // Check for existing plan
  const existing = await db
    .select({ id: courseAssessmentPlans.id, version: courseAssessmentPlans.version })
    .from(courseAssessmentPlans)
    .where(and(
      eq(courseAssessmentPlans.tenantId, tenant.id),
      eq(courseAssessmentPlans.courseId, course.id),
      eq(courseAssessmentPlans.academicSessionId, session.id),
      isNull(courseAssessmentPlans.deletedAt),
    ))
  if (existing.length > 0) {
    console.log(`\nAssessment plan already exists (${existing.map(p => p.version).join(', ')}) — skipping.`)
    await pool.end()
    return
  }

  // Fetch CLOs for this course
  const allClos = await db
    .select({ id: courseLearningOutcomes.id, code: courseLearningOutcomes.code })
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.tenantId, tenant.id),
      eq(courseLearningOutcomes.courseId, course.id),
      isNull(courseLearningOutcomes.deletedAt),
    ))
  const cloMap = new Map(allClos.map(c => [c.code, c.id]))
  console.log(`CLOs   : found ${allClos.length}`)

  // Create assessment plan v1
  const [plan] = await db
    .insert(courseAssessmentPlans)
    .values({
      tenantId:          tenant.id,
      courseId:          course.id,
      academicSessionId: session.id,
      version:           'v1',
      status:            'final',
      isDefault:         true,
    })
    .returning()
  console.log(`\nCreated assessment plan ${plan.version} (${plan.id})`)

  // Insert components + CLO links
  let totalWeight = 0
  for (const comp of COMPONENTS) {
    const [component] = await db
      .insert(courseAssessmentComponents)
      .values({
        tenantId:         tenant.id,
        planId:           plan.id,
        name:             comp.name,
        componentType:    comp.componentType,
        weightPercentage: comp.weightPercentage,
        totalMarks:       comp.totalMarks,
        assessmentCount:  comp.assessmentCount,
        cloMapped:        comp.cloMapped,
        orderNo:          comp.orderNo,
      })
      .returning()

    totalWeight += parseFloat(comp.weightPercentage)

    // Insert CLO links
    const links = comp.cloCodes
      .map((code, i) => {
        const cloId = cloMap.get(code)
        if (!cloId) {
          console.warn(`  ! CLO "${code}" not found — skipping link`)
          return null
        }
        return {
          tenantId:    tenant.id,
          componentId: component.id,
          cloId,
          weight:      String(comp.cloWeights[i]),
        }
      })
      .filter(Boolean) as Array<{ tenantId: string; componentId: string; cloId: string; weight: string }>

    if (links.length > 0) {
      await db.insert(assessmentComponentClos).values(links)
    }

    console.log(`  + ${comp.name.padEnd(18)} ${comp.weightPercentage}%  ×${comp.assessmentCount}  ${comp.totalMarks} marks  [${comp.cloCodes.join(', ')}]`)
  }

  console.log(`
Assessment seed complete.
  Course  : ${course.code} — ${course.title}
  Session : ${session.name} ${session.year} ${session.term}
  Plan    : v1 (final, default)
  Components : ${COMPONENTS.length}
  Total weight: ${totalWeight.toFixed(2)}%
`)

  await pool.end()
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1) })
