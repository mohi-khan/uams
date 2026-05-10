import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, and, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { tenants } from './schema/tenants'
import { users } from './schema/users'
import {
  faculties, departments, facultyAuditLogs, departmentAuditLogs,
  courses, courseAuditLogs,
  programs, programAuditLogs, programCourses, coursePrerequisites,
  teachers, teacherAuditLogs,
  academicSessions, academicSessionAuditLogs,
} from './schema/academic'
import { students, studentAuditLogs, batches, batchAuditLogs } from './schema/enrollment'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db   = drizzle(pool)

// ─── Faculty / Department seed data ──────────────────────────────────────────

const FACULTY_SEED: Array<{
  name: string; code: string; description: string
  departments: Array<{ name: string; code: string; description: string }>
}> = [
  {
    name: 'Faculty of Engineering',
    code: 'ENG',
    description: 'Covers all engineering disciplines including software, electrical, civil, and mechanical.',
    departments: [
      { name: 'Computer Science & Engineering', code: 'CSE', description: 'Software, algorithms, AI, and system design.' },
      { name: 'Electrical & Electronic Engineering', code: 'EEE', description: 'Circuit design, power systems, and electronics.' },
      { name: 'Civil Engineering', code: 'CVE', description: 'Structural design, construction, and urban planning.' },
      { name: 'Mechanical Engineering', code: 'MCE', description: 'Thermodynamics, manufacturing, and mechanical systems.' },
    ],
  },
  {
    name: 'Faculty of Business Administration',
    code: 'BUS',
    description: "Business, management, and professional studies for tomorrow's leaders.",
    departments: [
      { name: 'Accounting & Finance',        code: 'ACF', description: 'Financial reporting, auditing, and corporate finance.' },
      { name: 'Marketing & Sales',           code: 'MKT', description: 'Consumer behaviour, brand strategy, and digital marketing.' },
      { name: 'Human Resource Management',   code: 'HRM', description: 'Talent management, organisational behaviour, and labour law.' },
      { name: 'Business Information Systems',code: 'BIS', description: 'IT strategy, enterprise systems, and data analytics.' },
    ],
  },
  {
    name: 'Faculty of Arts & Humanities',
    code: 'ART',
    description: 'Language, literature, history, philosophy, and the creative arts.',
    departments: [
      { name: 'English Language & Literature', code: 'ELL', description: 'Literary analysis, linguistics, and creative writing.' },
      { name: 'History & Cultural Studies',    code: 'HCS', description: 'World history, heritage studies, and cultural theory.' },
      { name: 'Philosophy & Ethics',           code: 'PHE', description: 'Logic, ethics, epistemology, and social philosophy.' },
    ],
  },
  {
    name: 'Faculty of Natural Sciences',
    code: 'SCI',
    description: 'Pure and applied sciences including mathematics, physics, chemistry, and biology.',
    departments: [
      { name: 'Mathematics & Statistics', code: 'MTS', description: 'Pure mathematics, applied statistics, and probability.' },
      { name: 'Physics',                  code: 'PHY', description: 'Classical and modern physics, astrophysics, and optics.' },
      { name: 'Chemistry',                code: 'CHM', description: 'Organic, inorganic, and analytical chemistry.' },
      { name: 'Biology & Life Sciences',  code: 'BLS', description: 'Cell biology, genetics, ecology, and biotechnology.' },
    ],
  },
  {
    name: 'Faculty of Law',
    code: 'LAW',
    description: 'Legal theory, practice, and justice studies across multiple specialisations.',
    departments: [
      { name: 'Corporate & Commercial Law', code: 'CCL', description: 'Company law, contracts, and commercial transactions.' },
      { name: 'Criminal Law & Justice',     code: 'CRJ', description: 'Criminal procedure, criminology, and restorative justice.' },
    ],
  },
]

// ─── BSc CS — Courses ─────────────────────────────────────────────────────────
// All 39 courses under the CSE department.
// semester: used only to build program_courses mappings (not stored on course itself).

const CSE_COURSES: Array<{
  code: string; title: string; credits: number
  type: 'CORE' | 'ELECTIVE'; originalFee: number; retakeFee: number; semester: number
}> = [
  // ── Semester 1 — Foundation ──────────────────────────────────────────────
  { code: 'CSE101', title: 'Introduction to Programming',           credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 1 },
  { code: 'CSE102', title: 'Computer Architecture Fundamentals',    credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 1 },
  { code: 'CSE103', title: 'Discrete Mathematics',                  credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 1 },
  { code: 'CSE104', title: 'Calculus for Computing',                credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 1 },
  { code: 'CSE105', title: 'Technical Communication',               credits: 2, type: 'CORE',     originalFee: 10000, retakeFee: 5000,  semester: 1 },

  // ── Semester 2 — Core Computing ──────────────────────────────────────────
  { code: 'CSE201', title: 'Data Structures',                       credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 2 },
  { code: 'CSE202', title: 'Object-Oriented Programming',           credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 2 },
  { code: 'CSE203', title: 'Digital Logic Design',                  credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 2 },
  { code: 'CSE204', title: 'Linear Algebra for Computing',          credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 2 },
  { code: 'CSE205', title: 'Web Development Fundamentals',          credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 2 },

  // ── Semester 3 — Systems & Theory ────────────────────────────────────────
  { code: 'CSE301', title: 'Algorithms & Complexity',               credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 3 },
  { code: 'CSE302', title: 'Database Systems',                      credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 3 },
  { code: 'CSE303', title: 'Computer Organization & Architecture',  credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 3 },
  { code: 'CSE304', title: 'Probability & Statistics for CS',       credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 3 },
  { code: 'CSE305', title: 'Software Engineering Principles',       credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 3 },

  // ── Semester 4 — Systems & Networks ──────────────────────────────────────
  { code: 'CSE401', title: 'Operating Systems',                     credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 4 },
  { code: 'CSE402', title: 'Computer Networks',                     credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 4 },
  { code: 'CSE403', title: 'Theory of Computation',                 credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 4 },
  { code: 'CSE404', title: 'Advanced Database Systems',             credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 4 },
  { code: 'CSE405', title: 'Human-Computer Interaction',            credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 4 },

  // ── Semester 5 — Intelligence & Security ─────────────────────────────────
  { code: 'CSE501', title: 'Artificial Intelligence',               credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 5 },
  { code: 'CSE502', title: 'Systems Programming',                   credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 5 },
  { code: 'CSE503', title: 'Network Security',                      credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 5 },
  { code: 'CSE504', title: 'Software Testing & Quality Assurance',  credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 5 },
  { code: 'CSE505', title: 'Compiler Design',                       credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 5 },

  // ── Semester 6 — Advanced Topics ─────────────────────────────────────────
  { code: 'CSE601', title: 'Machine Learning',                      credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 6 },
  { code: 'CSE602', title: 'Distributed Systems',                   credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 6 },
  { code: 'CSE603', title: 'Mobile Application Development',        credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 6 },
  { code: 'CSE604', title: 'Cloud Computing',                       credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 6 },
  { code: 'CSE605', title: 'DevOps Engineering',                    credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 6 },

  // ── Semester 7 — Specialisation ───────────────────────────────────────────
  { code: 'CSE701', title: 'Deep Learning & Neural Networks',       credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 7 },
  { code: 'CSE702', title: 'Big Data Analytics',                    credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 7 },
  { code: 'CSE703', title: 'Blockchain & Distributed Ledger',       credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 7 },
  { code: 'CSE704', title: 'Research Methodology',                  credits: 2, type: 'CORE',     originalFee: 10000, retakeFee: 5000,  semester: 7 },
  { code: 'CSE705', title: 'Software Project Management',           credits: 3, type: 'CORE',     originalFee: 15000, retakeFee: 8000,  semester: 7 },

  // ── Semester 8 — Capstone ────────────────────────────────────────────────
  { code: 'CSE801', title: 'Capstone Project I',                    credits: 4, type: 'CORE',     originalFee: 20000, retakeFee: 12000, semester: 8 },
  { code: 'CSE802', title: 'Capstone Project II',                   credits: 4, type: 'CORE',     originalFee: 20000, retakeFee: 12000, semester: 8 },
  { code: 'CSE803', title: 'Professional Ethics in Computing',      credits: 2, type: 'CORE',     originalFee: 10000, retakeFee: 5000,  semester: 8 },
  { code: 'CSE804', title: 'Enterprise Application Development',    credits: 3, type: 'ELECTIVE', originalFee: 12000, retakeFee: 6000,  semester: 8 },
]

// ─── BSc CS — Prerequisites ───────────────────────────────────────────────────

const PREREQ_SEED: Array<{
  courseCode: string; prereqCode: string; minGrade?: string; isMandatory: boolean
}> = [
  // Semester 2 — require Semester 1 foundations
  { courseCode: 'CSE201', prereqCode: 'CSE101', minGrade: 'C', isMandatory: true  },
  { courseCode: 'CSE202', prereqCode: 'CSE101',                isMandatory: true  },
  { courseCode: 'CSE203', prereqCode: 'CSE102',                isMandatory: true  },
  { courseCode: 'CSE204', prereqCode: 'CSE104',                isMandatory: true  },

  // Semester 3
  { courseCode: 'CSE301', prereqCode: 'CSE201', minGrade: 'C', isMandatory: true  },
  { courseCode: 'CSE302', prereqCode: 'CSE202',                isMandatory: true  },
  { courseCode: 'CSE303', prereqCode: 'CSE203',                isMandatory: true  },
  { courseCode: 'CSE304', prereqCode: 'CSE104',                isMandatory: true  },
  { courseCode: 'CSE305', prereqCode: 'CSE202',                isMandatory: true  },

  // Semester 4
  { courseCode: 'CSE401', prereqCode: 'CSE303',                isMandatory: true  },
  { courseCode: 'CSE402', prereqCode: 'CSE303',                isMandatory: true  },
  { courseCode: 'CSE403', prereqCode: 'CSE103',                isMandatory: true  },
  { courseCode: 'CSE403', prereqCode: 'CSE301',                isMandatory: true  },
  { courseCode: 'CSE404', prereqCode: 'CSE302',                isMandatory: true  },

  // Semester 5
  { courseCode: 'CSE501', prereqCode: 'CSE301',                isMandatory: true  },
  { courseCode: 'CSE501', prereqCode: 'CSE304',                isMandatory: true  },
  { courseCode: 'CSE502', prereqCode: 'CSE401',                isMandatory: true  },
  { courseCode: 'CSE503', prereqCode: 'CSE402',                isMandatory: true  },
  { courseCode: 'CSE504', prereqCode: 'CSE305',                isMandatory: true  },
  { courseCode: 'CSE505', prereqCode: 'CSE403',                isMandatory: true  },

  // Semester 6
  { courseCode: 'CSE601', prereqCode: 'CSE501',                isMandatory: true  },
  { courseCode: 'CSE601', prereqCode: 'CSE304',                isMandatory: true  },
  { courseCode: 'CSE602', prereqCode: 'CSE401',                isMandatory: true  },
  { courseCode: 'CSE602', prereqCode: 'CSE402',                isMandatory: true  },
  { courseCode: 'CSE603', prereqCode: 'CSE202',                isMandatory: true  },
  { courseCode: 'CSE604', prereqCode: 'CSE602',                isMandatory: true  },
  { courseCode: 'CSE605', prereqCode: 'CSE401',                isMandatory: false },

  // Semester 7
  { courseCode: 'CSE701', prereqCode: 'CSE601',                isMandatory: true  },
  { courseCode: 'CSE702', prereqCode: 'CSE601',                isMandatory: true  },
  { courseCode: 'CSE705', prereqCode: 'CSE305',                isMandatory: true  },

  // Semester 8
  { courseCode: 'CSE801', prereqCode: 'CSE704',                isMandatory: true  },
  { courseCode: 'CSE802', prereqCode: 'CSE801',                isMandatory: true  },
  { courseCode: 'CSE804', prereqCode: 'CSE305',                isMandatory: true  },
  { courseCode: 'CSE804', prereqCode: 'CSE302',                isMandatory: true  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Starting seed…\n')

  // ── Resolve tenant ────────────────────────────────────────────────────────
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).limit(1)
  if (!tenant) {
    console.error('✗  No tenant found. Register a university first, then run seed.')
    process.exit(1)
  }
  console.log(`✓  Tenant: ${tenant.name} (${tenant.id})`)

  // ── Resolve admin user ────────────────────────────────────────────────────
  const [admin] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.role, 'admin')))
    .limit(1)

  const performedBy = admin?.id ?? null
  if (admin) {
    console.log(`✓  Performed by: ${admin.firstName} ${admin.lastName} (${admin.id})`)
  } else {
    console.log('⚠  No admin user found — audit logs will have performedBy = null')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Faculties & Departments
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Faculties & Departments ─────────────────────────────────────')

  let facultyCount    = 0
  let departmentCount = 0

  for (const item of FACULTY_SEED) {
    const [existing] = await db
      .select({ id: faculties.id })
      .from(faculties)
      .where(and(eq(faculties.tenantId, tenant.id), eq(faculties.code, item.code), isNull(faculties.deletedAt)))
      .limit(1)

    let facultyId: string

    if (existing) {
      facultyId = existing.id
      console.log(`  skip  Faculty "${item.name}"`)
    } else {
      const [faculty] = await db.insert(faculties).values({
        tenantId:    tenant.id,
        name:        item.name,
        code:        item.code,
        description: item.description,
        createdBy:   performedBy,
        updatedBy:   performedBy,
      }).returning()

      await db.insert(facultyAuditLogs).values({
        tenantId: tenant.id, facultyId: faculty.id, action: 'CREATE', performedBy, snapshot: faculty as any,
      })

      facultyId = faculty.id
      facultyCount++
      console.log(`  +     Faculty "${item.name}"`)
    }

    for (const dept of item.departments) {
      const [existingDept] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(
          eq(departments.tenantId, tenant.id),
          eq(departments.facultyId, facultyId),
          eq(departments.code, dept.code),
          isNull(departments.deletedAt),
        ))
        .limit(1)

      if (existingDept) {
        console.log(`         skip  Dept "${dept.name}"`)
        continue
      }

      const [department] = await db.insert(departments).values({
        tenantId:    tenant.id,
        facultyId,
        name:        dept.name,
        code:        dept.code,
        description: dept.description,
        createdBy:   performedBy,
        updatedBy:   performedBy,
      }).returning()

      await db.insert(departmentAuditLogs).values({
        tenantId: tenant.id, departmentId: department.id, action: 'CREATE', performedBy, snapshot: department as any,
      })

      departmentCount++
      console.log(`         +     Dept "${dept.name}"`)
    }
  }

  console.log(`\n  → ${facultyCount} faculties, ${departmentCount} departments seeded.`)

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CSE Department lookup
  // ═══════════════════════════════════════════════════════════════════════════
  const [cseDept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.tenantId, tenant.id), eq(departments.code, 'CSE'), isNull(departments.deletedAt)))
    .limit(1)

  if (!cseDept) {
    console.error('✗  CSE department not found — cannot seed courses.')
    await pool.end()
    process.exit(1)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Courses
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Courses (BSc CS) ────────────────────────────────────────────')

  // Build a code→id map for later use in mappings and prerequisites
  const courseIdMap: Record<string, string> = {}
  let courseCount = 0

  for (const c of CSE_COURSES) {
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.tenantId, tenant.id), eq(courses.code, c.code), isNull(courses.deletedAt)))
      .limit(1)

    if (existing) {
      courseIdMap[c.code] = existing.id
      console.log(`  skip  [Sem ${c.semester}] ${c.code}`)
      continue
    }

    const [course] = await db.insert(courses).values({
      tenantId:     tenant.id,
      departmentId: cseDept.id,
      code:         c.code,
      title:        c.title,
      credits:      c.credits,
      type:         c.type,
      status:       'active',
      originalFee:  String(c.originalFee),
      retakeFee:    String(c.retakeFee),
      createdBy:    performedBy,
      updatedBy:    performedBy,
    }).returning()

    await db.insert(courseAuditLogs).values({
      tenantId: tenant.id, courseId: course.id, action: 'CREATE', performedBy, snapshot: course as any,
    })

    courseIdMap[c.code] = course.id
    courseCount++
    console.log(`  +     [Sem ${c.semester}] ${c.code}  ${c.title}`)
  }

  console.log(`\n  → ${courseCount} courses seeded.`)

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Program — BSc Computer Science
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Program ─────────────────────────────────────────────────────')

  const PROGRAM_CODE  = 'BSC-CS'
  const totalCredits  = CSE_COURSES.reduce((sum, c) => sum + c.credits, 0) // 116

  let programId: string

  const [existingProg] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.tenantId, tenant.id), eq(programs.code, PROGRAM_CODE), isNull(programs.deletedAt)))
    .limit(1)

  if (existingProg) {
    programId = existingProg.id
    console.log(`  skip  Program "${PROGRAM_CODE}"`)
  } else {
    const [program] = await db.insert(programs).values({
      tenantId:          tenant.id,
      departmentId:      cseDept.id,
      name:              'Bachelor of Science in Computer Science',
      code:              PROGRAM_CODE,
      degreeLevel:       'bachelor',
      totalCredits,
      durationSemesters: 8,
      status:            'active',
      createdBy:         performedBy,
      updatedBy:         performedBy,
    }).returning()

    await db.insert(programAuditLogs).values({
      tenantId: tenant.id, programId: program.id, action: 'CREATE', performedBy, snapshot: program as any,
    })

    programId = program.id
    console.log(`  +     Program "Bachelor of Science in Computer Science" (${PROGRAM_CODE}) — ${totalCredits} credits, 8 semesters`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Program-Course Mappings
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Program-Course Mappings ─────────────────────────────────────')

  let mappingCount = 0

  for (const c of CSE_COURSES) {
    const courseId = courseIdMap[c.code]
    if (!courseId) continue

    const [existing] = await db
      .select({ id: programCourses.id })
      .from(programCourses)
      .where(and(
        eq(programCourses.tenantId, tenant.id),
        eq(programCourses.programId, programId),
        eq(programCourses.courseId, courseId),
      ))
      .limit(1)

    if (existing) {
      console.log(`  skip  ${c.code} → Sem ${c.semester}`)
      continue
    }

    await db.insert(programCourses).values({
      tenantId:    tenant.id,
      programId,
      courseId,
      semesterNo:  c.semester,
      isMandatory: c.type === 'CORE',
      createdBy:   performedBy,
    })

    mappingCount++
    console.log(`  +     ${c.code} → Sem ${c.semester}  [${c.type === 'CORE' ? 'mandatory' : 'elective'}]`)
  }

  console.log(`\n  → ${mappingCount} course mappings seeded.`)

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Course Prerequisites
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Course Prerequisites ────────────────────────────────────────')

  let prereqCount = 0

  for (const p of PREREQ_SEED) {
    const courseId  = courseIdMap[p.courseCode]
    const prereqId  = courseIdMap[p.prereqCode]
    if (!courseId || !prereqId) {
      console.log(`  ⚠   Skipping ${p.courseCode} ← ${p.prereqCode} (id not found)`)
      continue
    }

    const [existing] = await db
      .select({ id: coursePrerequisites.id })
      .from(coursePrerequisites)
      .where(and(
        eq(coursePrerequisites.tenantId, tenant.id),
        eq(coursePrerequisites.courseId, courseId),
        eq(coursePrerequisites.prerequisiteCourseId, prereqId),
      ))
      .limit(1)

    if (existing) {
      console.log(`  skip  ${p.courseCode} ← ${p.prereqCode}`)
      continue
    }

    await db.insert(coursePrerequisites).values({
      tenantId:             tenant.id,
      courseId,
      prerequisiteCourseId: prereqId,
      minGrade:             p.minGrade ?? null,
      isMandatory:          p.isMandatory,
      createdBy:            performedBy,
    })

    prereqCount++
    const gradeStr = p.minGrade ? ` (min ${p.minGrade})` : ''
    const mandStr  = p.isMandatory ? '' : ' [optional]'
    console.log(`  +     ${p.courseCode} ← ${p.prereqCode}${gradeStr}${mandStr}`)
  }

  console.log(`\n  → ${prereqCount} prerequisites seeded.`)

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Academic Sessions
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Academic Sessions ───────────────────────────────────────────')

  const SESSION_SEED: Array<{
    name: string; year: number; term: 'SPRING' | 'SUMMER' | 'FALL'
    startDate: string; endDate: string; status: 'draft' | 'active' | 'completed' | 'archived'
  }> = [
    { name: 'Spring 2024', year: 2024, term: 'SPRING', startDate: '2024-01-15', endDate: '2024-06-15', status: 'completed' },
    { name: 'Fall 2024',   year: 2024, term: 'FALL',   startDate: '2024-08-01', endDate: '2024-12-20', status: 'completed' },
    { name: 'Spring 2025', year: 2025, term: 'SPRING', startDate: '2025-01-15', endDate: '2025-06-15', status: 'completed' },
    { name: 'Fall 2025',   year: 2025, term: 'FALL',   startDate: '2025-08-01', endDate: '2025-12-20', status: 'active'    },
    { name: 'Spring 2026', year: 2026, term: 'SPRING', startDate: '2026-01-15', endDate: '2026-06-15', status: 'draft'     },
  ]

  const sessionIdMap: Record<string, string> = {}   // "2025-FALL" → id

  for (const s of SESSION_SEED) {
    const [existing] = await db
      .select({ id: academicSessions.id })
      .from(academicSessions)
      .where(and(
        eq(academicSessions.tenantId, tenant.id),
        eq(academicSessions.year, s.year),
        eq(academicSessions.term, s.term),
        isNull(academicSessions.deletedAt),
      ))
      .limit(1)

    if (existing) {
      sessionIdMap[`${s.year}-${s.term}`] = existing.id
      console.log(`  skip  ${s.name}`)
      continue
    }

    const [session] = await db.insert(academicSessions).values({
      tenantId:  tenant.id,
      name:      s.name,
      year:      s.year,
      term:      s.term,
      startDate: s.startDate,
      endDate:   s.endDate,
      status:    s.status,
      createdBy: performedBy,
      updatedBy: performedBy,
    }).returning()

    await db.insert(academicSessionAuditLogs).values({
      tenantId: tenant.id, sessionId: session.id, action: 'CREATE', performedBy, snapshot: session as any,
    })

    sessionIdMap[`${s.year}-${s.term}`] = session.id
    console.log(`  +     ${s.name}  [${s.status}]`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Teachers (CSE department)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Teachers (CSE) ──────────────────────────────────────────────')

  // All seeded teachers share this password: Teacher@123
  const SEED_PASSWORD_HASH = await bcrypt.hash('Teacher@123', 10)

  const TEACHER_SEED: Array<{
    name: string; email: string; phone: string
    designation: 'Professor' | 'Lecturer'; joiningDate: string
  }> = [
    { name: 'Dr. Arif Rahman',      email: 'arif.rahman@uams-demo.edu',      phone: '+880-1711-001001', designation: 'Professor', joiningDate: '2018-02-01' },
    { name: 'Dr. Nasrin Sultana',   email: 'nasrin.sultana@uams-demo.edu',   phone: '+880-1711-002002', designation: 'Professor', joiningDate: '2017-08-15' },
    { name: 'Dr. Karim Hossain',    email: 'karim.hossain@uams-demo.edu',    phone: '+880-1711-003003', designation: 'Professor', joiningDate: '2015-03-10' },
    { name: 'Ms. Tahmina Begum',    email: 'tahmina.begum@uams-demo.edu',    phone: '+880-1711-004004', designation: 'Lecturer',  joiningDate: '2021-01-20' },
    { name: 'Mr. Rafiqul Islam',    email: 'rafiqul.islam@uams-demo.edu',    phone: '+880-1711-005005', designation: 'Lecturer',  joiningDate: '2022-07-01' },
    { name: 'Dr. Shahida Khanam',   email: 'shahida.khanam@uams-demo.edu',   phone: '+880-1711-006006', designation: 'Professor', joiningDate: '2016-06-01' },
    { name: 'Mr. Tanvir Ahmed',     email: 'tanvir.ahmed@uams-demo.edu',     phone: '+880-1711-007007', designation: 'Lecturer',  joiningDate: '2023-02-15' },
    { name: 'Ms. Sadia Islam',      email: 'sadia.islam@uams-demo.edu',      phone: '+880-1711-008008', designation: 'Lecturer',  joiningDate: '2023-08-01' },
  ]

  // Resolve CSE faculty id
  const [cseEngFaculty] = await db
    .select({ id: faculties.id })
    .from(faculties)
    .where(and(eq(faculties.tenantId, tenant.id), eq(faculties.code, 'ENG'), isNull(faculties.deletedAt)))
    .limit(1)

  if (!cseEngFaculty) {
    console.log('  ⚠   ENG faculty not found — skipping teachers')
  } else {
    let teacherCount = 0
    for (const t of TEACHER_SEED) {
      const [existingTeacher] = await db
        .select({ id: teachers.id })
        .from(teachers)
        .where(and(eq(teachers.tenantId, tenant.id), eq(teachers.email, t.email), isNull(teachers.deletedAt)))
        .limit(1)

      if (existingTeacher) {
        console.log(`  skip  ${t.name}`)
        continue
      }

      // Split name → firstName / lastName
      const parts     = t.name.replace(/^(Dr\.|Mr\.|Ms\.)\s*/i, '').trim().split(' ')
      const firstName = parts.slice(0, -1).join(' ') || parts[0]
      const lastName  = parts.length > 1 ? parts[parts.length - 1] : ''

      // Create inactive user (will be activated via invitation flow in real use)
      const [user] = await db.insert(users).values({
        tenantId:     tenant.id,
        email:        t.email,
        passwordHash: SEED_PASSWORD_HASH,
        authProvider: 'email',
        firstName,
        lastName,
        role:         'teacher',
        status:       'active',
        isActive:     true,
      }).returning()

      const [teacher] = await db.insert(teachers).values({
        tenantId:     tenant.id,
        departmentId: cseDept.id,
        facultyId:    cseEngFaculty.id,
        userId:       user.id,
        name:         t.name,
        email:        t.email,
        phone:        t.phone,
        designation:  t.designation,
        joiningDate:  t.joiningDate,
        isActive:     true,
        createdBy:    performedBy,
        updatedBy:    performedBy,
      }).returning()

      await db.insert(teacherAuditLogs).values({
        tenantId: tenant.id, teacherId: teacher.id, action: 'CREATE', performedBy, snapshot: teacher as any,
      })

      teacherCount++
      console.log(`  +     ${t.designation}  ${t.name}`)
    }
    console.log(`\n  → ${teacherCount} teachers seeded.`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Batches (BSc-CS program)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Batches (BSc-CS) ────────────────────────────────────────────')

  const BATCH_SEED: Array<{
    code: string; name: string; sessionKey: string; capacity: number
  }> = [
    { code: 'cse-2024-spring-01', name: 'CSE Batch Spring 2024 — Section A', sessionKey: '2024-SPRING', capacity: 50 },
    { code: 'cse-2024-fall-01',   name: 'CSE Batch Fall 2024 — Section A',   sessionKey: '2024-FALL',   capacity: 50 },
    { code: 'cse-2025-spring-01', name: 'CSE Batch Spring 2025 — Section A', sessionKey: '2025-SPRING', capacity: 55 },
    { code: 'cse-2025-spring-02', name: 'CSE Batch Spring 2025 — Section B', sessionKey: '2025-SPRING', capacity: 55 },
    { code: 'cse-2025-fall-01',   name: 'CSE Batch Fall 2025 — Section A',   sessionKey: '2025-FALL',   capacity: 60 },
    { code: 'cse-2026-spring-01', name: 'CSE Batch Spring 2026 — Section A', sessionKey: '2026-SPRING', capacity: 60 },
  ]

  let batchCount = 0
  const batchIdMap: Record<string, string> = {}

  for (const b of BATCH_SEED) {
    const [existing] = await db
      .select({ id: batches.id })
      .from(batches)
      .where(and(eq(batches.tenantId, tenant.id), eq(batches.code, b.code), isNull(batches.deletedAt)))
      .limit(1)

    if (existing) {
      batchIdMap[b.code] = existing.id
      console.log(`  skip  ${b.code}`)
      continue
    }

    const sessionId = sessionIdMap[b.sessionKey] ?? null

    const [batch] = await db.insert(batches).values({
      tenantId:  tenant.id,
      programId,
      sessionId,
      code:      b.code,
      name:      b.name,
      capacity:  b.capacity,
      isActive:  true,
      createdBy: performedBy,
      updatedBy: performedBy,
    }).returning()

    await db.insert(batchAuditLogs).values({
      tenantId: tenant.id, batchId: batch.id, action: 'CREATE', performedBy, snapshot: batch as any,
    })

    batchIdMap[b.code] = batch.id
    batchCount++
    console.log(`  +     ${b.code}  (cap: ${b.capacity}, session: ${b.sessionKey})`)
  }

  console.log(`\n  → ${batchCount} batches seeded.`)

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Students
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Students ────────────────────────────────────────────────────')

  // 20 realistic Bangladeshi-name students spread across batches
  const STUDENT_SEED: Array<{
    studentCode: string; name: string; email: string
    phone: string; address: string; emergencyPhone: string
    nidBirthReg: string
  }> = [
    { studentCode: 'CSE-2024-001', name: 'Farhan Hossain',     email: 'farhan.hossain@student.uams-demo.edu',     phone: '+880-1811-100001', address: 'House 5, Road 3, Dhanmondi, Dhaka',       emergencyPhone: '+880-1811-200001', nidBirthReg: '1991019656789' },
    { studentCode: 'CSE-2024-002', name: 'Nusrat Jahan',       email: 'nusrat.jahan@student.uams-demo.edu',       phone: '+880-1811-100002', address: 'Flat 4B, Mirpur-10, Dhaka',               emergencyPhone: '+880-1811-200002', nidBirthReg: '1992034512345' },
    { studentCode: 'CSE-2024-003', name: 'Rakibul Islam',      email: 'rakibul.islam@student.uams-demo.edu',      phone: '+880-1811-100003', address: '12 Banani DOHS, Dhaka',                   emergencyPhone: '+880-1811-200003', nidBirthReg: '1993045678901' },
    { studentCode: 'CSE-2024-004', name: 'Sabrina Akter',      email: 'sabrina.akter@student.uams-demo.edu',      phone: '+880-1811-100004', address: 'Road 7, Block C, Uttara, Dhaka',          emergencyPhone: '+880-1811-200004', nidBirthReg: '1994056789012' },
    { studentCode: 'CSE-2024-005', name: 'Mahmudul Hasan',     email: 'mahmudul.hasan@student.uams-demo.edu',     phone: '+880-1811-100005', address: 'Sector 6, Uttara, Dhaka',                 emergencyPhone: '+880-1811-200005', nidBirthReg: '1995067890123' },
    { studentCode: 'CSE-2024-006', name: 'Tania Sultana',      email: 'tania.sultana@student.uams-demo.edu',      phone: '+880-1811-100006', address: 'Mohammadpur, Dhaka',                      emergencyPhone: '+880-1811-200006', nidBirthReg: '1996078901234' },
    { studentCode: 'CSE-2024-007', name: 'Imran Hossain',      email: 'imran.hossain@student.uams-demo.edu',      phone: '+880-1811-100007', address: 'Rayer Bazar, Dhaka',                      emergencyPhone: '+880-1811-200007', nidBirthReg: '1997089012345' },
    { studentCode: 'CSE-2024-008', name: 'Sharmin Nahar',      email: 'sharmin.nahar@student.uams-demo.edu',      phone: '+880-1811-100008', address: 'Shyamoli, Dhaka',                         emergencyPhone: '+880-1811-200008', nidBirthReg: '1998090123456' },
    { studentCode: 'CSE-2025-001', name: 'Tahsin Mahmud',      email: 'tahsin.mahmud@student.uams-demo.edu',      phone: '+880-1811-100009', address: 'Wari, Dhaka',                             emergencyPhone: '+880-1811-200009', nidBirthReg: '1999101234567' },
    { studentCode: 'CSE-2025-002', name: 'Anika Islam',        email: 'anika.islam@student.uams-demo.edu',        phone: '+880-1811-100010', address: 'Lalbagh, Dhaka',                          emergencyPhone: '+880-1811-200010', nidBirthReg: '2000112345678' },
    { studentCode: 'CSE-2025-003', name: 'Rishad Kabir',       email: 'rishad.kabir@student.uams-demo.edu',       phone: '+880-1811-100011', address: 'Khilgaon, Dhaka',                         emergencyPhone: '+880-1811-200011', nidBirthReg: '2001123456789' },
    { studentCode: 'CSE-2025-004', name: 'Maliha Chowdhury',   email: 'maliha.chowdhury@student.uams-demo.edu',   phone: '+880-1811-100012', address: 'Gulshan-1, Dhaka',                        emergencyPhone: '+880-1811-200012', nidBirthReg: '2002134567890' },
    { studentCode: 'CSE-2025-005', name: 'Zunaid Hasan',       email: 'zunaid.hasan@student.uams-demo.edu',       phone: '+880-1811-100013', address: 'Bashundhara R/A, Dhaka',                  emergencyPhone: '+880-1811-200013', nidBirthReg: '2003145678901' },
    { studentCode: 'CSE-2025-006', name: 'Fariha Akter',       email: 'fariha.akter@student.uams-demo.edu',       phone: '+880-1811-100014', address: 'Baridhara, Dhaka',                        emergencyPhone: '+880-1811-200014', nidBirthReg: '2004156789012' },
    { studentCode: 'CSE-2025-007', name: 'Nabil Rahman',       email: 'nabil.rahman@student.uams-demo.edu',       phone: '+880-1811-100015', address: 'Lalmatia, Dhaka',                         emergencyPhone: '+880-1811-200015', nidBirthReg: '2005167890123' },
    { studentCode: 'CSE-2025-008', name: 'Sumaiya Begum',      email: 'sumaiya.begum@student.uams-demo.edu',      phone: '+880-1811-100016', address: 'New Market, Dhaka',                       emergencyPhone: '+880-1811-200016', nidBirthReg: '2006178901234' },
    { studentCode: 'CSE-2025-009', name: 'Arfan Ahmed',        email: 'arfan.ahmed@student.uams-demo.edu',        phone: '+880-1811-100017', address: 'Jatrabari, Dhaka',                        emergencyPhone: '+880-1811-200017', nidBirthReg: '2007189012345' },
    { studentCode: 'CSE-2025-010', name: 'Lamiya Tasnim',      email: 'lamiya.tasnim@student.uams-demo.edu',      phone: '+880-1811-100018', address: 'Demra, Dhaka',                            emergencyPhone: '+880-1811-200018', nidBirthReg: '2008190123456' },
    { studentCode: 'CSE-2026-001', name: 'Raiyan Hossain',     email: 'raiyan.hossain@student.uams-demo.edu',     phone: '+880-1811-100019', address: 'Tongi, Gazipur',                          emergencyPhone: '+880-1811-200019', nidBirthReg: '2009201234567' },
    { studentCode: 'CSE-2026-002', name: 'Tasfia Zaman',       email: 'tasfia.zaman@student.uams-demo.edu',       phone: '+880-1811-100020', address: 'Narayanganj Sadar, Narayanganj',           emergencyPhone: '+880-1811-200020', nidBirthReg: '2010212345678' },
  ]

  // Assign students to batches
  const studentBatchMap: Record<string, string> = {
    'CSE-2024-001': 'cse-2024-spring-01',
    'CSE-2024-002': 'cse-2024-spring-01',
    'CSE-2024-003': 'cse-2024-fall-01',
    'CSE-2024-004': 'cse-2024-fall-01',
    'CSE-2024-005': 'cse-2024-fall-01',
    'CSE-2024-006': 'cse-2024-spring-01',
    'CSE-2024-007': 'cse-2024-fall-01',
    'CSE-2024-008': 'cse-2024-spring-01',
    'CSE-2025-001': 'cse-2025-spring-01',
    'CSE-2025-002': 'cse-2025-spring-01',
    'CSE-2025-003': 'cse-2025-spring-02',
    'CSE-2025-004': 'cse-2025-spring-02',
    'CSE-2025-005': 'cse-2025-fall-01',
    'CSE-2025-006': 'cse-2025-fall-01',
    'CSE-2025-007': 'cse-2025-spring-01',
    'CSE-2025-008': 'cse-2025-spring-02',
    'CSE-2025-009': 'cse-2025-fall-01',
    'CSE-2025-010': 'cse-2025-fall-01',
    'CSE-2026-001': 'cse-2026-spring-01',
    'CSE-2026-002': 'cse-2026-spring-01',
  }

  let studentCount = 0

  for (const s of STUDENT_SEED) {
    const [existing] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.tenantId, tenant.id),
        eq(students.studentCode, s.studentCode),
        isNull(students.deletedAt),
      ))
      .limit(1)

    if (existing) {
      console.log(`  skip  ${s.studentCode}  ${s.name}`)
      continue
    }

    const [student] = await db.insert(students).values({
      tenantId:       tenant.id,
      studentCode:    s.studentCode,
      name:           s.name,
      email:          s.email,
      phone:          s.phone,
      address:        s.address,
      emergencyPhone: s.emergencyPhone,
      nidBirthReg:    s.nidBirthReg,
      isActive:       true,
      createdBy:      performedBy,
      updatedBy:      performedBy,
    }).returning()

    await db.insert(studentAuditLogs).values({
      tenantId: tenant.id, studentId: student.id, action: 'CREATE', performedBy, snapshot: student as any,
    })

    studentCount++
    const batchCode = studentBatchMap[s.studentCode] ?? '—'
    console.log(`  +     ${s.studentCode}  ${s.name}  → ${batchCode}`)
  }

  console.log(`\n  → ${studentCount} students seeded.`)

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n✓  Seed complete.')
  await pool.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  pool.end()
  process.exit(1)
})
