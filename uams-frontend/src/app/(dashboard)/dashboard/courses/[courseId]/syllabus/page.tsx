'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BookOpen, Plus, GripVertical, Trash2, CheckCircle, Star, ArrowLeft,
  Clock, FileText, ChevronDown, ChevronUp, Lock, Loader2,
} from 'lucide-react'
import {
  listSyllabiApi, createSyllabusApi, getSyllabusApi,
  finalizeSyllabusApi, setDefaultSyllabusApi, deleteSyllabusApi,
  createTopicApi, updateTopicApi, deleteTopicApi, reorderTopicsApi,
  type SyllabusRow, type SyllabusTopic,
} from '@/lib/api/syllabus'
import { getCourseByIdApi } from '@/lib/api/academic'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'final' }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      status === 'final' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {status}
    </span>
  )
}

// ── Sortable Topic Row ────────────────────────────────────────────────────────

interface TopicRowProps {
  topic:       SyllabusTopic
  readOnly:    boolean
  onBlurSave:  (topic: SyllabusTopic, field: string, value: string | number | null) => void
  onDelete:    (topicId: string) => void
  isDeleting:  boolean
}

function SortableTopicRow({ topic, readOnly, onBlurSave, onDelete, isDeleting }: TopicRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id, disabled: readOnly })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
 
  const [localTitle, setLocalTitle] = useState(topic.title)
  const [localDesc, setLocalDesc]   = useState(topic.description ?? '')
  const [localHours, setLocalHours] = useState(
    topic.estimatedHours != null ? String(topic.estimatedHours) : '',
  )
  const [expanded, setExpanded] = useState(false)

  // Sync local state when topic prop is updated from outside (e.g. after save)
  const prevTopicRef = useRef(topic)
  useEffect(() => {
    const prev = prevTopicRef.current
    if (topic.title       !== prev.title)           setLocalTitle(topic.title)
    if (topic.description !== prev.description)     setLocalDesc(topic.description ?? '')
    if (topic.estimatedHours !== prev.estimatedHours)
      setLocalHours(topic.estimatedHours != null ? String(topic.estimatedHours) : '')
    prevTopicRef.current = topic
  }, [topic])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white border rounded-xl transition-shadow ${
        isDragging ? 'shadow-lg border-indigo-300' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Main row */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* Drag handle */}
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
            tabIndex={-1}
          >
            <GripVertical size={16} />
          </button>
        )}

        {/* Order badge */}
        <span className="mt-1 text-xs font-bold text-gray-400 w-5 shrink-0 text-center">
          {topic.orderNo}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <input
            value={localTitle}
            readOnly={readOnly}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => {
              if (localTitle.trim() && localTitle !== topic.title)
                onBlurSave(topic, 'title', localTitle.trim())
            }}
            placeholder="Topic title…"
            className={`w-full text-sm font-medium text-gray-900 bg-transparent border-none outline-none focus:ring-0 ${
              readOnly ? 'cursor-default' : 'focus:bg-gray-50 rounded px-1 -mx-1'
            }`}
          />
        </div>

        {/* Estimated hours */}
        <div className="flex items-center gap-1 shrink-0">
          <Clock size={12} className="text-gray-400" />
          <input
            type="number"
            min={0}
            max={999}
            step={0.5}
            readOnly={readOnly}
            value={localHours}
            onChange={(e) => setLocalHours(e.target.value)}
            onBlur={() => {
              const val = localHours === '' ? null : Number(localHours)
              const prev = topic.estimatedHours != null ? Number(topic.estimatedHours) : null
              if (val !== prev) onBlurSave(topic, 'estimatedHours', val)
            }}
            placeholder="hrs"
            className={`w-14 text-xs text-gray-600 bg-transparent border-none outline-none text-right ${
              readOnly ? 'cursor-default' : 'focus:bg-gray-50 rounded px-1'
            }`}
          />
        </div>

        {/* Status badge */}
        <StatusBadge status={topic.status} />

        {/* Expand / actions */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {!readOnly && (
          <button
            onClick={() => onDelete(topic.id)}
            disabled={isDeleting}
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0 disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Description — collapsed summary or expanded textarea */}
      {!expanded && !readOnly && (
        <div className="px-10 pb-2">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-gray-400 hover:text-indigo-500 italic"
          >
            {localDesc.trim() ? localDesc.trim().slice(0, 80) + (localDesc.trim().length > 80 ? '…' : '') : '+ Add description'}
          </button>
        </div>
      )}
      {!expanded && readOnly && localDesc.trim() && (
        <div className="px-10 pb-2 text-xs text-gray-500 italic">{localDesc.trim()}</div>
      )}

      {expanded && (
        <div className="px-10 pb-3">
          <textarea
            autoFocus
            value={localDesc}
            readOnly={readOnly}
            rows={3}
            onChange={(e) => setLocalDesc(e.target.value)}
            onBlur={() => {
              const val = localDesc.trim() || null
              const prev = topic.description?.trim() || null
              if (val !== prev) onBlurSave(topic, 'description', val)
              setExpanded(false)
            }}
            placeholder={readOnly ? '' : 'Add description…'}
            className={`w-full text-xs text-gray-600 resize-none bg-transparent border rounded-lg p-2 outline-none ${
              readOnly
                ? 'cursor-default border-transparent'
                : 'border-gray-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100'
            }`}
          />
        </div>
      )}
    </div>
  )
}

// ── Syllabus Panel ────────────────────────────────────────────────────────────

function SyllabusPanel({
  syllabusId,
  readOnly,
}: {
  syllabusId: string
  readOnly:   boolean
}) {
  const qc      = useQueryClient()
  const [topics, setTopics] = useState<SyllabusTopic[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['syllabus', syllabusId],
    queryFn:  () => getSyllabusApi(syllabusId),
  })

  // Sync local topic list whenever the queried data changes (new syllabusId or refetch)
  const prevId = useRef<string | null>(null)
  useEffect(() => {
    if (data && prevId.current !== syllabusId) {
      prevId.current = syllabusId
      setTopics(data.topics)
    }
  }, [data, syllabusId])

  const syllabus = data

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const createTopicMut = useMutation({
    mutationFn: () => createTopicApi(syllabusId, { title: 'New Topic' }),
    onSuccess: (newTopic) => {
      setTopics(prev => [...prev, newTopic])
      qc.invalidateQueries({ queryKey: ['syllabus', syllabusId] })
    },
  })

  const saveTopicMut = useMutation({
    mutationFn: ({ topicId, payload }: { topicId: string; payload: any }) =>
      updateTopicApi(syllabusId, topicId, payload),
    onSuccess: (updated) => {
      setTopics(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
    },
  })

  const deleteTopicMut = useMutation({
    mutationFn: (topicId: string) => deleteTopicApi(syllabusId, topicId),
    onSuccess: (_, topicId) => {
      setTopics(prev => prev.filter(t => t.id !== topicId))
    },
  })

  const finalizeMut = useMutation({
    mutationFn: () => finalizeSyllabusApi(syllabusId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['syllabus', syllabusId] })
      qc.invalidateQueries({ queryKey: ['syllabi'] })
    },
  })

  const handleBlurSave = useCallback(
    (topic: SyllabusTopic, field: string, value: string | number | null) => {
      saveTopicMut.mutate({ topicId: topic.id, payload: { [field]: value } })
    },
    [saveTopicMut],
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setTopics((prev) => {
      const oldIdx = prev.findIndex(t => t.id === active.id)
      const newIdx = prev.findIndex(t => t.id === over.id)
      const reordered = arrayMove(prev, oldIdx, newIdx).map((t, i) => ({ ...t, orderNo: i + 1 }))
      reorderTopicsApi(syllabusId, reordered.map(t => t.id))
      return reordered
    })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  const isFinal = syllabus?.status === 'final'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">Topics</span>
          <span className="text-xs text-gray-400">{topics.length} item{topics.length !== 1 ? 's' : ''}</span>
          {syllabus && <StatusBadge status={syllabus.status} />}
          {syllabus?.isDefault && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <Star size={11} /> Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && !isFinal && (
            <>
              <button
                onClick={() => createTopicMut.mutate()}
                disabled={createTopicMut.isPending}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
              >
                <Plus size={15} />
                Add Topic
              </button>
              <button
                onClick={() => finalizeMut.mutate()}
                disabled={finalizeMut.isPending || topics.length === 0}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {finalizeMut.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <CheckCircle size={14} />
                }
                Finalize Syllabus
              </button>
            </>
          )}
          {isFinal && (
            <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
              <Lock size={14} />
              Finalized — create new version to edit
            </div>
          )}
        </div>
      </div>

      {/* Topic list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {topics.length === 0 && !readOnly && !isFinal && (
          <div className="border border-dashed border-gray-200 rounded-xl py-16 text-center">
            <FileText size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">No topics yet.</p>
            <button
              onClick={() => createTopicMut.mutate()}
              className="mt-3 text-sm text-indigo-600 hover:underline font-medium"
            >
              Add first topic
            </button>
          </div>
        )}

        {topics.length === 0 && (readOnly || isFinal) && (
          <div className="py-16 text-center text-sm text-gray-400">No topics in this syllabus.</div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={topics.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {topics.map(topic => (
              <SortableTopicRow
                key={topic.id}
                topic={topic}
                readOnly={readOnly || isFinal}
                onBlurSave={handleBlurSave}
                onDelete={(id) => deleteTopicMut.mutate(id)}
                isDeleting={deleteTopicMut.isPending}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Auto-save hint */}
      {!readOnly && !isFinal && (
        <p className="text-xs text-gray-400 mt-3 shrink-0">
          Changes save automatically on blur. Use "Finalize Syllabus" to publish.
        </p>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CourseSyllabusPage() {
  const { courseId }     = useParams<{ courseId: string }>()
  const router           = useRouter()
  const qc               = useQueryClient()
  const user             = useAtomValue(currentUserAtom)

  const canWrite = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')
  const role     = user?.role ?? 'student'

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn:  () => getCourseByIdApi(courseId),
    staleTime: 60_000,
  })

  const { data: syllabiData, isLoading: syllabiLoading } = useQuery({
    queryKey: ['syllabi', courseId],
    queryFn:  () => listSyllabiApi(courseId),
  })

  const syllabi: SyllabusRow[] = syllabiData?.data ?? []

  // Auto-select first syllabus when list loads
  useEffect(() => {
    if (!selectedId && syllabi.length > 0) setSelectedId(syllabi[0].id)
  }, [syllabi, selectedId])

  const createMut = useMutation({
    mutationFn: () => createSyllabusApi(courseId),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['syllabi', courseId] })
      setSelectedId(s.id)
    },
  })

  const deleteSyllabusMut = useMutation({
    mutationFn: (id: string) => deleteSyllabusApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['syllabi', courseId] })
      setSelectedId(syllabi.find(s => s.id !== selectedId)?.id ?? null)
    },
  })

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => setDefaultSyllabusApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['syllabi', courseId] }),
  })

  const readOnly = !canWrite

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push('/dashboard/courses')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="p-2 bg-indigo-100 rounded-xl">
          <BookOpen size={18} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Course Syllabus{course ? ` — ${course.code} · ${course.title}` : ''}
          </h1>
          <p className="text-xs text-gray-400">Manage syllabus versions and topics</p>
        </div>

        {canWrite && (
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="ml-auto flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {createMut.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Plus size={15} />
            }
            New Version
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left sidebar — version list */}
        <div className="w-56 shrink-0 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Versions</p>

          {syllabiLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!syllabiLoading && syllabi.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              No syllabus yet.
              {canWrite && (
                <button
                  onClick={() => createMut.mutate()}
                  className="block mx-auto mt-2 text-indigo-600 hover:underline text-xs font-medium"
                >
                  Create first version
                </button>
              )}
            </div>
          )}

          {syllabi.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                selectedId === s.id
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-800">{s.version}</span>
                {s.isDefault && <Star size={12} className="text-amber-500" />}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusBadge status={s.status} />
                {s.status === 'final' && !s.isDefault && canWrite && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDefaultMut.mutate(s.id) }}
                    className="text-xs text-amber-600 hover:underline"
                  >
                    Set default
                  </button>
                )}
                {s.status === 'draft' && canWrite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete draft ${s.version}?`)) deleteSyllabusMut.mutate(s.id)
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Right panel — topic editor */}
        <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          {!selectedId && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a version from the left panel.
            </div>
          )}
          {selectedId && (
            <SyllabusPanel
              key={selectedId}
              syllabusId={selectedId}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>
    </div>
  )
}
