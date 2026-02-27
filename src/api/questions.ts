// src\api\questions.ts
import type { Question } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId, getCurrentUserId } from './helpers'

export async function listQuestions(subjectId?: string) {
  const schoolId = await getCurrentSchoolId()
  let query = supabase
    .from('questions')
    .select('*, topic:topics(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Question[]
}

export async function listMyQuestions(subjectId?: string) {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()
  let query = supabase
    .from('questions')
    .select('*, topic:topics(*), subject:subjects(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Question[]
}

export async function createQuestion(payload: {
  subject_id: string
  topic_id?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  question_text: string
  choices: Record<string, string>
  correct_answer: string
  marks?: number
}) {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('questions')
    .insert({
      school_id: schoolId,
      teacher_id: teacherId,
      subject_id: payload.subject_id,
      topic_id: payload.topic_id || null,
      type: 'mcq',
      difficulty: payload.difficulty || 'medium',
      question_text: payload.question_text,
      choices: payload.choices,
      correct_answer: payload.correct_answer,
      marks: payload.marks ?? 1,
    })
    .select('*')
    .single<Question>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateQuestion(payload: {
  id: string
  subject_id: string
  topic_id?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  question_text: string
  choices: Record<string, string>
  correct_answer: string
  marks?: number
}) {
  const schoolId = await getCurrentSchoolId()

  const { data, error } = await supabase
    .from('questions')
    .update({
      subject_id: payload.subject_id,
      topic_id: payload.topic_id || null,
      difficulty: payload.difficulty || 'medium',
      question_text: payload.question_text,
      choices: payload.choices,
      correct_answer: payload.correct_answer,
      marks: payload.marks ?? 1,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<Question>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteQuestion(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('questions').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
