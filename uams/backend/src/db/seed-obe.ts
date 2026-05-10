import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool }    from 'pg'
import { eq, and, ilike, isNull } from 'drizzle-orm'
import { courses, programs } from './schema/academic'
import { tenants }           from './schema/tenants'
import {
  courseLearningOutcomes,
  programLearningOutcomes,
  cloPloMappings,
} from './schema/obe'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db   = drizzle(pool)

// ── Data ──────────────────────────────────────────────────────────────────────

const CLO_DATA = [
  {
    code: 'CLO1',
    description: 'Recall the history, generations, and classifications of computers and describe their applications in real-world domains.',
    bloomsLevel: 'remember' as const,
  },
  {
    code: 'CLO2',
    description: 'Convert numbers between binary, octal, decimal, and hexadecimal systems and perform binary arithmetic operations.',
    bloomsLevel: 'apply' as const,
  },
  {
    code: 'CLO3',
    description: 'Simplify Boolean expressions using algebraic laws, De Morgan\'s theorems, and Karnaugh maps to design basic logic circuits.',
    bloomsLevel: 'analyze' as const,
  },
  {
    code: 'CLO4',
    description: 'Describe the Von Neumann architecture, CPU components, memory hierarchy, and the fetch-decode-execute instruction cycle.',
    bloomsLevel: 'understand' as const,
  },
  {
    code: 'CLO5',
    description: 'Identify common input/output devices and secondary storage technologies and compare their performance characteristics.',
    bloomsLevel: 'remember' as const,
  },
  {
    code: 'CLO6',
    description: 'Explain the functions of an operating system including process management, memory management, and file systems.',
    bloomsLevel: 'understand' as const,
  },
  {
    code: 'CLO7',
    description: 'Design step-by-step algorithms using pseudocode and flowcharts to solve well-defined computational problems.',
    bloomsLevel: 'create' as const,
  },
  {
    code: 'CLO8',
    description: 'Compare fundamental data structures (arrays, linked lists, stacks, queues, trees, graphs) and select appropriate structures for given problems.',
    bloomsLevel: 'analyze' as const,
  },
  {
    code: 'CLO9',
    description: 'Explain TCP/IP networking concepts, OSI model layers, IP addressing, and common Internet services.',
    bloomsLevel: 'understand' as const,
  },
  {
    code: 'CLO10',
    description: 'Write basic SQL queries to create, retrieve, update, and delete data in a relational database.',
    bloomsLevel: 'apply' as const,
  },
  {
    code: 'CLO11',
    description: 'Apply SDLC phases to plan and document a software project and distinguish between Waterfall and Agile methodologies.',
    bloomsLevel: 'apply' as const,
  },
  {
    code: 'CLO12',
    description: 'Evaluate common cybersecurity threats and ethical responsibilities, and propose basic security countermeasures.',
    bloomsLevel: 'evaluate' as const,
  },
]

const PLO_DATA = [
  {
    code: 'PLO1',
    description: 'Apply foundational computer science knowledge including hardware, software, and mathematical principles to analyse and solve computational problems.',
  },
  {
    code: 'PLO2',
    description: 'Design and implement correct, efficient algorithms and select appropriate data structures for a given problem.',
  },
  {
    code: 'PLO3',
    description: 'Develop, test, and maintain software systems using modern programming languages, tools, and software engineering methodologies.',
  },
  {
    code: 'PLO4',
    description: 'Analyse and evaluate computing systems with respect to performance, reliability, security, and scalability.',
  },
  {
    code: 'PLO5',
    description: 'Apply networking and distributed systems concepts to design and configure communication systems and services.',
  },
  {
    code: 'PLO6',
    description: 'Design and query relational and non-relational databases to manage, retrieve, and manipulate structured data effectively.',
  },
  {
    code: 'PLO7',
    description: 'Demonstrate professional responsibility, ethical conduct, and awareness of legal, social, and environmental impacts of computing.',
  },
  {
    code: 'PLO8',
    description: 'Communicate technical concepts, designs, and findings effectively in written reports, presentations, and team settings.',
  },
]

// weight: which PLO index (0-based) each CLO maps to, with weight
// format: [ploCode, weight]
const MAPPING_DATA: Array<{ cloCode: string; ploCode: string; weight: string }> = [
  // CLO1 (recall history/types) → PLO1 (foundations)
  { cloCode: 'CLO1', ploCode: 'PLO1', weight: '0.80' },
  // CLO2 (number systems / binary arithmetic) → PLO1, PLO2 (algo foundations)
  { cloCode: 'CLO2', ploCode: 'PLO1', weight: '0.85' },
  { cloCode: 'CLO2', ploCode: 'PLO2', weight: '0.35' },
  // CLO3 (Boolean algebra) → PLO1, PLO2 (logic in algorithm design)
  { cloCode: 'CLO3', ploCode: 'PLO1', weight: '0.75' },
  { cloCode: 'CLO3', ploCode: 'PLO2', weight: '0.50' },
  // CLO4 (CPU/memory/architecture) → PLO1, PLO4 (analyse systems)
  { cloCode: 'CLO4', ploCode: 'PLO1', weight: '0.90' },
  { cloCode: 'CLO4', ploCode: 'PLO4', weight: '0.65' },
  // CLO5 (I/O & storage) → PLO1
  { cloCode: 'CLO5', ploCode: 'PLO1', weight: '0.70' },
  // CLO6 (OS) → PLO3 (dev/software), PLO4 (analyse systems)
  { cloCode: 'CLO6', ploCode: 'PLO3', weight: '0.60' },
  { cloCode: 'CLO6', ploCode: 'PLO4', weight: '0.70' },
  // CLO7 (algorithm design / pseudocode) → PLO2, PLO3
  { cloCode: 'CLO7', ploCode: 'PLO2', weight: '0.90' },
  { cloCode: 'CLO7', ploCode: 'PLO3', weight: '0.75' },
  // CLO8 (data structures) → PLO2
  { cloCode: 'CLO8', ploCode: 'PLO2', weight: '1.00' },
  // CLO9 (networking / TCP-IP) → PLO5
  { cloCode: 'CLO9', ploCode: 'PLO5', weight: '0.90' },
  { cloCode: 'CLO9', ploCode: 'PLO4', weight: '0.45' },
  // CLO10 (SQL / database basics) → PLO6
  { cloCode: 'CLO10', ploCode: 'PLO6', weight: '1.00' },
  // CLO11 (SDLC / Agile) → PLO3, PLO7 (professional responsibility)
  { cloCode: 'CLO11', ploCode: 'PLO3', weight: '0.80' },
  { cloCode: 'CLO11', ploCode: 'PLO7', weight: '0.50' },
  // CLO12 (cybersecurity / ethics) → PLO4, PLO7
  { cloCode: 'CLO12', ploCode: 'PLO4', weight: '0.70' },
  { cloCode: 'CLO12', ploCode: 'PLO7', weight: '0.90' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve tenant
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .limit(1)
  if (!tenant) throw new Error('No active tenant found.')
  console.log(`Tenant: ${tenant.name} (${tenant.id})`)

  // Find course
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

  // Find program
  const [program] = await db
    .select({ id: programs.id, code: programs.code, name: programs.name })
    .from(programs)
    .where(and(
      eq(programs.tenantId, tenant.id),
      ilike(programs.name, '%computer%science%'),
      isNull(programs.deletedAt),
    ))
    .limit(1)
  if (!program) throw new Error('Program "BSc in Computer Science" not found.')
  console.log(`Program: ${program.code} — ${program.name} (${program.id})`)

  // ── Seed CLOs ──────────────────────────────────────────────────────────────
  const existingClos = await db
    .select({ code: courseLearningOutcomes.code })
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.tenantId, tenant.id),
      eq(courseLearningOutcomes.courseId, course.id),
    ))
  const existingCloCodes = new Set(existingClos.map(c => c.code))

  const newClos = CLO_DATA.filter(c => !existingCloCodes.has(c.code))
  if (newClos.length === 0) {
    console.log(`\nCLOs: all ${CLO_DATA.length} already exist — skipping.`)
  } else {
    await db.insert(courseLearningOutcomes).values(
      newClos.map(c => ({
        tenantId:    tenant.id,
        courseId:    course.id,
        code:        c.code,
        description: c.description,
        bloomsLevel: c.bloomsLevel,
      }))
    )
    console.log(`\nCLOs: inserted ${newClos.length} (skipped ${existingCloCodes.size} existing)`)
  }

  // ── Seed PLOs ──────────────────────────────────────────────────────────────
  const existingPlos = await db
    .select({ code: programLearningOutcomes.code })
    .from(programLearningOutcomes)
    .where(and(
      eq(programLearningOutcomes.tenantId, tenant.id),
      eq(programLearningOutcomes.programId, program.id),
    ))
  const existingPloCodes = new Set(existingPlos.map(p => p.code))

  const newPlos = PLO_DATA.filter(p => !existingPloCodes.has(p.code))
  if (newPlos.length === 0) {
    console.log(`PLOs: all ${PLO_DATA.length} already exist — skipping.`)
  } else {
    await db.insert(programLearningOutcomes).values(
      newPlos.map(p => ({
        tenantId:    tenant.id,
        programId:   program.id,
        code:        p.code,
        description: p.description,
      }))
    )
    console.log(`PLOs: inserted ${newPlos.length} (skipped ${existingPloCodes.size} existing)`)
  }

  // ── Reload IDs after insert ────────────────────────────────────────────────
  const allClos = await db
    .select({ id: courseLearningOutcomes.id, code: courseLearningOutcomes.code })
    .from(courseLearningOutcomes)
    .where(and(
      eq(courseLearningOutcomes.tenantId, tenant.id),
      eq(courseLearningOutcomes.courseId, course.id),
    ))
  const cloMap = new Map(allClos.map(c => [c.code, c.id]))

  const allPlos = await db
    .select({ id: programLearningOutcomes.id, code: programLearningOutcomes.code })
    .from(programLearningOutcomes)
    .where(and(
      eq(programLearningOutcomes.tenantId, tenant.id),
      eq(programLearningOutcomes.programId, program.id),
    ))
  const ploMap = new Map(allPlos.map(p => [p.code, p.id]))

  // ── Seed Mappings ──────────────────────────────────────────────────────────
  const existingMappings = await db
    .select({ cloId: cloPloMappings.cloId, ploId: cloPloMappings.ploId })
    .from(cloPloMappings)
    .where(eq(cloPloMappings.tenantId, tenant.id))
  const mappedSet = new Set(existingMappings.map(m => `${m.cloId}:${m.ploId}`))

  const newMappings = MAPPING_DATA.filter(m => {
    const cloId = cloMap.get(m.cloCode)
    const ploId = ploMap.get(m.ploCode)
    if (!cloId || !ploId) return false
    return !mappedSet.has(`${cloId}:${ploId}`)
  })

  if (newMappings.length === 0) {
    console.log(`Mappings: all ${MAPPING_DATA.length} already exist — skipping.`)
  } else {
    await db.insert(cloPloMappings).values(
      newMappings.map(m => ({
        tenantId: tenant.id,
        cloId:    cloMap.get(m.cloCode)!,
        ploId:    ploMap.get(m.ploCode)!,
        weight:   m.weight,
      }))
    )
    console.log(`Mappings: inserted ${newMappings.length} (skipped ${MAPPING_DATA.length - newMappings.length} existing)`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`
OBE seed complete.
  Course  : ${course.code} — ${course.title}
  Program : ${program.code} — ${program.name}
  CLOs    : ${CLO_DATA.length} outcomes (CLO1–CLO12)
  PLOs    : ${PLO_DATA.length} outcomes (PLO1–PLO8)
  Mappings: ${MAPPING_DATA.length} CLO–PLO links
`)

  await pool.end()
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1) })
