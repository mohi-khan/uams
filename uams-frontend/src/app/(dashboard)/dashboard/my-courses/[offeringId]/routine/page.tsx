'use client'

import { useState, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CalendarDays, List, ChevronLeft, ChevronRight,
  MapPin, Clock, BookOpen, X, CheckCircle2, AlertTriangle,
  Loader2, Tag,
} from 'lucide-react'
import { listSchedulesApi, assignTopicApi, cancelScheduleApi, type ScheduleRow } from '@/lib/api/class-schedule'
import { listSyllabiApi, getSyllabusApi } from '@/lib/api/syllabus'

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const s = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const e = end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED:   'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED:   'bg-green-50 text-green-700 border-green-200',
  CANCELLED:   'bg-red-50 text-red-500 border-red-100',
  RESCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
}

// ── Class cell ────────────────────────────────────────────────────────────────

function ClassCell({ row, onClick }: { row: ScheduleRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-2 py-1.5 text-xs hover:shadow-sm transition-shadow ${STATUS_COLOR[row.status] ?? 'bg-gray-50 border-gray-200'}`}
    >
      {row.roomName && (
        <p className="text-gray-500 truncate">{row.roomName}</p>
      )}
      {row.syllabusTopicId && (
        <p className="font-medium truncate mt-0.5">{row.notes ?? 'Topic assigned'}</p>
      )}
      {row.isMakeupClass && (
        <span className="text-amber-600 font-semibold">Makeup</span>
      )}
    </button>
  )
}

// ── Side panel ────────────────────────────────────────────────────────────────

function SidePanel({
  row,
  courseId,
  onClose,
  onUpdated,
  onCancelled,
}: {
  row:         ScheduleRow
  courseId:    string
  onClose:     () => void
  onUpdated:   (updated: ScheduleRow) => void
  onCancelled: (id: string) => void
}) {
  const qc = useQueryClient()
  const [selectedTopicId, setSelectedTopicId] = useState(row.syllabusTopicId ?? '')
  const [confirmCancel, setConfirmCancel]      = useState(false)
  const [saveOk, setSaveOk]                    = useState(false)

  // Fetch syllabus for topic picker
  const { data: syllabiRes } = useQuery({
    queryKey: ['syllabi', courseId],
    queryFn:  () => listSyllabiApi(courseId),
    enabled:  !!courseId,
  })
  const syllabi      = syllabiRes?.data ?? []
  const pickedSyllab = syllabi.find(s => s.isDefault) ?? syllabi.find(s => s.status === 'final') ?? syllabi[0]

  const { data: syllabusDetail } = useQuery({
    queryKey: ['syllabus-detail', pickedSyllab?.id],
    queryFn:  () => getSyllabusApi(pickedSyllab!.id),
    enabled:  !!pickedSyllab?.id,
  })
  const topics = syllabusDetail?.topics ?? []

  const saveMut = useMutation({
    mutationFn: () => assignTopicApi(row.id, selectedTopicId || null),
    onSuccess: (updated) => {
      setSaveOk(true)
      onUpdated(updated)
      qc.invalidateQueries({ queryKey: ['schedules', row.id] })
      setTimeout(() => setSaveOk(false), 2000)
    },
  })

  const cancelMut = useMutation({
    mutationFn: () => cancelScheduleApi(row.id),
    onSuccess: () => {
      onCancelled(row.id)
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{row.dayOfWeek}</p>
            <p className="font-semibold text-gray-900">
              {new Date(row.sessionDate + 'T00:00:00').toLocaleDateString('en-GB', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 py-4 space-y-3 border-b border-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} className="text-indigo-400 shrink-0" />
            <span>{row.slotName}</span>
            {row.slotStart && row.slotEnd && (
              <span className="text-gray-400">({row.slotStart} – {row.slotEnd})</span>
            )}
          </div>
          {row.roomName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={14} className="text-indigo-400 shrink-0" />
              <span>{row.roomName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[row.status] ?? ''}`}>
              {row.status}
            </span>
            {row.isMakeupClass && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Makeup class
              </span>
            )}
          </div>
          {row.notes && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{row.notes}</p>
          )}
        </div>

        {/* Syllabus topic picker */}
        <div className="px-5 py-4 space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-indigo-400" />
            <p className="text-sm font-semibold text-gray-700">Syllabus Topic</p>
          </div>

          {topics.length === 0 ? (
            <p className="text-xs text-gray-400">No syllabus topics found for this course.</p>
          ) : (
            <select
              value={selectedTopicId}
              onChange={e => { setSelectedTopicId(e.target.value); setSaveOk(false) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— no topic —</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.orderNo}. {t.title}
                  {t.estimatedHours ? ` (${t.estimatedHours}h)` : ''}
                </option>
              ))}
            </select>
          )}

          {saveOk && (
            <p className="flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 size={12} /> Topic saved.
            </p>
          )}
          {saveMut.isError && (
            <p className="text-xs text-red-600">{(saveMut.error as any)?.response?.data?.error ?? 'Save failed.'}</p>
          )}

          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || topics.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saveMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} />}
            Save topic
          </button>
        </div>

        {/* Cancel class */}
        {row.status === 'SCHEDULED' && (
          <div className="px-5 py-4 border-t border-gray-100">
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Cancel this class
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">Are you sure you want to cancel this class?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => cancelMut.mutate()}
                    disabled={cancelMut.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-md transition-colors"
                  >
                    {cancelMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                    Yes, cancel
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  schedules,
  weekStart,
  onClassClick,
}: {
  schedules:    ScheduleRow[]
  weekStart:    Date
  onClassClick: (row: ScheduleRow) => void
}) {
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  // Distinct time slots ordered by start time
  const slots = useMemo(() => {
    const seen = new Set<string>()
    const list: { id: string; name: string; start: string; end: string }[] = []
    for (const s of schedules) {
      if (s.timeSlotId && !seen.has(s.timeSlotId)) {
        seen.add(s.timeSlotId)
        list.push({ id: s.timeSlotId, name: s.slotName ?? '', start: s.slotStart ?? '', end: s.slotEnd ?? '' })
      }
    }
    return list.sort((a, b) => a.start.localeCompare(b.start))
  }, [schedules])

  const scheduleMap = useMemo(() => {
    const m: Record<string, ScheduleRow> = {}
    for (const s of schedules) m[`${s.sessionDate}|${s.timeSlotId}`] = s
    return m
  }, [schedules])

  const weekSchedules = schedules.filter(s =>
    s.sessionDate >= toYMD(weekStart) && s.sessionDate <= toYMD(addDays(weekStart, 6))
  )

  if (slots.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-gray-400">
        No classes scheduled for this week.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[640px]">
        <thead>
          <tr>
            <th className="w-24 text-left text-xs text-gray-400 font-medium pb-3 pr-3">Slot</th>
            {weekDays.map(d => {
              const dateStr = toYMD(d)
              const hasClass = weekSchedules.some(s => s.sessionDate === dateStr)
              return (
                <th key={dateStr} className={`text-center text-xs font-medium pb-3 px-1 ${hasClass ? 'text-gray-700' : 'text-gray-300'}`}>
                  {fmtDay(d)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {slots.map(slot => (
            <tr key={slot.id}>
              <td className="py-2 pr-3 align-top">
                <p className="text-xs font-medium text-gray-600">{slot.name}</p>
                <p className="text-xs text-gray-400">{slot.start}–{slot.end}</p>
              </td>
              {weekDays.map(d => {
                const dateStr = toYMD(d)
                const row = scheduleMap[`${dateStr}|${slot.id}`]
                return (
                  <td key={dateStr} className="py-2 px-1 align-top">
                    {row ? (
                      <ClassCell row={row} onClick={() => onClassClick(row)} />
                    ) : (
                      <div className="w-full h-8 rounded-lg bg-gray-50" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({
  schedules,
  onClassClick,
}: {
  schedules:    ScheduleRow[]
  onClassClick: (row: ScheduleRow) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>()
    const sorted = [...schedules].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    for (const s of sorted) {
      const existing = map.get(s.sessionDate) ?? []
      existing.push(s)
      map.set(s.sessionDate, existing)
    }
    return [...map.entries()]
  }, [schedules])

  if (grouped.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-16">No classes scheduled.</p>
  }

  return (
    <div className="space-y-4">
      {grouped.map(([date, rows]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
          <div className="space-y-2">
            {rows.map(row => (
              <button
                key={row.id}
                onClick={() => onClassClick(row)}
                className="w-full text-left bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all flex items-center gap-4"
              >
                <div className="text-xs text-gray-500 min-w-[70px] shrink-0">
                  <p className="font-medium text-gray-700">{row.slotName}</p>
                  <p>{row.slotStart}–{row.slotEnd}</p>
                </div>
                <div className="flex-1 min-w-0">
                  {row.roomName && <p className="text-xs text-gray-500 truncate">{row.roomName}</p>}
                  {row.syllabusTopicId
                    ? <p className="text-sm font-medium text-gray-800 truncate">Topic assigned</p>
                    : <p className="text-xs text-gray-300 italic">No topic assigned</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.isMakeupClass && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Makeup</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[row.status] ?? ''}`}>
                    {row.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CourseRoutinePage() {
  const { offeringId } = useParams<{ offeringId: string }>()
  const searchParams    = useSearchParams()
  const router          = useRouter()

  const courseId    = searchParams.get('courseId')    ?? ''
  const courseCode  = searchParams.get('courseCode')  ?? ''
  const courseTitle = searchParams.get('courseTitle') ?? ''
  const batchName   = searchParams.get('batchName')  ?? ''

  const [view,      setView]      = useState<'week' | 'list'>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [selected,  setSelected]  = useState<ScheduleRow | null>(null)

  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ['schedules', offeringId],
    queryFn:  () => listSchedulesApi(offeringId),
    enabled:  !!offeringId,
  })

  function handleUpdated(updated: ScheduleRow) {
    refetch()
    if (selected?.id === updated.id) setSelected(updated)
  }

  function handleCancelled(id: string) {
    refetch()
    setSelected(null)
  }

  const totalClasses    = schedules.length
  const completedCount  = schedules.filter(s => s.status === 'COMPLETED').length
  const cancelledCount  = schedules.filter(s => s.status === 'CANCELLED').length
  const topicAssigned   = schedules.filter(s => s.syllabusTopicId).length

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mt-0.5"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              {courseCode} · {courseTitle}
            </h1>
            {batchName && (
              <span className="text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                {batchName}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Class Schedule</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => setView('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <CalendarDays size={13} /> Week
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={13} /> List
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: `${totalClasses} total`,        color: 'bg-gray-100 text-gray-600' },
          { label: `${completedCount} completed`,  color: 'bg-green-50 text-green-700' },
          { label: `${cancelledCount} cancelled`,  color: 'bg-red-50 text-red-600' },
          { label: `${topicAssigned} topics set`,  color: 'bg-indigo-50 text-indigo-700' },
        ].map(c => (
          <span key={c.label} className={`px-2.5 py-1 rounded-full font-medium ${c.color}`}>{c.label}</span>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      )}

      {/* Calendar body */}
      {!isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          {view === 'week' && (
            <>
              {/* Week navigation */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => setWeekStart(d => addDays(d, -7))}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-gray-700">{fmtWeekRange(weekStart)}</span>
                <button
                  onClick={() => setWeekStart(d => addDays(d, 7))}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <WeekView
                schedules={schedules}
                weekStart={weekStart}
                onClassClick={setSelected}
              />
            </>
          )}
          {view === 'list' && (
            <ListView schedules={schedules} onClassClick={setSelected} />
          )}
        </div>
      )}

      {/* Side panel */}
      {selected && (
        <SidePanel
          row={selected}
          courseId={courseId}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  )
}
