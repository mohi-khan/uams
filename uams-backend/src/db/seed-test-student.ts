/**
 * Dev-only seed: creates a test student with a fixed UUID + linked user account.
 * Run: npm run db:seed:test
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, and, isNull } from 'drizzle-orm'
import { tenants } from './schema/tenants'
import { users } from './schema/users'
import { students } from './schema/enrollment'

const TEST_STUDENT_ID   = '74df7a19-4405-4982-9367-05c564b162f7'
const GMAIL_ACCOUNT     = 'test.student@gmail.com'
const STUDENT_CODE      = 'TEST-001'
const STUDENT_NAME      = 'Test Student'
const CONTACT_EMAIL     = 'test.student@uams-demo.edu'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db   = drizzle(pool)

async function main() {
  console.log('🧪  Seeding test student…\n')

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).limit(1)
  if (!tenant) {
    console.error('✗  No tenant found. Register a university first.')
    process.exit(1)
  }
  console.log(`✓  Tenant: ${tenant.name} (${tenant.id})`)

  // ── User account ──────────────────────────────────────────────────────────
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, GMAIL_ACCOUNT)))
    .limit(1)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
    console.log(`  skip  User already exists: ${userId}`)
  } else {
    const [user] = await db.insert(users).values({
      tenantId:     tenant.id,
      email:        GMAIL_ACCOUNT,
      authProvider: 'google',
      firstName:    'Test',
      lastName:     'Student',
      role:         'student',
      status:       'active',
      isActive:     true,
    }).returning()
    userId = user.id
    console.log(`  +     User created: ${userId}  (${GMAIL_ACCOUNT})`)
  }

  // ── Student record ────────────────────────────────────────────────────────
  const [existingById] = await db
    .select({ id: students.id, studentCode: students.studentCode })
    .from(students)
    .where(and(eq(students.id, TEST_STUDENT_ID), isNull(students.deletedAt)))
    .limit(1)

  if (existingById) {
    console.log(`  skip  Student with target ID already exists: ${existingById.id}`)
  } else {
    // Check code collision
    const [codeTaken] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, tenant.id), eq(students.studentCode, STUDENT_CODE), isNull(students.deletedAt)))
      .limit(1)

    if (codeTaken) {
      console.warn(`  ⚠   Student code ${STUDENT_CODE} already taken — skipping student insert.`)
    } else {
      await db.insert(students).values({
        id:           TEST_STUDENT_ID,
        tenantId:     tenant.id,
        studentCode:  STUDENT_CODE,
        name:         STUDENT_NAME,
        email:        CONTACT_EMAIL,
        gmailAccount: GMAIL_ACCOUNT,
        phone:        '+880-1900-000001',
        address:      'Test Address, Dhaka',
        isActive:     true,
        createdBy:    userId,
        updatedBy:    userId,
      })
      console.log(`  +     Student created: ${TEST_STUDENT_ID}  (${STUDENT_CODE} — ${STUDENT_NAME})`)
    }
  }

  console.log('\n✓  Done.')
  await pool.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  pool.end()
  process.exit(1)
})
