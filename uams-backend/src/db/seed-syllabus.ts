import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, and, ilike, isNull } from 'drizzle-orm'
import { courses } from './schema/academic'
import { tenants } from './schema/tenants'
import { courseSyllabi, syllabusTopics } from './schema/syllabus'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db   = drizzle(pool)

async function main() {
  // Resolve tenant
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .limit(1)
  if (!tenant) throw new Error('No active tenant found.')
  console.log(`Tenant: ${tenant.name} (${tenant.id})`)

  // Find the course
  const [course] = await db
    .select({ id: courses.id, code: courses.code, title: courses.title })
    .from(courses)
    .where(and(
      eq(courses.tenantId, tenant.id),
      ilike(courses.title, '%fundamental%computer%'),
      isNull(courses.deletedAt),
    ))
    .limit(1)

  if (!course) throw new Error('Course "Fundamentals of Computer Science" not found. Check the title.')
  console.log(`Course: ${course.code} — ${course.title} (${course.id})`)

  // Check if a syllabus already exists
  const existing = await db
    .select({ id: courseSyllabi.id, version: courseSyllabi.version })
    .from(courseSyllabi)
    .where(and(
      eq(courseSyllabi.tenantId, tenant.id),
      eq(courseSyllabi.courseId, course.id),
      isNull(courseSyllabi.deletedAt),
    ))

  if (existing.length > 0) {
    console.log(`Syllabus already exists (${existing.map(s => s.version).join(', ')}). Skipping.`)
    await pool.end()
    return
  }

  // Create syllabus v1
  const [syllabus] = await db
    .insert(courseSyllabi)
    .values({
      tenantId:  tenant.id,
      courseId:  course.id,
      version:   'v1',
      isDefault: true,
      status:    'final',
    })
    .returning()
  console.log(`Created syllabus ${syllabus.version} (${syllabus.id})`)

  // Topic data
  const topics = [
    {
      orderNo: 1,
      title: 'Introduction to Computing',
      description: 'History of computers, generations of computers, types of computers (analog, digital, hybrid). Overview of computer applications in science, business, education, and everyday life.',
      estimatedHours: '3.0',
    },
    {
      orderNo: 2,
      title: 'Number Systems and Data Representation',
      description: 'Binary, octal, decimal, and hexadecimal number systems. Conversions between number systems. Binary arithmetic (addition, subtraction, multiplication). Representation of integers, floating-point numbers, and characters (ASCII, Unicode).',
      estimatedHours: '5.0',
    },
    {
      orderNo: 3,
      title: 'Boolean Algebra and Logic Gates',
      description: 'Boolean operators: AND, OR, NOT, NAND, NOR, XOR. Truth tables. De Morgan\'s theorems. Simplification of Boolean expressions using algebraic rules and Karnaugh maps. Basic logic gate circuits.',
      estimatedHours: '5.0',
    },
    {
      orderNo: 4,
      title: 'Computer Hardware: CPU and Memory',
      description: 'Von Neumann architecture. Central Processing Unit (CPU): ALU, control unit, registers. Memory hierarchy: registers, cache, RAM, ROM. Primary vs secondary storage. Instruction cycle (fetch-decode-execute).',
      estimatedHours: '6.0',
    },
    {
      orderNo: 5,
      title: 'Input / Output Devices and Storage',
      description: 'Input devices: keyboard, mouse, scanner, microphone, webcam. Output devices: monitor (CRT vs LCD vs LED), printer, speakers. Secondary storage: HDD, SSD, optical discs, USB flash drives. Performance characteristics.',
      estimatedHours: '3.0',
    },
    {
      orderNo: 6,
      title: 'Operating Systems',
      description: 'Role and functions of an operating system. Types of OS: batch, time-sharing, real-time, distributed. Process management, memory management, file systems. Overview of popular operating systems: Windows, Linux, macOS.',
      estimatedHours: '5.0',
    },
    {
      orderNo: 7,
      title: 'Introduction to Programming and Algorithms',
      description: 'What is a program and a programming language? Machine language vs assembly vs high-level languages. Compilers vs interpreters. Concept of algorithm: definition, properties, representation (pseudocode, flowcharts). Problem-solving steps.',
      estimatedHours: '6.0',
    },
    {
      orderNo: 8,
      title: 'Data Structures Overview',
      description: 'Introduction to data structures: arrays, linked lists, stacks, queues, trees, and graphs. Use-cases and conceptual differences. Abstract Data Types (ADT). Time and space complexity basics (Big-O notation introduction).',
      estimatedHours: '5.0',
    },
    {
      orderNo: 9,
      title: 'Computer Networks and the Internet',
      description: 'Introduction to networking: LAN, MAN, WAN. Network topologies (bus, star, ring, mesh). OSI model layers (overview). TCP/IP protocol suite. IP addressing basics (IPv4). Internet services: WWW, email, FTP, DNS.',
      estimatedHours: '5.0',
    },
    {
      orderNo: 10,
      title: 'Database Fundamentals',
      description: 'What is a database and a DBMS? Relational model: tables, rows, columns, keys. Basic SQL: SELECT, INSERT, UPDATE, DELETE. Introduction to NoSQL databases. Data integrity and normalization concepts.',
      estimatedHours: '4.0',
    },
    {
      orderNo: 11,
      title: 'Software Development Life Cycle (SDLC)',
      description: 'Phases of SDLC: planning, requirements analysis, design, implementation, testing, deployment, maintenance. Waterfall vs Agile methodologies. Introduction to version control (Git basics). Importance of documentation and testing.',
      estimatedHours: '4.0',
    },
    {
      orderNo: 12,
      title: 'Cybersecurity and Ethics',
      description: 'Common security threats: malware, phishing, SQL injection, DDoS. Principles of information security: confidentiality, integrity, availability (CIA triad). Encryption basics (symmetric vs asymmetric). Ethical use of computers, intellectual property, privacy laws.',
      estimatedHours: '4.0',
    },
  ]

  const topicRows = topics.map(t => ({
    tenantId:       tenant.id,
    syllabusId:     syllabus.id,
    title:          t.title,
    description:    t.description,
    orderNo:        t.orderNo,
    estimatedHours: t.estimatedHours,
    status:         'final' as const,
  }))

  await db.insert(syllabusTopics).values(topicRows)
  console.log(`Inserted ${topicRows.length} topics.`)

  const totalHours = topics.reduce((s, t) => s + parseFloat(t.estimatedHours), 0)
  console.log(`\nSyllabus seeded successfully.`)
  console.log(`  Course  : ${course.code} — ${course.title}`)
  console.log(`  Version : v1 (final, default)`)
  console.log(`  Topics  : ${topics.length}`)
  console.log(`  Total   : ${totalHours} estimated hours`)

  await pool.end()
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1) })
