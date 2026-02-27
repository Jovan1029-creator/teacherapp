import type { LessonPlan } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId, getCurrentUserId } from './helpers'

export async function listLessonPlans() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*), topic:topics(*)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as LessonPlan[]
}

export async function listSchoolLessonPlans() {
  return listLessonPlans()
}

export async function listMyLessonPlans() {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*), topic:topics(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as LessonPlan[]
}

export async function createLessonPlan(payload: {
  class_id: string
  subject_id: string
  topic_id?: string
  week_no?: number
  executed_at?: string
  generator_fields?: Record<string, string>
  objectives?: string
  introduction?: string
  activities?: string
  resources?: string
  assessment?: string
  notes?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('lesson_plans')
    .insert({
      school_id: schoolId,
      teacher_id: teacherId,
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      topic_id: payload.topic_id || null,
      week_no: payload.week_no ?? null,
      executed_at: payload.executed_at || null,
      generator_fields: payload.generator_fields ?? {},
      objectives: payload.objectives || null,
      introduction: payload.introduction || null,
      activities: payload.activities || null,
      resources: payload.resources || null,
      assessment: payload.assessment || null,
      notes: payload.notes || null,
    })
    .select('*')
    .single<LessonPlan>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateLessonPlan(payload: {
  id: string
  class_id: string
  subject_id: string
  topic_id?: string
  week_no?: number
  executed_at?: string
  generator_fields?: Record<string, string>
  objectives?: string
  introduction?: string
  activities?: string
  resources?: string
  assessment?: string
  notes?: string
}) {
  const schoolId = await getCurrentSchoolId()

  const { data, error } = await supabase
    .from('lesson_plans')
    .update({
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      topic_id: payload.topic_id || null,
      week_no: payload.week_no ?? null,
      executed_at: payload.executed_at || null,
      generator_fields: payload.generator_fields ?? {},
      objectives: payload.objectives || null,
      introduction: payload.introduction || null,
      activities: payload.activities || null,
      resources: payload.resources || null,
      assessment: payload.assessment || null,
      notes: payload.notes || null,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<LessonPlan>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteLessonPlan(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('lesson_plans').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

export async function duplicateLessonPlan(id: string) {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()

  const { data: lessonPlan, error: fetchError } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .single<LessonPlan>()

  if (fetchError) throw new Error(fetchError.message)

  const { data, error } = await supabase
    .from('lesson_plans')
    .insert({
      school_id: schoolId,
      teacher_id: teacherId,
      class_id: lessonPlan.class_id,
      subject_id: lessonPlan.subject_id,
      topic_id: lessonPlan.topic_id,
      week_no: lessonPlan.week_no,
      executed_at: null,
      generator_fields: lessonPlan.generator_fields ?? {},
      objectives: lessonPlan.objectives,
      introduction: lessonPlan.introduction,
      activities: lessonPlan.activities,
      resources: lessonPlan.resources,
      assessment: lessonPlan.assessment,
      notes: lessonPlan.notes,
    })
    .select('*')
    .single<LessonPlan>()

  if (error) throw new Error(error.message)
  return data
}

export async function listExecutedLessonPlansByClassSubject(classId: string, subjectId: string) {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*), topic:topics(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .not('executed_at', 'is', null)
    .order('executed_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as LessonPlan[]
}

export async function setLessonPlanExecutedAt(id: string, executedAt: string | null) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('lesson_plans')
    .update({ executed_at: executedAt })
    .eq('id', id)
    .eq('school_id', schoolId)
    .select('*, teacher:users(*), classroom:classes(*), subject:subjects(*), topic:topics(*)')
    .single<LessonPlan>()

  if (error) throw new Error(error.message)
  return data
}
