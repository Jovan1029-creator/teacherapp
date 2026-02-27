// src\api\attempts.ts
import type { Attempt, AttemptAnswer } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

export async function listAttemptsByTest(testId: string) {
  const { data, error } = await supabase
    .from('attempts')
    .select('*, student:students(*), attempt_answers(id)')
    .eq('test_id', testId)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Attempt[]
}

export async function getAttemptAnswers(attemptId: string) {
  const { data, error } = await supabase
    .from('attempt_answers')
    .select('*, question:questions(*, topic:topics(*))')
    .eq('attempt_id', attemptId)

  if (error) throw new Error(error.message)
  return (data ?? []) as AttemptAnswer[]
}

export async function upsertAttempt(payload: {
  test_id: string
  student_id: string
  total_score: number
}) {
  const { data, error } = await supabase
    .from('attempts')
    .upsert(payload, { onConflict: 'test_id,student_id' })
    .select('*')
    .single<Attempt>()

  if (error) throw new Error(error.message)
  return data
}

export async function upsertAttemptAnswers(
  attemptId: string,
  answers: Array<{ question_id: string; answer_text: string; is_correct: boolean; score: number }>,
) {
  const payload = answers.map((answer) => ({ ...answer, attempt_id: attemptId }))
  const { data, error } = await supabase
    .from('attempt_answers')
    .upsert(payload, { onConflict: 'attempt_id,question_id' })
    .select('*')

  if (error) throw new Error(error.message)
  return (data ?? []) as AttemptAnswer[]
}

export async function replaceAttemptAnswers(
  attemptId: string,
  answers: Array<{ question_id: string; answer_text: string; is_correct: boolean; score: number }>,
) {
  const { error: deleteError } = await supabase.from('attempt_answers').delete().eq('attempt_id', attemptId)
  if (deleteError) throw new Error(deleteError.message)

  if (!answers.length) return [] as AttemptAnswer[]
  return upsertAttemptAnswers(attemptId, answers)
}
