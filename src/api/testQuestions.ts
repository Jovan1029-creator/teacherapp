import type { Question, TestQuestion } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { updateTestTotalMarks } from './tests'

export async function listTestQuestions(testId: string) {
  const { data, error } = await supabase
    .from('test_questions')
    .select('*, question:questions(*)')
    .eq('test_id', testId)
    .order('order_no', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TestQuestion[]
}

export async function addQuestionsToTest(
  testId: string,
  questions: Array<{ question_id: string; order_no: number; marks: number }>,
) {
  if (!questions.length) return []
  const { data, error } = await supabase
    .from('test_questions')
    .upsert(
      questions.map((question) => ({ test_id: testId, ...question })),
      { onConflict: 'test_id,question_id' },
    )
    .select('*')

  if (error) throw new Error(error.message)
  await recomputeTotalMarks(testId)
  return (data ?? []) as TestQuestion[]
}

export async function removeQuestionFromTest(testQuestionId: string, testId: string) {
  const { error } = await supabase.from('test_questions').delete().eq('id', testQuestionId)
  if (error) throw new Error(error.message)
  await recomputeTotalMarks(testId)
}

export async function reorderQuestions(_testId: string, rows: TestQuestion[]) {
  const payload = rows.map((row, index) => ({ id: row.id, order_no: index + 1 }))
  const { error } = await supabase.from('test_questions').upsert(payload, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export async function autoGenerateQuestions(payload: {
  testId: string
  subjectId: string
  topicId?: string
  topicIds?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  count: number
}) {
  const existing = await listTestQuestions(payload.testId)
  const existingQuestionIds = new Set(existing.map((row) => row.question_id))

  let query = supabase
    .from('questions')
    .select('*')
    .eq('subject_id', payload.subjectId)

  if (payload.topicIds?.length) {
    query = query.in('topic_id', payload.topicIds)
  } else if (payload.topicId) {
    query = query.eq('topic_id', payload.topicId)
  }
  if (payload.difficulty) {
    query = query.eq('difficulty', payload.difficulty)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const source = ((data ?? []) as Question[]).filter((question) => !existingQuestionIds.has(question.id))
  const shuffled = [...source]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const chosen = shuffled.slice(0, payload.count)
  const startOrder = existing.length + 1

  await addQuestionsToTest(
    payload.testId,
    chosen.map((question, idx) => ({
      question_id: question.id,
      order_no: startOrder + idx,
      marks: question.marks,
    })),
  )

  return chosen
}

async function recomputeTotalMarks(testId: string) {
  const { data, error } = await supabase.from('test_questions').select('marks').eq('test_id', testId)
  if (error) throw new Error(error.message)
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.marks ?? 0), 0)
  await updateTestTotalMarks(testId, total)
  return total
}
