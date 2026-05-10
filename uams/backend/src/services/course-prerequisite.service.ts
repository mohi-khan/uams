import { eq, and, asc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../lib/db'
import { courses, coursePrerequisites } from '../db/schema/academic'
import type { AddPrerequisiteInput } from '../lib/validators/academic.validator'

export async function listPrerequisites(tenantId: string, courseId: string) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  const prereqAlias = alias(courses, 'prereq_course')

  return db
    .select({
      id:                      coursePrerequisites.id,
      courseId:                coursePrerequisites.courseId,
      prerequisiteCourseId:    coursePrerequisites.prerequisiteCourseId,
      prerequisiteCourseCode:  prereqAlias.code,
      prerequisiteCourseTitle: prereqAlias.title,
      minGrade:                coursePrerequisites.minGrade,
      isMandatory:             coursePrerequisites.isMandatory,
    })
    .from(coursePrerequisites)
    .innerJoin(prereqAlias, eq(coursePrerequisites.prerequisiteCourseId, prereqAlias.id))
    .where(and(
      eq(coursePrerequisites.tenantId, tenantId),
      eq(coursePrerequisites.courseId, courseId),
    ))
    .orderBy(asc(prereqAlias.code))
}

export async function addPrerequisite(
  tenantId: string,
  performedBy: string,
  courseId: string,
  input: AddPrerequisiteInput,
) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  if (courseId === input.prerequisiteCourseId)
    throw new Error('A course cannot be its own prerequisite.')

  const [prereqCourse] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.prerequisiteCourseId), eq(courses.tenantId, tenantId)))
    .limit(1)
  if (!prereqCourse) throw new Error('Prerequisite course not found.')

  const [existing] = await db
    .select({ id: coursePrerequisites.id })
    .from(coursePrerequisites)
    .where(and(
      eq(coursePrerequisites.tenantId, tenantId),
      eq(coursePrerequisites.courseId, courseId),
      eq(coursePrerequisites.prerequisiteCourseId, input.prerequisiteCourseId),
    ))
    .limit(1)
  if (existing) throw new Error('This prerequisite already exists.')

  const [row] = await db.insert(coursePrerequisites).values({
    tenantId,
    courseId,
    prerequisiteCourseId: input.prerequisiteCourseId,
    minGrade:             input.minGrade ?? null,
    isMandatory:          input.isMandatory ?? true,
    createdBy:            performedBy,
  }).returning()

  return row
}

export async function removePrerequisite(tenantId: string, courseId: string, id: string) {
  const [existing] = await db
    .select({ id: coursePrerequisites.id })
    .from(coursePrerequisites)
    .where(and(
      eq(coursePrerequisites.id, id),
      eq(coursePrerequisites.tenantId, tenantId),
      eq(coursePrerequisites.courseId, courseId),
    ))
    .limit(1)
  if (!existing) throw new Error('Prerequisite not found.')

  await db.delete(coursePrerequisites).where(eq(coursePrerequisites.id, id))

  return { message: 'Prerequisite removed.' }
}
