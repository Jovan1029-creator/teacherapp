import type { AiGeneratedTestDraft, Test } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId, getCurrentUserId } from './helpers'

export async function listTests() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('tests')
    .select('*, classroom:classes(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Test[]
}

export async function listMyTests() {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('tests')
    .select('*, classroom:classes(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Test[]
}

export async function getTestById(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('tests')
    .select('*, classroom:classes(*), subject:subjects(*)')
    .eq('id', id)
    .eq('school_id', schoolId)
    .single<Test>()

  if (error) throw new Error(error.message)
  return data
}

export async function createTest(payload: {
  class_id: string
  subject_id: string
  title: string
  term?: string
  date?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('tests')
    .insert({
      school_id: schoolId,
      teacher_id: teacherId,
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      title: payload.title,
      term: payload.term || null,
      date: payload.date || null,
      total_marks: 0,
    })
    .select('*')
    .single<Test>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateTest(payload: {
  id: string
  class_id: string
  subject_id: string
  title: string
  term?: string
  date?: string
  total_marks?: number
}) {
  const schoolId = await getCurrentSchoolId()

  const { data, error } = await supabase
    .from('tests')
    .update({
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      title: payload.title,
      term: payload.term || null,
      date: payload.date || null,
      total_marks: payload.total_marks,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<Test>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteTest(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('tests').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

export async function updateTestTotalMarks(testId: string, totalMarks: number) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('tests')
    .update({ total_marks: totalMarks })
    .eq('id', testId)
    .eq('school_id', schoolId)
    .select('*')
    .single<Test>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateTestAiDraft(payload: {
  id: string
  ai_draft_json: AiGeneratedTestDraft | null
  total_marks?: number
}) {
  const schoolId = await getCurrentSchoolId()
  const updatePayload: { ai_draft_json: AiGeneratedTestDraft | null; total_marks?: number } = {
    ai_draft_json: payload.ai_draft_json,
  }

  if (typeof payload.total_marks === 'number' && Number.isFinite(payload.total_marks)) {
    updatePayload.total_marks = payload.total_marks
  }

  const { data, error } = await supabase
    .from('tests')
    .update(updatePayload)
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*, classroom:classes(*), subject:subjects(*)')
    .single<Test>()

  if (error) throw new Error(error.message)
  return data
}
