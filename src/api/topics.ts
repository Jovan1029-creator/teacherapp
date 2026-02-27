// src\api\topics.ts
import type { Topic } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId } from './helpers'

export async function listTopics(subjectId?: string) {
  const schoolId = await getCurrentSchoolId()
  let query = supabase
    .from('topics')
    .select('*, subject:subjects(*)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Topic[]
}

export async function createTopic(payload: {
  subject_id: string
  form_level: number
  title: string
  syllabus_ref?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('topics')
    .insert({
      school_id: schoolId,
      subject_id: payload.subject_id,
      form_level: payload.form_level,
      title: payload.title,
      syllabus_ref: payload.syllabus_ref || null,
    })
    .select('*')
    .single<Topic>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateTopic(payload: {
  id: string
  subject_id: string
  form_level: number
  title: string
  syllabus_ref?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('topics')
    .update({
      subject_id: payload.subject_id,
      form_level: payload.form_level,
      title: payload.title,
      syllabus_ref: payload.syllabus_ref || null,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<Topic>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteTopic(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('topics').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
