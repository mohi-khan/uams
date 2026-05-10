'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarRange, ChevronLeft, ChevronRight, X,
  Clock, MapPin, BookOpen, Tag, LayoutList, Calendar,
} from 'lucide-react'
import { getStudentScheduleApi, type StudentScheduleRow } from '@/lib/api/class-schedule'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setDate(date.getDate() - date.getDay())
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtLong(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Deterministic color per course_id (cycles through a palette)
const COURSE_COLORS = [
  { bg: 'bg-indigo-100',  border: 'border-indigo-300',  text: 'text-indigo-800',  dot: 'bg-indigo-500'  },
  { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100',   border: 'border-amber-300',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  { bg: 'bg-rose-100',    border: 'border-rose-300',    text: 'text-rose-800',    dot: 'bg-rose-500'    },
  { bg: 'bg-cyan-100',    border: 'border-cyan-300',    text: 'text-cyan-800',    dot: 'bg-cyan-500'    },
  { bg: 'bg-purple-100',  border: 'border-purple-300',  text: 'text-purple-800',  dot: 'bg-purple-500'  },
  { bg: 'bg-orange-100',  border: 'border-orange-300',  text: 'text-orange-800',  dot: 'bg-orange-500'  },
  { bg: 'bg-teal-100',    border: 'border-teal-300',    text: 'text-teal-800',    dot: 'bg-teal-500'    },
]

function courseColor(courseId: string, colorMap: Map<string, typeof COURSE_COLORS[0]>) {
  if (!colorMap.has(courseId)) {
    colorMap.set(courseId, COURSE_COLORS[colorMap.size % COURSE_COLORS.length])
  }
  return colorMap.get(courseId)!
}

// ── Side Panel ────────────────────────────────────────────────────────────────

function SidePanel({
  row,
  color,
  onClose,
}: {
  row: StudentScheduleRow
  color: typeof COURSE_COLORS[0]
  onClose: () => void
}) {
  const date = new Date(row.session_date + 'T00:00:00')

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-xl z-30 flex flex-col">
      {/* Header */}
      <div className={`${color.bg} px-5 pt-5 pb-4 border-b border-gray-100`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
              {row.course_code}
            </span>
            <p className="mt-2 font-semibold text-gray-900 leading-snug">{row.course_title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 text-gray-700">
            <Calendar size={15} className="mt-0.5 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Date</p>
              <p className="font-medium">{fmtLong(date)}</p>
            </div>
          </div>

          {row.slot_name && (
            <div className="flex items-start gap-3 text-gray-700">
              <Clock size={15} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Time Slot</p>
                <p className="font-medium">{row.slot_name}</p>
                {row.slot_start && (
                  <p className="text-xs text-gray-500">{row.slot_start} – {row.slot_end}</p>
                )}
              </div>
            </div>
          )}

          {row.room_name && (
            <div className="flex items-start gap-3 text-gray-700">
              <MapPin size={15} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Room</p>
                <p className="font-medium">{row.room_name}</p>
              </div>
            </div>
          )}

          {row.batch_name && (
            <div className="flex items-start gap-3 text-gray-700">
              <BookOpen size={15} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Batch</p>
                <p className="font-medium">{row.batch_name}</p>
              </div>
            </div>
          )}

          {row.topic_title && (
            <div className="flex items-start gap-3 text-gray-700">
              <Tag size={15} className="mt-0.5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Topic</p>
                <p className="font-medium">{row.topic_title}</p>
              </div>
            </div>
          )}

          {row.is_makeup_class && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
              Makeup class
            </div>
          )}

          {row.notes && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
              {row.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  schedules,
  weekStart,
  colorMap,
  onSelect,
}: {
  schedules:  StudentScheduleRow[]
  weekStart:  Date
  colorMap:   Map<string, typeof COURSE_COLORS[0]>
  onSelect:   (row: StudentScheduleRow) => void
}) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = toYMD(new Date())

  // Build slot list: unique slots sorted by start time
  const slots = useMemo(() => {
    const map = new Map<string, { id: string; name: string; start: string; end: string }>()
    for (const s of schedules) {
      if (s.slot_name && !map.has(s.slot_name)) {
        map.set(s.slot_name, {
          id:    s.slot_name,
          name:  s.slot_name,
          start: s.slot_start ?? '',
          end:   s.slot_end   ?? '',
        })
      }
    }
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start))
  }, [schedules])

  // Index: "date|slotName" → row
  const index = useMemo(() => {
    const m = new Map<string, StudentScheduleRow>()
    for (const s of schedules) {
      if (s.slot_name) m.set(`${s.session_date}|${s.slot_name}`, s)
    }
    return m
  }, [schedules])

  if (slots.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-20 text-center">
        <CalendarRange size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-400">No classes scheduled this week.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left text-xs text-gray-400 font-medium px-3 py-2.5 border-b border-gray-100 w-28">
              Slot
            </th>
            {weekDates.map((d, i) => {
              const ymd = toYMD(d)
              const isToday = ymd === today
              return (
                <th
                  key={i}
                  className={`text-center text-xs font-medium px-2 py-2.5 border-b border-gray-100 ${
                    isToday ? 'text-indigo-700' : 'text-gray-600'
                  }`}
                >
                  <span className={`block text-[10px] uppercase tracking-wide ${isToday ? 'text-indigo-400' : 'text-gray-400'}`}>
                    {DAY_LABELS[d.getDay()]}
                  </span>
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mt-0.5 ${
                    isToday ? 'bg-indigo-600 text-white' : ''
                  }`}>
                    {d.getDate()}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} className="border-b border-gray-50 last:border-0">
              <td className="px-3 py-2 text-xs text-gray-500 align-top">
                <p className="font-medium text-gray-700">{slot.name}</p>
                {slot.start && (
                  <p className="text-gray-400">{slot.start}–{slot.end}</p>
                )}
              </td>
              {weekDates.map((d, i) => {
                const key = `${toYMD(d)}|${slot.name}`
                const row = index.get(key)
                const color = row ? courseColor(row.course_id, colorMap) : null
                return (
                  <td key={i} className="px-1 py-1 align-top">
                    {row && color ? (
                      <button
                        onClick={() => onSelect(row)}
                        className={`w-full text-left rounded-lg px-2 py-1.5 border ${color.bg} ${color.border} hover:opacity-80 transition-opacity`}
                      >
                        <p className={`text-xs font-semibold truncate ${color.text}`}>{row.course_code}</p>
                        {row.room_name && (
                          <p className="text-[10px] text-gray-500 truncate">{row.room_name}</p>
                        )}
                        {row.topic_title && (
                          <p className="text-[10px] text-gray-400 truncate italic">{row.topic_title}</p>
                        )}
                      </button>
                    ) : (
                      <div className="h-10" />
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

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({
  schedules,
  colorMap,
  onSelect,
}: {
  schedules: StudentScheduleRow[]
  colorMap:  Map<string, typeof COURSE_COLORS[0]>
  onSelect:  (row: StudentScheduleRow) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, StudentScheduleRow[]>()
    for (const s of schedules) {
      const existing = map.get(s.session_date) ?? []
      existing.push(s)
      map.set(s.session_date, existing)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [schedules])

  if (grouped.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-20 text-center">
        <CalendarRange size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-400">No classes scheduled.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {grouped.map(([date, rows]) => {
        const d = new Date(date + 'T00:00:00')
        return (
          <div key={date} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-3">
              <div className="text-center min-w-[36px]">
                <p className="text-lg font-bold text-indigo-600 leading-none">{d.getDate()}</p>
                <p className="text-[10px] text-gray-400 uppercase">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {d.toLocaleDateString('en-GB', { weekday: 'long' })}
                </p>
                <p className="text-xs text-gray-400">{rows.length} class{rows.length !== 1 ? 'es' : ''}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {rows
                .slice()
                .sort((a, b) => (a.slot_start ?? '').localeCompare(b.slot_start ?? ''))
                .map((row) => {
                  const color = courseColor(row.course_id, colorMap)
                  return (
                    <button
                      key={row.id}
                      onClick={() => onSelect(row)}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-1 self-stretch rounded-full shrink-0 ${color.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-xs font-bold ${color.text}`}>{row.course_code}</span>
                          <span className="text-xs text-gray-500 truncate">{row.course_title}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {row.slot_name}
                          {row.slot_start ? ` · ${row.slot_start}–${row.slot_end}` : ''}
                          {row.room_name  ? ` · ${row.room_name}` : ''}
                        </p>
                      </div>
                      {row.topic_title && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5 shrink-0 max-w-[100px] truncate">
                          {row.topic_title}
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentSchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView]             = useState<'week' | 'list'>('week')
  const [selected, setSelected]     = useState<StudentScheduleRow | null>(null)

  const colorMap = useMemo(() => new Map<string, typeof COURSE_COLORS[0]>(), [])

  const { data: allSchedules = [], isLoading, error } = useQuery({
    queryKey: ['student-schedule'],
    queryFn:  getStudentScheduleApi,
    staleTime: 60_000,
  })

  const today     = new Date()
  const weekStart = addDays(startOfWeek(today), weekOffset * 7)
  const weekEnd   = addDays(weekStart, 6)

  // Schedules visible in current week view
  const weekSchedules = useMemo(() => {
    const from = toYMD(weekStart)
    const to   = toYMD(weekEnd)
    return allSchedules.filter(s => s.session_date >= from && s.session_date <= to)
  }, [allSchedules, weekStart, weekEnd])

  // Unique courses for the legend
  const uniqueCourses = useMemo(() => {
    const seen = new Set<string>()
    return allSchedules.filter(s => {
      if (seen.has(s.course_id)) return false
      seen.add(s.course_id)
      return true
    })
  }, [allSchedules])

  // Pre-populate colorMap so legend and cells use the same colors
  uniqueCourses.forEach(s => courseColor(s.course_id, colorMap))

  const selectedColor = selected ? courseColor(selected.course_id, colorMap) : null

  return (
    <div className={`space-y-5 ${selected ? 'pr-80' : ''} transition-all`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <CalendarRange size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Class Schedule</h1>
            <p className="text-sm text-gray-500">All courses across enrolled batches</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setView('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={13} /> Week
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList size={13} /> List
            </button>
          </div>
        </div>
      </div>

      {/* Course legend */}
      {uniqueCourses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uniqueCourses.map(s => {
            const c = courseColor(s.course_id, colorMap)
            return (
              <span key={s.course_id} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {s.course_code}
              </span>
            )
          })}
        </div>
      )}

      {/* Week navigation (week view only) */}
      {view === 'week' && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[200px] text-center">
            {fmtDate(weekStart)} – {fmtDate(weekEnd)}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} className="text-gray-600" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Today
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {weekSchedules.length} class{weekSchedules.length !== 1 ? 'es' : ''} this week
          </span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-sm text-red-600">
          {(error as any)?.response?.data?.error ?? 'Failed to load schedule.'}
        </div>
      )}

      {/* Calendar */}
      {!isLoading && !error && view === 'week' && (
        <WeekView
          schedules={weekSchedules}
          weekStart={weekStart}
          colorMap={colorMap}
          onSelect={setSelected}
        />
      )}

      {!isLoading && !error && view === 'list' && (
        <ListView
          schedules={allSchedules}
          colorMap={colorMap}
          onSelect={setSelected}
        />
      )}

      {/* Side panel */}
      {selected && selectedColor && (
        <SidePanel
          row={selected}
          color={selectedColor}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
