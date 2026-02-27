// src\pages\teacher\TestBuilder.tsx
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Printer, Save, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { generateAiTestDraft } from '@/api/ai'
import { listExecutedLessonPlansByClassSubject } from '@/api/lessonPlans'
import { listMyQuestions } from '@/api/questions'
import { listTopics } from '@/api/topics'
import { addQuestionsToTest, autoGenerateQuestions, listTestQuestions, removeQuestionFromTest, reorderQuestions } from '@/api/testQuestions'
import { getTestById, updateTestAiDraft } from '@/api/tests'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { AiDraftQuestion, AiDraftSection, AiGeneratedTestDraft } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const AI_QUESTION_TYPES = ['mcq', 'true_false', 'short_answer', 'structured', 'essay'] as const
type AiQuestionType = (typeof AI_QUESTION_TYPES)[number]

type SubjectAiPreset = {
  key: string
  allowedQuestionTypes: AiQuestionType[]
  subjectRules: Record<string, unknown>
  defaultInstructions: string[]
}

function getSubjectAiPreset(subjectName: string | null | undefined): SubjectAiPreset {
  const normalized = (subjectName ?? '').trim().toLowerCase()

  if (normalized.includes('math')) {
    return {
      key: 'mathematics',
      allowedQuestionTypes: ['short_answer', 'structured'],
      subjectRules: {
        prefer_mcq: false,
        require_working: true,
        show_steps_in_marking_scheme: true,
      },
      defaultInstructions: ['Answer all questions.', 'Show all working clearly.'],
    }
  }

  if (normalized.includes('english')) {
    return {
      key: 'english',
      allowedQuestionTypes: ['mcq', 'short_answer', 'essay'],
      subjectRules: {
        prefer_mcq: true,
        allow_composition: true,
      },
      defaultInstructions: ['Answer all questions.', 'Write neatly and clearly.'],
    }
  }

  return {
    key: 'general',
    allowedQuestionTypes: ['mcq', 'true_false', 'short_answer', 'structured'],
    subjectRules: {
      paper_first: true,
    },
    defaultInstructions: ['Answer all questions.', 'Write your answers clearly.'],
  }
}

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function getDraftSections(draft: AiGeneratedTestDraft | null | undefined) {
  return toArray<AiDraftSection>(draft?.sections)
}

function getDraftQuestionCount(draft: AiGeneratedTestDraft | null | undefined) {
  if (typeof draft?.totals?.total_questions === 'number') return draft.totals.total_questions
  return getDraftSections(draft).reduce((sum, section) => sum + toArray<AiDraftQuestion>(section.questions).length, 0)
}

function getDraftTotalMarks(draft: AiGeneratedTestDraft | null | undefined) {
  if (typeof draft?.totals?.total_marks === 'number') return draft.totals.total_marks
  return getDraftSections(draft).reduce(
    (sum, section) => sum + toArray<AiDraftQuestion>(section.questions).reduce((inner, question) => inner + Number(question.marks ?? 0), 0),
    0,
  )
}

function getDraftQuestionNumber(question: AiDraftQuestion, fallback: number) {
  const parsed = Number(question.question_number)
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  return fallback
}

function sanitizeQuestionPaperText(text: string) {
  return text
    .replace(/\s*\((?:for|answer|correct answer)\s+[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getAnswerSpaceLineCount(question: AiDraftQuestion, sectionType?: string | null) {
  const hasChoices = Boolean(question.choices && Object.keys(question.choices).length)
  if (hasChoices) return 0

  const marks = Math.max(1, Math.floor(Number(question.marks ?? 1)))
  const type = String(sectionType ?? '').toLowerCase()

  if (type === 'true_false') return 1
  if (type === 'short_answer') return Math.min(6, Math.max(2, Math.ceil(marks / 2) + 1))
  if (type === 'structured') return Math.min(12, Math.max(4, marks + 1))
  if (type === 'essay' || type === 'composition') return Math.min(24, Math.max(8, marks * 2))
  if (type === 'mcq') return 0

  return Math.min(10, Math.max(3, Math.ceil(marks / 2) + 2))
}

function buildAnswerSpaceHtml(lineCount: number) {
  if (lineCount <= 0) return ''
  return `
    <div class="answer-space" aria-label="Answer space">
      ${Array.from({ length: lineCount })
        .map(() => '<div class="answer-line"></div>')
        .join('')}
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

type AiDraftPrintMode = 'exam' | 'marking-guide'

function buildAiDraftPackHtml(
  draft: AiGeneratedTestDraft,
  meta: { title: string; className: string; subjectName: string },
  mode: AiDraftPrintMode = 'exam',
) {
  const sections = getDraftSections(draft)
  const paperInstructions = toArray(draft.instructions)
  const totalMarks = getDraftTotalMarks(draft)
  const isMarkingGuide = mode === 'marking-guide'

  const questionPaperHtml = sections
    .map((section, sectionIndex) => {
      const questions = toArray(section.questions)
      return `
        <section class="section">
          <h3>${escapeHtml(section.title ?? `Section ${sectionIndex + 1}`)}</h3>
          ${
            toArray(section.section_instructions).length
              ? `<ul>${toArray(section.section_instructions).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
              : ''
          }
          <ol>
            ${questions
              .map((question, questionIndex) => {
                const choices = question.choices ?? {}
                const number = getDraftQuestionNumber(question, questionIndex + 1)
                const paperText = sanitizeQuestionPaperText(question.question_text ?? '')
                const answerLines = getAnswerSpaceLineCount(question, String(section.question_type ?? ''))
                const choicesHtml =
                  question.choices && Object.keys(choices).length
                    ? `<div class="choices">${Object.entries(choices)
                        .map(([key, label]) => `<div><strong>${escapeHtml(key)}.</strong> ${escapeHtml(String(label ?? ''))}</div>`)
                        .join('')}</div>`
                    : ''
                const answerSpaceHtml = buildAnswerSpaceHtml(answerLines)

                return `
                  <li value="${number}">
                    <div class="qhead">
                      <span>${escapeHtml(paperText)}</span>
                      <span>${Number(question.marks ?? 0)} marks</span>
                    </div>
                    ${choicesHtml}
                    ${answerSpaceHtml}
                  </li>
                `
              })
              .join('')}
          </ol>
        </section>
      `
    })
    .join('')

  const markingSchemeHtml = sections
    .map((section, sectionIndex) => {
      const questions = toArray(section.questions)
      return `
        <section class="section">
          <h3>${escapeHtml(section.title ?? `Section ${sectionIndex + 1}`)} - Marking Guide</h3>
          ${questions
            .map((question, questionIndex) => {
              const number = question.question_number ?? questionIndex + 1
              const answerKey = question.answer_key ?? {}
              const markingScheme = question.marking_scheme ?? {}
              const acceptedAnswers = toArray(answerKey.accepted_answers).join(', ')
              const items = toArray(markingScheme.items)
              return `
                <div class="mark-item">
                  <p><strong>Q${number} (${Number(question.marks ?? 0)} marks):</strong> ${escapeHtml(question.question_text ?? '')}</p>
                  ${
                    answerKey.correct_option
                      ? `<p>Correct option: ${escapeHtml(String(answerKey.correct_option))}</p>`
                      : ''
                  }
                  ${
                    answerKey.correct_value
                      ? `<p>Correct value: ${escapeHtml(String(answerKey.correct_value))}</p>`
                      : ''
                  }
                  ${acceptedAnswers ? `<p>Accepted answers: ${escapeHtml(acceptedAnswers)}</p>` : ''}
                  ${
                    answerKey.model_answer
                      ? `<p>Model answer: ${escapeHtml(String(answerKey.model_answer))}</p>`
                      : ''
                  }
                  ${
                    items.length
                      ? `<ul>${items
                          .map(
                            (item) =>
                              `<li>${escapeHtml(String(item.criterion ?? 'Criterion'))} - ${Number(item.marks ?? 0)} marks</li>`,
                          )
                          .join('')}</ul>`
                      : ''
                  }
                  ${
                    markingScheme.notes
                      ? `<p>Notes: ${escapeHtml(String(markingScheme.notes))}</p>`
                      : ''
                  }
                </div>
              `
            })
            .join('')}
        </section>
      `
    })
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(draft.paper_title ?? meta.title)}${isMarkingGuide ? ' - Marking Guide' : ' - Question Paper'}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; line-height: 1.4; }
    h1, h2, h3 { margin: 0 0 8px; }
    .meta { margin-bottom: 16px; }
    .section { margin-top: 20px; page-break-inside: avoid; }
    .section ol { padding-left: 20px; }
    .section li { margin-bottom: 12px; }
    .section li::marker { font-weight: 600; }
    .qhead { display: flex; justify-content: space-between; gap: 16px; }
    .choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
    .choices div { border: 1px solid #ddd; border-radius: 6px; padding: 6px; }
    .answer-space { margin-top: 10px; }
    .answer-line { border-bottom: 1px solid #bdbdbd; min-height: 20px; margin-bottom: 8px; }
    .mark-item { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    @media print {
      .page-break { page-break-before: always; }
      body { margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(draft.paper_title ?? meta.title)}</h1>
  <div class="meta">
    <div>Class: ${escapeHtml(draft.class_level ?? meta.className)}</div>
    <div>Subject: ${escapeHtml(draft.subject ?? meta.subjectName)}</div>
    <div>Term: ${escapeHtml(draft.term ?? '-')} | Date: ${escapeHtml(draft.date ?? '-')} | Total Marks: ${totalMarks}</div>
  </div>
  ${
    isMarkingGuide
      ? `<h2>Marking Guide</h2>${markingSchemeHtml}`
      : `${paperInstructions.length ? `<h2>Instructions</h2><ul>${paperInstructions.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : ''}<h2>Question Paper</h2>${questionPaperHtml}`
  }
</body>
</html>`
}

function printAiDraft(
  draft: AiGeneratedTestDraft,
  meta: { title: string; className: string; subjectName: string },
  mode: AiDraftPrintMode = 'exam',
) {
  const html = buildAiDraftPackHtml(draft, meta, mode)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.border = '0'

  let printed = false
  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    window.setTimeout(() => {
      iframe.remove()
    }, 500)
  }

  const triggerPrint = () => {
    if (printed) return
    const frameWindow = iframe.contentWindow
    if (!frameWindow) {
      cleanup()
      return
    }
    printed = true
    frameWindow.addEventListener('afterprint', cleanup, { once: true })
    frameWindow.focus()
    frameWindow.print()
    window.setTimeout(cleanup, 2000)
  }

  iframe.onload = () => {
    window.setTimeout(triggerPrint, 350)
  }

  document.body.appendChild(iframe)
  if (iframe.contentDocument) {
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
  } else {
    iframe.srcdoc = html
  }

  // Fallback for browsers that do not fire onload reliably on iframe srcdoc/document.write.
  window.setTimeout(triggerPrint, 1000)
}

export default function TestBuilderPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [topicId, setTopicId] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('')
  const [count, setCount] = useState(5)
  const [autoSourceMode, setAutoSourceMode] = useState<'all' | 'executed'>('all')
  const [prioritizeExecutedQuestions, setPrioritizeExecutedQuestions] = useState(true)
  const [aiLanguage, setAiLanguage] = useState('English')
  const [aiTargetMarksOverride, setAiTargetMarksOverride] = useState<number | null>(null)
  const [aiTeacherNotes, setAiTeacherNotes] = useState('')
  const [aiUseExecutedOnly, setAiUseExecutedOnly] = useState(true)
  const [aiQuestionTypesOverride, setAiQuestionTypesOverride] = useState<AiQuestionType[] | null>(null)
  const [unsavedAiDraftState, setUnsavedAiDraftState] = useState<{
    testId: string
    draft: AiGeneratedTestDraft
    model: string | null
  } | null>(null)

  const testQuery = useQuery({ queryKey: ['test', id], queryFn: () => getTestById(id), enabled: Boolean(id) })
  const testQuestionsQuery = useQuery({
    queryKey: ['test-questions', id],
    queryFn: () => listTestQuestions(id),
    enabled: Boolean(id),
  })
  const questionsQuery = useQuery({
    queryKey: ['questions', 'mine', 'builder', id, testQuery.data?.subject_id ?? '__none__'],
    queryFn: () => listMyQuestions(testQuery.data!.subject_id),
    enabled: Boolean(testQuery.data?.subject_id),
  })
  const topicsQuery = useQuery({
    queryKey: ['topics', 'builder', id, testQuery.data?.subject_id ?? '__none__'],
    queryFn: () => listTopics(testQuery.data!.subject_id),
    enabled: Boolean(testQuery.data?.subject_id),
  })
  const executedLessonPlansQuery = useQuery({
    queryKey: [
      'lesson-plans',
      'executed',
      'mine',
      'builder',
      testQuery.data?.class_id ?? '__none__',
      testQuery.data?.subject_id ?? '__none__',
    ],
    queryFn: () => listExecutedLessonPlansByClassSubject(testQuery.data!.class_id, testQuery.data!.subject_id),
    enabled: Boolean(testQuery.data?.class_id && testQuery.data?.subject_id),
  })

  const addMutation = useMutation({
    mutationFn: (payload: {
      testId: string
      questions: Array<{ question_id: string; order_no: number; marks: number }>
    }) => addQuestionsToTest(payload.testId, payload.questions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-questions', id] })
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      queryClient.invalidateQueries({ queryKey: ['test', id] })
      toast.success('Questions added to test')
      setSelectedQuestionIds([])
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const removeMutation = useMutation({
    mutationFn: ({ testQuestionId }: { testQuestionId: string }) => removeQuestionFromTest(testQuestionId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-questions', id] })
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      queryClient.invalidateQueries({ queryKey: ['test', id] })
      toast.success('Question removed')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const reorderMutation = useMutation({
    mutationFn: ({ rows }: { rows: Awaited<ReturnType<typeof listTestQuestions>> }) => reorderQuestions(id, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-questions', id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const autoMutation = useMutation({
    mutationFn: autoGenerateQuestions,
    onSuccess: (rows, variables) => {
      queryClient.invalidateQueries({ queryKey: ['test-questions', id] })
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      queryClient.invalidateQueries({ queryKey: ['test', id] })
      toast.success(`Added ${rows.length} generated questions`)
      if (rows.length < variables.count) {
        toast.warning(`Only ${rows.length} eligible questions were available for this filter.`)
      }
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const aiGenerateMutation = useMutation({
    mutationFn: generateAiTestDraft,
    onSuccess: (result) => {
      setUnsavedAiDraftState({
        testId: id,
        draft: result.draft,
        model: result.model,
      })
      toast.success('AI draft generated. Review it, then save to this test if it looks correct.')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const saveAiDraftMutation = useMutation({
    mutationFn: (payload: { ai_draft_json: AiGeneratedTestDraft | null; total_marks?: number }) =>
      updateTestAiDraft({
        id,
        ai_draft_json: payload.ai_draft_json,
        total_marks: payload.total_marks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test', id] })
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      setUnsavedAiDraftState(null)
      toast.success('AI draft saved to this test')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const executedTopicIds = useMemo(() => {
    const ids = new Set<string>()
    for (const plan of executedLessonPlansQuery.data ?? []) {
      if (plan.topic_id) ids.add(plan.topic_id)
    }
    return Array.from(ids)
  }, [executedLessonPlansQuery.data])

  const executedTopicIdSet = useMemo(() => new Set(executedTopicIds), [executedTopicIds])

  const executedTopics = useMemo(
    () => (topicsQuery.data ?? []).filter((topic) => executedTopicIdSet.has(topic.id)),
    [topicsQuery.data, executedTopicIdSet],
  )

  const subjectAiPreset = useMemo(() => getSubjectAiPreset(testQuery.data?.subject?.name), [testQuery.data?.subject?.name])
  const savedAiDraft = testQuery.data?.ai_draft_json ?? null
  const aiDraftDirty = unsavedAiDraftState?.testId === id
  const aiDraft = aiDraftDirty ? unsavedAiDraftState?.draft ?? null : savedAiDraft
  const aiDraftModel = aiDraftDirty ? unsavedAiDraftState?.model ?? null : null
  const aiQuestionTypes = aiQuestionTypesOverride ?? subjectAiPreset.allowedQuestionTypes
  const aiTargetMarks =
    aiTargetMarksOverride ?? (Number(testQuery.data?.total_marks) > 0 ? Number(testQuery.data?.total_marks) : 20)

  const aiDraftQuestionCount = useMemo(() => getDraftQuestionCount(aiDraft), [aiDraft])
  const aiDraftTotalMarks = useMemo(() => getDraftTotalMarks(aiDraft), [aiDraft])
  const aiDraftSections = useMemo(() => getDraftSections(aiDraft), [aiDraft])
  const aiDraftSavedFingerprint = useMemo(() => JSON.stringify(savedAiDraft ?? null), [savedAiDraft])
  const aiDraftLocalFingerprint = useMemo(() => JSON.stringify(aiDraft ?? null), [aiDraft])

  const aiSourceTopics = useMemo(() => {
    const source = aiUseExecutedOnly ? executedTopics : topicsQuery.data ?? []
    const names = source
      .map((topic) => topic.title?.trim())
      .filter((title): title is string => Boolean(title))
    return Array.from(new Set(names))
  }, [aiUseExecutedOnly, executedTopics, topicsQuery.data])

  const executedLessonPlanSummary = useMemo(
    () =>
      (executedLessonPlansQuery.data ?? []).slice(0, 12).map((plan) => ({
        executed_at: plan.executed_at,
        topic: plan.topic?.title ?? null,
        subtopic: plan.generator_fields?.subtopic ?? null,
        objectives: plan.objectives ?? null,
        activities: plan.activities ?? null,
        assessment: plan.assessment ?? null,
        notes: plan.notes ?? null,
      })),
    [executedLessonPlansQuery.data],
  )

  const aiPromptInstructions = useMemo(() => {
    const userLines = aiTeacherNotes
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    return Array.from(new Set([...subjectAiPreset.defaultInstructions, ...userLines]))
  }, [aiTeacherNotes, subjectAiPreset])

  const availableQuestions = useMemo(() => {
    const chosenIds = new Set((testQuestionsQuery.data ?? []).map((row) => row.question_id))
    const filtered = (questionsQuery.data ?? []).filter((question) => {
      if (chosenIds.has(question.id)) return false
      if (!search.trim()) return true
      return question.question_text.toLowerCase().includes(search.trim().toLowerCase())
    })

    if (!prioritizeExecutedQuestions) return filtered

    return [...filtered].sort((a, b) => {
      const aExec = a.topic_id ? executedTopicIdSet.has(a.topic_id) : false
      const bExec = b.topic_id ? executedTopicIdSet.has(b.topic_id) : false
      if (aExec === bExec) return 0
      return aExec ? -1 : 1
    })
  }, [questionsQuery.data, testQuestionsQuery.data, search, prioritizeExecutedQuestions, executedTopicIdSet])

  const totalMarks = (testQuestionsQuery.data ?? []).reduce((sum, row) => sum + Number(row.marks), 0)

  const hasSavedAiDraft = Boolean(savedAiDraft)
  const hasAiDraft = Boolean(aiDraft)
  const isAiDraftSynced = aiDraftLocalFingerprint === aiDraftSavedFingerprint

  function toggleAiQuestionType(type: AiQuestionType) {
    setAiQuestionTypesOverride((prev) => {
      const base = prev ?? aiQuestionTypes
      return base.includes(type) ? base.filter((value) => value !== type) : [...base, type]
    })
  }

  function getAiPrintMeta() {
    return {
      title: aiDraft?.paper_title ?? testQuery.data?.title ?? 'AI Test Draft',
      className: testQuery.data?.classroom?.name ?? aiDraft?.class_level ?? 'Class',
      subjectName: testQuery.data?.subject?.name ?? aiDraft?.subject ?? 'Subject',
    }
  }

  function handlePrintAiDraft(mode: AiDraftPrintMode) {
    if (!aiDraft) return
    try {
      printAiDraft(aiDraft, getAiPrintMeta(), mode)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to print exam draft')
    }
  }

  if (searchParams.get('print') === '1') {
    return <Navigate to={`/teacher/tests/${id}/print`} replace />
  }

  if (
    testQuery.isLoading ||
    testQuestionsQuery.isLoading ||
    questionsQuery.isLoading ||
    topicsQuery.isLoading ||
    executedLessonPlansQuery.isLoading
  ) {
    return <LoadingState />
  }

  if (!testQuery.data) {
    return <EmptyState title='Test not found' description='The selected test does not exist or is inaccessible.' />
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title={`Test Builder: ${testQuery.data.title}`}
        description='Add questions manually or auto-generate by topic and difficulty.'
      />

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardContent className='flex flex-wrap items-center justify-between gap-4 p-6'>
          <div className='space-y-1'>
            <p className='font-medium'>
              {testQuery.data.classroom?.name} | {testQuery.data.subject?.name}
            </p>
            <p className='text-sm text-muted-foreground'>
              Term: {testQuery.data.term ?? '-'} | Date: {testQuery.data.date ?? '-'}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary' className='rounded-xl px-3 py-1'>
              {testQuestionsQuery.data?.length ?? 0} Questions
            </Badge>
            <Badge className='rounded-xl px-3 py-1'>{totalMarks} Marks</Badge>
            <Button asChild variant='outline' className='rounded-xl'>
              <Link to={`/teacher/tests/${id}/print`}>
                <Printer className='mr-2 h-4 w-4' /> Print Paper
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle className='font-heading text-xl'>Executed Coverage</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='secondary' className='rounded-xl px-3 py-1'>
              {executedLessonPlansQuery.data?.length ?? 0} Executed lesson plans
            </Badge>
            <Badge variant='secondary' className='rounded-xl px-3 py-1'>
              {executedTopics.length} Taught topics
            </Badge>
          </div>

          {executedTopics.length ? (
            <div className='flex flex-wrap gap-2'>
              {executedTopics.map((topic) => (
                <Badge key={topic.id} variant='outline' className='rounded-xl'>
                  {topic.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              No executed lesson plans are marked yet for this class and subject. Builder still works normally.
            </p>
          )}
        </CardContent>
      </Card>

      <div className='grid gap-6 xl:grid-cols-2'>
        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader>
            <CardTitle className='font-heading text-xl'>Question Bank</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Search question text...'
              className='rounded-xl'
            />

            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={prioritizeExecutedQuestions}
                onChange={(event) => setPrioritizeExecutedQuestions(event.target.checked)}
              />
              <span>Show executed-topic questions first</span>
            </label>

            <div className='max-h-[420px] space-y-2 overflow-auto pr-1'>
              {availableQuestions.map((question) => (
                <label
                  key={question.id}
                  className='flex cursor-pointer items-start gap-3 rounded-2xl border p-3 hover:bg-muted/40'
                >
                  <input
                    type='checkbox'
                    checked={selectedQuestionIds.includes(question.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedQuestionIds((prev) => [...prev, question.id])
                      } else {
                        setSelectedQuestionIds((prev) => prev.filter((value) => value !== question.id))
                      }
                    }}
                    className='mt-1'
                  />
                  <div>
                    <p className='line-clamp-2 font-medium'>{question.question_text}</p>
                    <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                      <span>{question.topic?.title ?? 'No topic'}</span>
                      <span>|</span>
                      <span>{question.difficulty}</span>
                      <span>|</span>
                      <span>{question.marks} marks</span>
                      {question.topic_id && executedTopicIdSet.has(question.topic_id) ? (
                        <Badge variant='outline' className='rounded-lg px-1.5 py-0 text-[10px]'>
                          Executed topic
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </label>
              ))}

              {!availableQuestions.length ? (
                <p className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
                  No available questions match this filter.
                </p>
              ) : null}
            </div>

            <Button
              className='rounded-xl'
              disabled={!selectedQuestionIds.length || addMutation.isPending}
              onClick={() => {
                const currentCount = testQuestionsQuery.data?.length ?? 0
                addMutation.mutate({
                  testId: id,
                  questions: selectedQuestionIds.map((questionId, index) => {
                    const question = (questionsQuery.data ?? []).find((item) => item.id === questionId)
                    return {
                      question_id: questionId,
                      order_no: currentCount + index + 1,
                      marks: question?.marks ?? 1,
                    }
                  }),
                })
              }}
            >
              <Plus className='mr-2 h-4 w-4' />
              Add selected ({selectedQuestionIds.length})
            </Button>
          </CardContent>
        </Card>

        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader>
            <CardTitle className='font-heading text-xl'>Auto Generate</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label>Question source</Label>
              <Select
                value={autoSourceMode}
                onValueChange={(value) => setAutoSourceMode(value as 'all' | 'executed')}
              >
                <SelectTrigger className='rounded-xl'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All subject questions</SelectItem>
                  <SelectItem value='executed'>Executed topics only</SelectItem>
                </SelectContent>
              </Select>
              {autoSourceMode === 'executed' ? (
                <p className='text-xs text-muted-foreground'>
                  Uses all topics from executed lesson plans for this class and subject ({executedTopics.length} topics).
                </p>
              ) : null}
            </div>

            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label>Topic</Label>
                <Select
                  value={topicId || '__all__'}
                  onValueChange={(value) => setTopicId(value === '__all__' ? '' : value)}
                  disabled={autoSourceMode === 'executed'}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder={autoSourceMode === 'executed' ? 'Driven by executed topics' : 'Any topic'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__all__'>Any topic</SelectItem>
                    {(topicsQuery.data ?? []).map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Difficulty</Label>
                <Select
                  value={difficulty || '__all__'}
                  onValueChange={(value) =>
                    setDifficulty(value === '__all__' ? '' : (value as 'easy' | 'medium' | 'hard'))
                  }
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder='Any difficulty' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__all__'>Any difficulty</SelectItem>
                    <SelectItem value='easy'>Easy</SelectItem>
                    <SelectItem value='medium'>Medium</SelectItem>
                    <SelectItem value='hard'>Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='count'>Count</Label>
                <Input
                  id='count'
                  type='number'
                  min={1}
                  max={50}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value || 1))}
                />
              </div>
            </div>

            <Button
              className='rounded-xl'
              disabled={count < 1 || autoMutation.isPending || (autoSourceMode === 'executed' && !executedTopicIds.length)}
              onClick={() => {
                autoMutation.mutate({
                  testId: id,
                  subjectId: testQuery.data.subject_id,
                  topicId: autoSourceMode === 'all' ? topicId || undefined : undefined,
                  topicIds: autoSourceMode === 'executed' ? executedTopicIds : undefined,
                  difficulty: difficulty || undefined,
                  count,
                })
              }}
            >
              {autoMutation.isPending ? 'Generating...' : 'Generate and add questions'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <CardTitle className='font-heading text-xl'>Create Exam Draft (Question Paper + Marking Guide)</CardTitle>
            <div className='flex flex-wrap items-center gap-2'>
              {hasSavedAiDraft ? (
                <Badge variant='secondary' className='rounded-xl px-3 py-1'>
                  Saved draft on this test
                </Badge>
              ) : null}
              {hasAiDraft ? (
                <Badge variant={isAiDraftSynced ? 'secondary' : 'outline'} className='rounded-xl px-3 py-1'>
                  {isAiDraftSynced ? 'Draft saved' : 'Unsaved AI draft'}
                </Badge>
              ) : null}
              {aiDraftModel ? (
                <Badge variant='outline' className='rounded-xl px-3 py-1'>
                  {aiDraftModel}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid gap-6 xl:grid-cols-[1.1fr_1.4fr]'>
            <div className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                <Label htmlFor='ai-target-marks'>Target total marks</Label>
                  <Input
                    id='ai-target-marks'
                    type='number'
                    min={1}
                    max={300}
                    value={aiTargetMarks}
                    onChange={(event) => setAiTargetMarksOverride(Math.max(1, Number(event.target.value || 1)))}
                    className='rounded-xl'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='ai-language'>Language</Label>
                  <Input
                    id='ai-language'
                    value={aiLanguage}
                    onChange={(event) => setAiLanguage(event.target.value)}
                    placeholder='English'
                    className='rounded-xl'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Question types (subject-friendly default)</Label>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {AI_QUESTION_TYPES.map((type) => (
                    <label key={type} className='flex items-center gap-2 rounded-xl border px-3 py-2 text-sm'>
                      <input
                        type='checkbox'
                        checked={aiQuestionTypes.includes(type)}
                        onChange={() => toggleAiQuestionType(type)}
                      />
                      <span className='capitalize'>{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Subject preset: <span className='font-medium capitalize'>{subjectAiPreset.key}</span>. You can override the question
                  types above before generating.
                </p>
              </div>

              <div className='space-y-2'>
                <Label>Topics to use for this exam draft</Label>
                <div className='space-y-2 rounded-2xl border p-3'>
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='checkbox'
                      checked={aiUseExecutedOnly}
                      onChange={(event) => setAiUseExecutedOnly(event.target.checked)}
                    />
                    <span>Use executed lesson plan topics only ({executedTopics.length} topics)</span>
                  </label>
                  <p className='text-xs text-muted-foreground'>
                    {aiUseExecutedOnly
                      ? 'AI will prioritize executed lesson plans and taught topics for this class and subject.'
                      : 'AI can use all topics available under this subject in the question bank/topic list.'}
                  </p>
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='ai-teacher-notes'>Extra instructions (optional)</Label>
                <Textarea
                  id='ai-teacher-notes'
                  value={aiTeacherNotes}
                  onChange={(event) => setAiTeacherNotes(event.target.value)}
                  placeholder='Example: Make Section A short-answer only. Include 2 word problems. Keep wording simple.'
                  className='min-h-[110px] rounded-xl'
                />
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button
                  className='rounded-xl'
                  disabled={
                    aiGenerateMutation.isPending ||
                    aiTargetMarks < 1 ||
                    !aiQuestionTypes.length ||
                    (aiUseExecutedOnly && !executedTopics.length)
                  }
                  onClick={() => {
                    aiGenerateMutation.mutate({
                      subject: testQuery.data.subject?.name ?? 'Subject',
                      class_level: testQuery.data.classroom?.name ?? 'Class',
                      test_title: testQuery.data.title,
                      term: testQuery.data.term,
                      date: testQuery.data.date,
                      language: aiLanguage.trim() || 'English',
                      total_marks: aiTargetMarks,
                      instructions: aiPromptInstructions,
                      allowed_question_types: aiQuestionTypes,
                      difficulty_distribution: { easy: 0.4, medium: 0.4, hard: 0.2 },
                      source_topics: aiSourceTopics,
                      executed_lesson_plans: executedLessonPlanSummary,
                      subject_rules: {
                        ...subjectAiPreset.subjectRules,
                        paper_first: true,
                        hand_marking: true,
                        no_online_sitting: true,
                      },
                    })
                  }}
                >
                    <Sparkles className='mr-2 h-4 w-4' />
                    {aiGenerateMutation.isPending ? 'Creating exam draft...' : 'Create exam draft'}
                  </Button>

                {hasAiDraft ? (
                  <Button
                    variant='outline'
                    className='rounded-xl'
                    disabled={saveAiDraftMutation.isPending || !aiDraft || isAiDraftSynced}
                    onClick={() => {
                      if (!aiDraft) return
                      saveAiDraftMutation.mutate({
                        ai_draft_json: aiDraft,
                        total_marks: aiDraftTotalMarks > 0 ? aiDraftTotalMarks : aiTargetMarks,
                      })
                    }}
                  >
                    <Save className='mr-2 h-4 w-4' />
                    {saveAiDraftMutation.isPending ? 'Saving...' : 'Save exam draft'}
                  </Button>
                ) : null}
              </div>

              <div className='rounded-2xl border border-dashed p-3 text-xs text-muted-foreground'>
                This creates a paper-first exam draft (question paper + marking guide). Students answer on paper, then teachers mark by
                hand and record scores in the Marking page.
              </div>
            </div>

            <div className='space-y-4'>
              {hasAiDraft ? (
                <>
                  <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4'>
                    <div className='space-y-1'>
                      <p className='font-medium'>{aiDraft?.paper_title ?? testQuery.data.title}</p>
                      <p className='text-sm text-muted-foreground'>
                        {aiDraftQuestionCount} questions | Total marks: {aiDraftTotalMarks} | {aiDraftSections.length} section
                        {aiDraftSections.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <Button variant='outline' className='rounded-xl' onClick={() => handlePrintAiDraft('exam')}>
                        <Printer className='mr-2 h-4 w-4' />
                        Print exam
                      </Button>
                      <Button
                        variant='outline'
                        className='rounded-xl'
                        onClick={() => handlePrintAiDraft('marking-guide')}
                      >
                        <Printer className='mr-2 h-4 w-4' />
                        Print marking guide
                      </Button>
                    </div>
                  </div>

                  <Tabs defaultValue='paper' className='w-full'>
                    <TabsList className='rounded-xl'>
                      <TabsTrigger value='paper'>Question Paper</TabsTrigger>
                      <TabsTrigger value='scheme'>Marking Guide</TabsTrigger>
                    </TabsList>

                    <TabsContent value='paper' className='mt-3'>
                      <div className='max-h-[620px] space-y-4 overflow-auto rounded-2xl border bg-white p-4 text-black'>
                        <div className='space-y-1'>
                          <h3 className='text-lg font-semibold'>{aiDraft?.paper_title ?? testQuery.data.title}</h3>
                          <p className='text-sm'>
                            Class: {aiDraft?.class_level ?? testQuery.data.classroom?.name ?? '-'} | Subject:{' '}
                            {aiDraft?.subject ?? testQuery.data.subject?.name ?? '-'}
                          </p>
                          <p className='text-sm'>
                            Term: {aiDraft?.term ?? testQuery.data.term ?? '-'} | Date: {formatDate(aiDraft?.date ?? testQuery.data.date)} |
                            Total Marks: {aiDraftTotalMarks}
                          </p>
                        </div>

                        {toArray(aiDraft?.instructions).length ? (
                          <div>
                            <p className='font-medium'>Instructions</p>
                            <ul className='mt-1 list-disc space-y-1 pl-5 text-sm'>
                              {toArray(aiDraft?.instructions).map((line, index) => (
                                <li key={`${line}-${index}`}>{line}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {aiDraftSections.map((section, sectionIndex) => (
                          <div key={`${section.title ?? 'section'}-${sectionIndex}`} className='space-y-3 rounded-xl border p-4'>
                            <div className='space-y-1'>
                              <p className='font-semibold'>{section.title ?? `Section ${sectionIndex + 1}`}</p>
                              <p className='text-xs text-muted-foreground'>
                                Type: {(section.question_type ?? 'mixed').toString().replace('_', ' ')}
                              </p>
                              {toArray(section.section_instructions).length ? (
                                <ul className='list-disc space-y-1 pl-4 text-sm text-muted-foreground'>
                                  {toArray(section.section_instructions).map((line, idx) => (
                                    <li key={`${line}-${idx}`}>{line}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>

                            <ol className='space-y-3 pl-5'>
                              {toArray(section.questions).map((question, questionIndex) => (
                                <li
                                  key={`${question.question_text}-${questionIndex}`}
                                  value={getDraftQuestionNumber(question, questionIndex + 1)}
                                  className='space-y-2 rounded-lg border p-3'
                                >
                                  <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <p className='font-medium'>
                                      {sanitizeQuestionPaperText(question.question_text ?? '')}
                                    </p>
                                    <Badge variant='outline' className='rounded-lg'>
                                      {Number(question.marks ?? 0)} marks
                                    </Badge>
                                  </div>
                                  {question.topic_hint ? (
                                    <p className='text-xs text-muted-foreground'>Topic: {question.topic_hint}</p>
                                  ) : null}
                                  {question.difficulty ? (
                                    <p className='text-xs text-muted-foreground'>Difficulty: {String(question.difficulty)}</p>
                                  ) : null}
                                  {question.choices && Object.keys(question.choices).length ? (
                                    <div className='grid gap-2 sm:grid-cols-2'>
                                      {Object.entries(question.choices).map(([key, value]) => (
                                        <div key={key} className='rounded-lg border p-2 text-sm'>
                                          <span className='font-semibold'>{key}.</span> {String(value)}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className='space-y-2 rounded-lg border border-dashed p-3'>
                                      {Array.from({
                                        length: getAnswerSpaceLineCount(question, String(section.question_type ?? '')),
                                      }).map((_, lineIndex) => (
                                        <div
                                          key={`answer-line-${questionIndex}-${lineIndex}`}
                                          className='min-h-5 border-b border-dashed border-slate-400'
                                        />
                                      ))}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value='scheme' className='mt-3'>
                      <div className='max-h-[620px] space-y-4 overflow-auto rounded-2xl border bg-white p-4 text-black'>
                        <h3 className='text-lg font-semibold'>Marking Guide</h3>
                        {aiDraftSections.map((section, sectionIndex) => (
                          <div key={`${section.title ?? 'scheme'}-${sectionIndex}`} className='space-y-3 rounded-xl border p-4'>
                            <div>
                              <p className='font-semibold'>{section.title ?? `Section ${sectionIndex + 1}`}</p>
                              <p className='text-xs text-muted-foreground'>
                                Type: {(section.question_type ?? 'mixed').toString().replace('_', ' ')}
                              </p>
                            </div>

                            {toArray(section.questions).map((question, questionIndex) => {
                              const answerKey = question.answer_key ?? {}
                              const markingScheme = question.marking_scheme ?? {}
                              const acceptedAnswers = toArray(answerKey.accepted_answers)
                              const markItems = toArray(markingScheme.items)

                              return (
                                <div key={`${question.question_text}-scheme-${questionIndex}`} className='rounded-lg border p-3'>
                                  <div className='flex flex-wrap items-start justify-between gap-2'>
                                    <p className='font-medium'>
                                      Q{question.question_number ?? questionIndex + 1}. {question.question_text}
                                    </p>
                                    <Badge variant='outline' className='rounded-lg'>
                                      {Number(question.marks ?? 0)} marks
                                    </Badge>
                                  </div>

                                  <div className='mt-2 space-y-1 text-sm'>
                                    {answerKey.correct_option ? <p>Correct option: {String(answerKey.correct_option)}</p> : null}
                                    {answerKey.correct_value ? <p>Correct value: {String(answerKey.correct_value)}</p> : null}
                                    {acceptedAnswers.length ? <p>Accepted answers: {acceptedAnswers.join(', ')}</p> : null}
                                    {answerKey.model_answer ? <p>Model answer: {String(answerKey.model_answer)}</p> : null}
                                    {markItems.length ? (
                                      <div>
                                        <p className='font-medium'>Mark allocation</p>
                                        <ul className='list-disc space-y-1 pl-5'>
                                          {markItems.map((item, itemIndex) => (
                                            <li key={`${item.criterion ?? 'criterion'}-${itemIndex}`}>
                                              {item.criterion ?? 'Criterion'} - {Number(item.marks ?? 0)} marks
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    {markingScheme.notes ? <p>Notes: {String(markingScheme.notes)}</p> : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <div className='rounded-2xl border border-dashed p-6 text-sm text-muted-foreground'>
                  Create an exam draft here to preview the question paper and marking guide. You can print it for students and save the
                  draft on this test for later reuse.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle className='font-heading text-xl'>Selected Questions</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {(testQuestionsQuery.data ?? []).map((row, index, arr) => (
            <div key={row.id} className='rounded-2xl border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <div>
                  <p className='font-medium'>
                    Q{index + 1}. {row.question?.question_text ?? 'Question'}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {row.question?.topic?.title ?? 'No topic'} | {row.question?.difficulty ?? '-'} | {row.marks} marks
                  </p>
                </div>

                <div className='flex gap-2'>
                  <Button
                    size='icon'
                    variant='outline'
                    className='rounded-lg'
                    disabled={index === 0 || reorderMutation.isPending}
                    onClick={() => {
                      if (index === 0) return
                      const next = [...arr]
                      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                      reorderMutation.mutate({ rows: next })
                    }}
                  >
                    <ArrowUp className='h-4 w-4' />
                  </Button>
                  <Button
                    size='icon'
                    variant='outline'
                    className='rounded-lg'
                    disabled={index === arr.length - 1 || reorderMutation.isPending}
                    onClick={() => {
                      if (index === arr.length - 1) return
                      const next = [...arr]
                      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                      reorderMutation.mutate({ rows: next })
                    }}
                  >
                    <ArrowDown className='h-4 w-4' />
                  </Button>
                  <Button
                    size='icon'
                    variant='destructive'
                    className='rounded-lg'
                    onClick={() => removeMutation.mutate({ testQuestionId: row.id })}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {!testQuestionsQuery.data?.length ? (
            <EmptyState
              title='No questions in this test'
              description='Select questions from the bank or auto-generate from topic and difficulty.'
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
