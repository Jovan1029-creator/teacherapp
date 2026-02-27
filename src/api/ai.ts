import type { AiGeneratedTestDraft } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

export interface GenerateAiTestDraftPayload {
  subject: string
  class_level: string
  test_title?: string
  term?: string | null
  date?: string | null
  language?: string
  total_marks?: number
  instructions?: string[]
  allowed_question_types?: string[]
  difficulty_distribution?: {
    easy?: number
    medium?: number
    hard?: number
  }
  source_topics?: string[]
  executed_lesson_plans?: Array<Record<string, unknown>>
  subject_rules?: Record<string, unknown>
}

interface GenerateAiTestDraftSuccess {
  ok: true
  model?: string
  draft: AiGeneratedTestDraft
}

interface GenerateAiTestDraftFailure {
  ok?: false
  error?: string
  message?: string
  provider?: unknown
}

function getFunctionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'AI draft generation failed'
}

export async function generateAiTestDraft(payload: GenerateAiTestDraftPayload) {
  const { data, error } = await supabase.functions.invoke('gemini', { body: payload })

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context

    if (context?.json) {
      try {
        const details = (await context.json()) as GenerateAiTestDraftFailure
        const providerStatus =
          typeof details === 'object' && details && 'status' in (details as Record<string, unknown>)
            ? ` (provider status ${(details as Record<string, unknown>).status})`
            : ''
        throw new Error(`${details.error || details.message || getFunctionErrorMessage(error)}${providerStatus}`)
      } catch (parseError) {
        throw new Error(getFunctionErrorMessage(parseError))
      }
    }

    throw new Error(getFunctionErrorMessage(error))
  }

  const response = (data ?? {}) as GenerateAiTestDraftSuccess | GenerateAiTestDraftFailure

  if (!('ok' in response) || response.ok !== true || !('draft' in response)) {
    throw new Error(response.error || response.message || 'AI draft generation failed')
  }

  return {
    model: response.model ?? null,
    draft: response.draft,
  }
}
