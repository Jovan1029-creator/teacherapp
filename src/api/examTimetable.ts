import type { ExamTimetableEntry, Test } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId, getCurrentUserId } from './helpers'

export async function listSchoolExamTimetable() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('exam_timetable')
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .order('starts_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ExamTimetableEntry[]
}

export async function listMyExamTimetableEntries() {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('exam_timetable')
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('starts_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ExamTimetableEntry[]
}

export async function listTeacherClassExamTimetable() {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()

  const { data: assignments, error: assignmentsError } = await supabase
    .from('teacher_subjects')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)

  if (assignmentsError) throw new Error(assignmentsError.message)

  const classIds = Array.from(new Set((assignments ?? []).map((row) => row.class_id).filter(Boolean)))
  if (!classIds.length) return [] as ExamTimetableEntry[]

  const { data, error } = await supabase
    .from('exam_timetable')
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .in('class_id', classIds)
    .order('starts_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ExamTimetableEntry[]
}

export async function createExamTimetableEntry(payload: {
  class_id: string
  subject_id: string
  teacher_id: string
  title: string
  term?: string | null
  starts_at: string
  duration_minutes: number
  venue?: string | null
  notes?: string | null
  test_id?: string | null
}) {
  const schoolId = await getCurrentSchoolId()
  const startsAt = payload.starts_at
  const examDate = startsAt && startsAt.length >= 10 ? startsAt.slice(0, 10) : null

  const { data, error } = await supabase
    .from('exam_timetable')
    .insert({
      school_id: schoolId,
      test_id: payload.test_id ?? null,
      teacher_id: payload.teacher_id,
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      title: payload.title.trim(),
      term: payload.term?.trim() || null,
      exam_date: examDate,
      starts_at: startsAt,
      duration_minutes: Math.max(1, Math.floor(payload.duration_minutes)),
      venue: payload.venue?.trim() || null,
      notes: payload.notes?.trim() || null,
    })
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*)')
    .single<ExamTimetableEntry>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateExamTimetableEntry(payload: {
  id: string
  class_id: string
  subject_id: string
  teacher_id: string
  title: string
  term?: string | null
  starts_at: string
  duration_minutes: number
  venue?: string | null
  notes?: string | null
}) {
  const schoolId = await getCurrentSchoolId()
  const startsAt = payload.starts_at
  const examDate = startsAt && startsAt.length >= 10 ? startsAt.slice(0, 10) : null

  const { data, error } = await supabase
    .from('exam_timetable')
    .update({
      teacher_id: payload.teacher_id,
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      title: payload.title.trim(),
      term: payload.term?.trim() || null,
      exam_date: examDate,
      starts_at: startsAt,
      duration_minutes: Math.max(1, Math.floor(payload.duration_minutes)),
      venue: payload.venue?.trim() || null,
      notes: payload.notes?.trim() || null,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*)')
    .single<ExamTimetableEntry>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteExamTimetableEntry(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('exam_timetable').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

export async function upsertExamTimetableForTest(
  test: Pick<Test, 'id' | 'teacher_id' | 'class_id' | 'subject_id' | 'title' | 'term' | 'date'>,
  payload: {
    starts_at: string
    duration_minutes: number
    venue?: string
    notes?: string
  },
) {
  const schoolId = await getCurrentSchoolId()
  const actorId = await getCurrentUserId()

  const startsAt = payload.starts_at
  const derivedExamDate =
    startsAt && startsAt.length >= 10 ? startsAt.slice(0, 10) : test.date ?? null

  const { data, error } = await supabase
    .from('exam_timetable')
    .upsert(
      {
        school_id: schoolId,
        test_id: test.id,
        teacher_id: test.teacher_id || actorId,
        class_id: test.class_id,
        subject_id: test.subject_id,
        title: test.title,
        term: test.term ?? null,
        exam_date: derivedExamDate,
        starts_at: startsAt,
        duration_minutes: Math.max(1, Math.floor(payload.duration_minutes)),
        venue: payload.venue?.trim() || null,
        notes: payload.notes?.trim() || null,
      },
      { onConflict: 'test_id' },
    )
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*)')
    .single<ExamTimetableEntry>()

  if (error) throw new Error(error.message)
  return data
}

export async function removeExamTimetableForTest(testId: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('exam_timetable').delete().eq('school_id', schoolId).eq('test_id', testId)
  if (error) throw new Error(error.message)
}
