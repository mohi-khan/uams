import { apiClient } from './client'

export type DayOfWeek = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'
export type ScheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED'
export type ConflictType = 'ROOM' | 'TEACHER' | 'BATCH'

export interface OfferingForRoutine {
  offering_id:  string
  course_id:    string
  course_code:  string
  course_title: string
  batch_id:     string | null
  batch_name:   string | null
  teacher_id:   string | null
  teacher_name: string | null
  has_routine:  boolean
}

export interface ScheduleConflict {
  sessionDate:      string
  timeSlotId:       string
  conflictType:     ConflictType
  existingCourse:   string
  existingOffering: string
}

export interface ScheduleRow {
  id:              string
  sessionDate:     string
  dayOfWeek:       DayOfWeek
  status:          ScheduleStatus
  isMakeupClass:   boolean
  notes:           string | null
  timeSlotId:      string
  slotName:        string | null
  slotStart:       string | null
  slotEnd:         string | null
  roomId:          string | null
  roomName:        string | null
  syllabusTopicId: string | null
}

export interface CheckConflictsRow {
  sessionDate: string
  dayOfWeek:   DayOfWeek
  timeSlotId:  string
  roomId?:     string | null
}

export interface BulkCreateRow extends CheckConflictsRow {
  syllabusTopicId?: string | null
  topicId?:         string | null
  isMakeupClass?:   boolean
  notes?:           string
}

export async function getPendingCountApi(): Promise<number> {
  const { data } = await apiClient.get('/api/class-schedules/pending-count')
  return data.count
}

export async function listOfferingsForRoutineApi(): Promise<OfferingForRoutine[]> {
  const { data } = await apiClient.get('/api/class-schedules/offerings')
  return data.data
}

export async function checkConflictsApi(
  courseOfferingId: string,
  rows: CheckConflictsRow[],
): Promise<ScheduleConflict[]> {
  const { data } = await apiClient.post('/api/class-schedules/check-conflicts', {
    courseOfferingId,
    rows,
  })
  return data.conflicts
}

export async function bulkCreateSchedulesApi(
  courseOfferingId: string,
  rows: BulkCreateRow[],
): Promise<{ inserted: number; data: ScheduleRow[] }> {
  const { data } = await apiClient.post('/api/class-schedules/bulk', {
    courseOfferingId,
    rows,
  })
  return data
}

export async function listSchedulesApi(offeringId: string): Promise<ScheduleRow[]> {
  const { data } = await apiClient.get('/api/class-schedules', { params: { offeringId } })
  return data.data
}

export async function updateScheduleApi(
  id: string,
  payload: Partial<Pick<ScheduleRow, 'timeSlotId' | 'roomId' | 'sessionDate' | 'status' | 'syllabusTopicId' | 'notes'>>,
): Promise<ScheduleRow> {
  const { data } = await apiClient.put(`/api/class-schedules/${id}`, payload)
  return data
}

export async function cancelScheduleApi(id: string): Promise<{ success: boolean }> {
  const { data } = await apiClient.delete(`/api/class-schedules/${id}`)
  return data
}

export async function assignTopicApi(
  id: string,
  syllabusTopicId: string | null,
): Promise<ScheduleRow> {
  const { data } = await apiClient.patch(`/api/class-schedules/${id}/topic`, { syllabusTopicId })
  return data
}

export interface StudentScheduleRow {
  id:                 string
  session_date:       string
  day_of_week:        string
  status:             string
  is_makeup_class:    boolean
  notes:              string | null
  course_offering_id: string
  syllabus_topic_id:  string | null
  course_id:          string
  course_code:        string
  course_title:       string
  batch_name:         string | null
  slot_name:          string | null
  slot_start:         string | null
  slot_end:           string | null
  room_name:          string | null
  topic_title:        string | null
}

export async function getStudentScheduleApi(): Promise<StudentScheduleRow[]> {
  const { data } = await apiClient.get('/api/class-schedules/student-schedule')
  return data.data
}

export async function getStudentUpcomingTomorrowApi(): Promise<StudentScheduleRow[]> {
  const { data } = await apiClient.get('/api/class-schedules/student-upcoming')
  return data.data
}

export interface UpcomingClassRow {
  id:                 string
  session_date:       string
  day_of_week:        string
  status:             string
  is_makeup_class:    boolean
  notes:              string | null
  course_offering_id: string
  syllabus_topic_id:  string | null
  course_id:          string
  course_code:        string
  course_title:       string
  batch_name:         string | null
  slot_name:          string | null
  slot_start:         string | null
  slot_end:           string | null
  room_name:          string | null
  topic_title:        string | null
}

export async function getMyUpcomingApi(): Promise<UpcomingClassRow[]> {
  const { data } = await apiClient.get('/api/class-schedules/my-upcoming')
  return data.data
}
