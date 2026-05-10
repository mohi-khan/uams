'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarDays, Users, Clock, GraduationCap, ChevronRight } from 'lucide-react'
import { getMyAssignedCoursesApi, type AssignedCourseRow, type SemesterOfferingStatus } from '@/lib/api/teachers'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<SemesterOfferingStatus, string> = {
  planned:   'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
}

function fmt(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Course Card ───────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: AssignedCourseRow }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all p-5 flex flex-col gap-3">
      {/* Top row: type badge + code + credits */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            course.courseType === 'CORE'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-orange-50 text-orange-700'
          }`}>
            {course.courseType}
          </span>
          <span className="font-mono text-sm font-bold text-gray-700">{course.courseCode}</span>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{course.credits} cr</span>
      </div>

      {/* Title */}
      <p className="font-semibold text-gray-900 leading-snug">{course.courseTitle}</p>

      {/* Meta rows */}
      <div className="space-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <GraduationCap size={13} className="text-indigo-400 shrink-0" />
          <span className="truncate">{course.programName} <span className="text-gray-400">({course.programCode})</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={13} className="text-indigo-400 shrink-0" />
          <span>{course.sessionName} · Semester {course.semesterNo}</span>
        </div>
        {course.batchName && (
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-indigo-400 shrink-0" />
            <span>{course.batchCode} — {course.batchName}</span>
            {course.capacity != null && (
              <span className="text-gray-400 ml-1">· cap {course.capacity}</span>
            )}
          </div>
        )}
      </div>

      {/* Footer: semester status + dates */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[course.semesterStatus]}`}>
          {course.semesterStatus}
        </span>
        {(course.semesterStartDate || course.semesterEndDate) && (
          <span className="text-xs text-gray-400">
            {fmt(course.semesterStartDate) ?? '?'}
            {course.semesterEndDate && <> <ChevronRight size={10} className="inline" /> {fmt(course.semesterEndDate)}</>}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyCoursesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-assigned-courses'],
    queryFn:  getMyAssignedCoursesApi,
  })

  // Group courses by semester offering (program + session + semesterNo)
  const groups = useMemo(() => {
    if (!data?.data) return []
    const map = new Map<string, { label: string; status: SemesterOfferingStatus; courses: AssignedCourseRow[] }>()
    for (const row of data.data) {
      const key = row.semesterOfferingId
      if (!map.has(key)) {
        map.set(key, {
          label:   `${row.programName} · ${row.sessionName} · Semester ${row.semesterNo}`,
          status:  row.semesterStatus,
          courses: [],
        })
      }
      map.get(key)!.courses.push(row)
    }
    // Sort groups: active first, then planned, then completed
    const order: SemesterOfferingStatus[] = ['active', 'planned', 'completed']
    return [...map.values()].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
  }, [data?.data])

  const totalCourses = data?.data.length ?? 0
  const activeCourses = data?.data.filter(c => c.semesterStatus === 'active').length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <BookOpen size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Courses</h1>
            {data?.teacher && (
              <p className="text-sm text-gray-500">{data.teacher.name} · {data.teacher.designation}</p>
            )}
          </div>
        </div>

        {/* Summary chips */}
        {!isLoading && data && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm">
              <Clock size={14} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">{activeCourses} active</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm">
              <BookOpen size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{totalCourses} total</span>
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl h-44 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-sm text-red-600">
          {(error as any)?.response?.data?.error ?? 'Failed to load courses.'}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && totalCourses === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-20 text-center">
          <BookOpen size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400">No courses assigned yet.</p>
          <p className="text-xs text-gray-300 mt-1">The academic coordinator will assign courses during semester scheduling.</p>
        </div>
      )}

      {/* Grouped course cards */}
      {!isLoading && groups.map((group) => (
        <div key={group.label} className="space-y-3">
          {/* Group header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{group.label}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[group.status]}`}>
              {group.status}
            </span>
            <span className="text-xs text-gray-400">{group.courses.length} course{group.courses.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.courses.map((course) => (
              <CourseCard key={course.courseOfferingId} course={course} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
