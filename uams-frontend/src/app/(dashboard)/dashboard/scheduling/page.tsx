'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, BookOpen, Plus, Trash2, History, ChevronDown, X, Check } from 'lucide-react'
import { listProgramsApi }  from '@/lib/api/academic'
import { listSessionsApi }  from '@/lib/api/sessions'
import { listTeachersApi }  from '@/lib/api/teachers'
import { listBatchesApi }   from '@/lib/api/batches'
import {
  listSemesterOfferingsApi, createSemesterOfferingApi, updateSemesterOfferingApi,
  listCourseOfferingsApi, getAvailableCoursesApi,
  bulkSaveCourseOfferingsApi, deleteCourseOfferingApi,
  getSemesterOfferingAuditLogsApi, getCourseOfferingAuditLogsApi,
  type SemesterOfferingStatus, type CourseOfferingRow,
} from '@/lib/api/scheduling'
import type { AuditLogEntry } from '@/lib/api/academic'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SemesterOfferingStatus, string> = {
  planned:   'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Course row state ──────────────────────────────────────────────────────────

interface CourseRow {
  courseOfferingId: string | null   // null = new (not yet saved)
  courseId:         string
  courseCode:       string
  courseTitle:      string
  credits:          number
  courseType:       'CORE' | 'ELECTIVE'
  batchId:          string
  capacity:         string
  teacherId:        string
  dirty:            boolean
}

// ── History Modal ─────────────────────────────────────────────────────────────

function HistoryModal({
  title, logs, onClose,
}: {
  title: string
  logs: AuditLogEntry[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No history yet.</p>
          ) : logs.map((log) => (
            <div key={log.id} className="border border-gray-100 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                  log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{log.action}</span>
                <span className="text-gray-500">{log.performedByName}</span>
                <span className="text-gray-400 ml-auto">{fmt(log.createdAt)}</span>
              </div>
              <pre className="text-xs text-gray-500 bg-gray-50 rounded p-2 overflow-auto max-h-40">
                {JSON.stringify(log.snapshot, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulingPage() {
  const qc = useQueryClient()

  // ── Selectors ──────────────────────────────────────────────────────────────
  const [programId,  setProgramId]  = useState('')
  const [sessionId,  setSessionId]  = useState('')
  const [semesterNo, setSemesterNo] = useState(1)

  // ── Semester offering form ─────────────────────────────────────────────────
  const [semStatus,    setSemStatus]    = useState<SemesterOfferingStatus>('planned')
  const [semStartDate, setSemStartDate] = useState('')
  const [semEndDate,   setSemEndDate]   = useState('')

  // ── Course row edits ───────────────────────────────────────────────────────
  const [courseRows, setCourseRows] = useState<CourseRow[]>([])

  // ── History ────────────────────────────────────────────────────────────────
  const [historyLogs,  setHistoryLogs]  = useState<AuditLogEntry[] | null>(null)
  const [historyTitle, setHistoryTitle] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: programs } = useQuery({
    queryKey: ['programs-all'],
    queryFn:  () => listProgramsApi(1, undefined, undefined, 200),
  })

  const { data: sessions } = useQuery({
    queryKey: ['sessions-all'],
    queryFn:  () => listSessionsApi(1, undefined, 200),
  })

  const { data: teachersData } = useQuery({
    queryKey: ['teachers-all'],
    queryFn:  () => listTeachersApi(1, undefined, undefined, undefined, 200),
  })
  const teachers = teachersData?.data ?? []

  const { data: batchesData } = useQuery({
    queryKey: ['batches', programId],
    queryFn:  () => listBatchesApi(1, programId, undefined, 200),
    enabled:  !!programId,
  })
  const batches = batchesData?.data ?? []

  // Current semester offering (if any)
  const enabled = !!(programId && sessionId)
  const { data: semOffPage } = useQuery({
    queryKey: ['sem-offering', programId, sessionId, semesterNo],
    queryFn:  () => listSemesterOfferingsApi({ programId, sessionId, semesterNo, limit: 1 }),
    enabled,
  })
  const semOff = semOffPage?.data?.[0] ?? null

  // Course offerings for the current semester offering
  const { data: courseOffPage } = useQuery({
    queryKey: ['course-offerings', semOff?.id],
    queryFn:  () => listCourseOfferingsApi(semOff!.id),
    enabled:  !!semOff,
  })

  // Available courses (from programCourses for this semesterNo)
  const { data: availableCoursesData } = useQuery({
    queryKey: ['available-courses', semOff?.id],
    queryFn:  () => getAvailableCoursesApi(semOff!.id),
    enabled:  !!semOff,
  })
  const availableCourses = availableCoursesData?.data ?? []

  // ── Sync form + rows when semOff changes ───────────────────────────────────
  useEffect(() => {
    if (semOff) {
      setSemStatus(semOff.status)
      setSemStartDate(semOff.startDate ?? '')
      setSemEndDate(semOff.endDate ?? '')
    } else {
      setSemStatus('planned')
      setSemStartDate('')
      setSemEndDate('')
    }
  }, [semOff?.id])

  useEffect(() => {
    const existing = courseOffPage?.data ?? []
    setCourseRows(existing.map((co): CourseRow => ({
      courseOfferingId: co.id,
      courseId:         co.courseId,
      courseCode:       co.courseCode,
      courseTitle:      co.courseTitle,
      credits:          co.credits,
      courseType:       co.courseType,
      batchId:          co.batchId ?? '',
      capacity:         co.capacity != null ? String(co.capacity) : '',
      teacherId:        co.teacherId ?? '',
      dirty:            false,
    })))
  }, [courseOffPage?.data])

  // ── Semester offering mutations ────────────────────────────────────────────
  const saveSemMut = useMutation({
    mutationFn: async () => {
      const payload = {
        status:    semStatus,
        startDate: semStartDate || null,
        endDate:   semEndDate   || null,
      }
      if (semOff) {
        return updateSemesterOfferingApi(semOff.id, payload)
      }
      return createSemesterOfferingApi({ programId, sessionId, semesterNo, ...payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sem-offering', programId, sessionId, semesterNo] })
    },
  })

  // ── Course save mutation ───────────────────────────────────────────────────
  const saveCourseMut = useMutation({
    mutationFn: async (rows: CourseRow[]) => {
      if (!semOff) throw new Error('Save the semester offering first.')
      const payload = rows.map(r => ({
        courseId:  r.courseId,
        batchId:   r.batchId || null,
        capacity:  r.capacity ? Number(r.capacity) : null,
        teacherId: r.teacherId || null,
      }))
      return bulkSaveCourseOfferingsApi(semOff.id, { semesterOfferingId: semOff.id, courses: payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-offerings', semOff?.id] })
      qc.invalidateQueries({ queryKey: ['sem-offering', programId, sessionId, semesterNo] })
    },
  })

  // ── Delete course offering mutation ───────────────────────────────────────
  const deleteCourseMut = useMutation({
    mutationFn: ({ semOffId, id }: { semOffId: string; id: string }) =>
      deleteCourseOfferingApi(semOffId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-offerings', semOff?.id] })
    },
  })

  // ── Row helpers ────────────────────────────────────────────────────────────
  function updateRow(idx: number, patch: Partial<CourseRow>) {
    setCourseRows(rows => rows.map((r, i) => i === idx ? { ...r, ...patch, dirty: true } : r))
  }

  function addCourse(courseId: string) {
    const ac = availableCourses.find(c => c.courseId === courseId)
    if (!ac) return
    if (courseRows.some(r => r.courseId === courseId)) return
    setCourseRows(rows => [...rows, {
      courseOfferingId: null,
      courseId:         ac.courseId,
      courseCode:       ac.courseCode,
      courseTitle:      ac.courseTitle,
      credits:          ac.credits,
      courseType:       ac.courseType,
      batchId:          '',
      capacity:         '',
      teacherId:        '',
      dirty:            true,
    }])
  }

  function removeRow(idx: number) {
    const row = courseRows[idx]
    if (row.courseOfferingId && semOff) {
      deleteCourseMut.mutate({ semOffId: semOff.id, id: row.courseOfferingId })
    } else {
      setCourseRows(rows => rows.filter((_, i) => i !== idx))
    }
  }

  const dirtyRows = courseRows.filter(r => r.dirty)

  // ── History helpers ────────────────────────────────────────────────────────
  async function showSemHistory() {
    if (!semOff) return
    const { data } = await getSemesterOfferingAuditLogsApi(semOff.id)
    setHistoryTitle(`Semester ${semOff.semesterNo} — ${semOff.programCode} — History`)
    setHistoryLogs(data)
  }

  async function showCourseHistory(co: CourseOfferingRow) {
    if (!semOff) return
    const { data } = await getCourseOfferingAuditLogsApi(semOff.id, co.id)
    setHistoryTitle(`${co.courseCode}${co.batchName ? ` · ${co.batchName}` : ''} — History`)
    setHistoryLogs(data)
  }

  // ── Not-yet-added courses (for + dropdown) ────────────────────────────────
  const alreadyAdded = new Set(courseRows.map(r => r.courseId))
  const addableCourses = availableCourses.filter(c => !alreadyAdded.has(c.courseId))

  const durationSemesters = programs?.data.find(p => p.id === programId)?.durationSemesters ?? 8

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* History modal */}
      {historyLogs !== null && (
        <HistoryModal
          title={historyTitle}
          logs={historyLogs}
          onClose={() => setHistoryLogs(null)}
        />
      )}

      {/* ── Selectors ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <CalendarDays size={16} className="text-indigo-500" />
          Semester Scheduling
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Program</label>
            <select
              value={programId}
              onChange={e => { setProgramId(e.target.value); setSemesterNo(1) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select program…</option>
              {programs?.data.map(p => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
            <select
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select session…</option>
              {sessions?.data.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Semester No.</label>
            <select
              value={semesterNo}
              onChange={e => setSemesterNo(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              disabled={!programId}
            >
              {Array.from({ length: durationSemesters }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>Semester {n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Semester Offering Card ──────────────────────────────────────── */}
      {enabled && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-800">Semester Offering</h3>
              {semOff && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[semOff.status]}`}>
                  {semOff.status}
                </span>
              )}
              {!semOff && (
                <span className="text-xs text-gray-400 italic">Not created yet</span>
              )}
            </div>
            {semOff && (
              <button
                onClick={showSemHistory}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <History size={14} /> History
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={semStatus}
                onChange={e => setSemStatus(e.target.value as SemesterOfferingStatus)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={semStartDate}
                onChange={e => setSemStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={semEndDate}
                onChange={e => setSemEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {saveSemMut.error && (
            <p className="text-sm text-red-500 mb-3">
              {(saveSemMut.error as any)?.response?.data?.error ?? 'Failed to save.'}
            </p>
          )}

          <button
            onClick={() => saveSemMut.mutate()}
            disabled={saveSemMut.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saveSemMut.isPending ? 'Saving…' : semOff ? 'Update Semester Offering' : 'Create Semester Offering'}
          </button>
        </div>
      )}

      {/* ── Course Schedule ─────────────────────────────────────────────── */}
      {semOff && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-500" />
              Course Schedule
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({courseRows.length} course{courseRows.length !== 1 ? 's' : ''})
              </span>
            </h3>

            {/* Add course dropdown */}
            <div className="relative group">
              <button
                disabled={addableCourses.length === 0}
                className="flex items-center gap-1.5 text-sm bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Course <ChevronDown size={12} />
              </button>
              {addableCourses.length > 0 && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-lg w-72 max-h-64 overflow-y-auto hidden group-hover:block">
                  {addableCourses.map(c => (
                    <button
                      key={c.courseId}
                      onClick={() => addCourse(c.courseId)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2"
                    >
                      <span className={`text-xs px-1.5 py-0.5 rounded ${c.courseType === 'CORE' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                        {c.courseType}
                      </span>
                      <span className="font-medium text-gray-800">{c.courseCode}</span>
                      <span className="text-gray-500 truncate">{c.courseTitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          {courseRows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No courses scheduled yet. Use "Add Course" to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium">
                    <th className="text-left px-4 py-3">Course</th>
                    <th className="text-left px-4 py-3 w-44">Batch</th>
                    <th className="text-left px-4 py-3 w-24">Capacity</th>
                    <th className="text-left px-4 py-3">Teacher</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {courseRows.map((row, idx) => (
                    <tr key={row.courseId} className={row.dirty ? 'bg-amber-50/40' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${row.courseType === 'CORE' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                            {row.courseType}
                          </span>
                          <span className="font-medium text-gray-800">{row.courseCode}</span>
                          <span className="text-gray-500 hidden sm:block truncate max-w-xs">{row.courseTitle}</span>
                          <span className="text-gray-400 text-xs">{row.credits}cr</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.batchId}
                          onChange={e => updateRow(idx, { batchId: e.target.value })}
                          className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          <option value="">— No batch —</option>
                          {batches.map(b => (
                            <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.capacity}
                          onChange={e => updateRow(idx, { capacity: e.target.value })}
                          placeholder="—"
                          min={1}
                          className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.teacherId}
                          onChange={e => updateRow(idx, { teacherId: e.target.value })}
                          className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          <option value="">Unassigned</option>
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {row.courseOfferingId && (
                            <button
                              onClick={() => {
                                const co = courseOffPage?.data.find(c => c.id === row.courseOfferingId)
                                if (co) showCourseHistory(co)
                              }}
                              title="History"
                              className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                            >
                              <History size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => removeRow(idx)}
                            title="Remove"
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Save courses footer */}
          {dirtyRows.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-amber-50/60">
              <p className="text-sm text-amber-700">
                {dirtyRows.length} unsaved change{dirtyRows.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                {saveCourseMut.error && (
                  <span className="text-xs text-red-500">
                    {(saveCourseMut.error as any)?.response?.data?.error ?? 'Failed.'}
                  </span>
                )}
                <button
                  onClick={() => saveCourseMut.mutate(courseRows)}
                  disabled={saveCourseMut.isPending}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  <Check size={14} />
                  {saveCourseMut.isPending ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Placeholder when nothing selected ──────────────────────────── */}
      {!enabled && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <CalendarDays size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">Select a program and session to start scheduling.</p>
        </div>
      )}
    </div>
  )
}
