import { eq, and, asc } from 'drizzle-orm'
import { db } from '../lib/db'
import { programs, programCourses, courses } from '../db/schema/academic'
import type { AddProgramCourseInput, UpdateProgramCourseInput } from '../lib/validators/academic.validator'

export async function listProgramCourses(tenantId: string, programId: string) {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId)))
    .limit(1)
  if (!program) throw new Error('Program not found.')

  return db
    .select({
      id:          programCourses.id,
      programId:   programCourses.programId,
      courseId:    programCourses.courseId,
      courseCode:  courses.code,
      courseTitle: courses.title,
      credits:     courses.credits,
      courseType:  courses.type,
      semesterNo:  programCourses.semesterNo,
      isMandatory: programCourses.isMandatory,
    })
    .from(programCourses)
    .innerJoin(courses, eq(programCourses.courseId, courses.id))
    .where(and(eq(programCourses.tenantId, tenantId), eq(programCourses.programId, programId)))
    .orderBy(asc(programCourses.semesterNo), asc(courses.code))
}

export async function addCourseToProgram(
  tenantId: string,
  performedBy: string,
  programId: string,
  input: AddProgramCourseInput,
) {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId)))
    .limit(1)
  if (!program) throw new Error('Program not found.')

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), eq(courses.tenantId, tenantId)))
    .limit(1)
  if (!course) throw new Error('Course not found.')

  const [existing] = await db
    .select({ id: programCourses.id })
    .from(programCourses)
    .where(and(
      eq(programCourses.tenantId, tenantId),
      eq(programCourses.programId, programId),
      eq(programCourses.courseId, input.courseId),
    ))
    .limit(1)
  if (existing) throw new Error('Course is already in this program.')

  const [row] = await db.insert(programCourses).values({
    tenantId,
    programId,
    courseId:    input.courseId,
    semesterNo:  input.semesterNo,
    isMandatory: input.isMandatory,
    createdBy:   performedBy,
  }).returning()

  return row
}

export async function updateProgramCourse(
  tenantId: string,
  programId: string,
  id: string,
  input: UpdateProgramCourseInput,
) {
  const [existing] = await db
    .select({ id: programCourses.id })
    .from(programCourses)
    .where(and(
      eq(programCourses.id, id),
      eq(programCourses.tenantId, tenantId),
      eq(programCourses.programId, programId),
    ))
    .limit(1)
  if (!existing) throw new Error('Mapping not found.')

  const [row] = await db
    .update(programCourses)
    .set({
      ...(input.semesterNo  !== undefined && { semesterNo:  input.semesterNo }),
      ...(input.isMandatory !== undefined && { isMandatory: input.isMandatory }),
    })
    .where(eq(programCourses.id, id))
    .returning()

  return row
}

export async function removeCourseFromProgram(tenantId: string, programId: string, id: string) {
  const [existing] = await db
    .select({ id: programCourses.id })
    .from(programCourses)
    .where(and(
      eq(programCourses.id, id),
      eq(programCourses.tenantId, tenantId),
      eq(programCourses.programId, programId),
    ))
    .limit(1)
  if (!existing) throw new Error('Mapping not found.')

  await db.delete(programCourses).where(eq(programCourses.id, id))

  return { message: 'Course removed from program.' }
}
