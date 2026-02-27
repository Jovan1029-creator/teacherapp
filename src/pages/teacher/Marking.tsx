import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

import { getAttemptAnswers, listAttemptsByTest, replaceAttemptAnswers, upsertAttempt } from '@/api/attempts'
import { listStudentsByClass } from '@/api/students'
import { listTestQuestions } from '@/api/testQuestions'
import { listMyTests } from '@/api/tests'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Attempt, Student } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const answerChoices = ['A', 'B', 'C', 'D'] as const

function parseScoreInput(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

export default function TeacherMarkingPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTestId = searchParams.get('testId') ?? ''

  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({})
  const [answerDialogStudent, setAnswerDialogStudent] = useState<Student | null>(null)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string | null>>({})

  const testsQuery = useQuery({ queryKey: ['tests', 'mine'], queryFn: listMyTests })

  const myTests = useMemo(() => testsQuery.data ?? [], [testsQuery.data])

  const selectedTest = useMemo(
    () => myTests.find((test) => test.id === selectedTestId) ?? null,
    [myTests, selectedTestId],
  )

  const testQuestionsQuery = useQuery({
    queryKey: ['test-questions', selectedTestId],
    queryFn: () => listTestQuestions(selectedTest!.id),
    enabled: Boolean(selectedTest),
  })
  const studentsQuery = useQuery({
    queryKey: ['students', 'marking', selectedTest?.class_id ?? '__none__'],
    queryFn: () => listStudentsByClass(selectedTest?.class_id),
    enabled: Boolean(selectedTest?.class_id),
  })
  const attemptsQuery = useQuery({
    queryKey: ['attempts', selectedTestId],
    queryFn: () => listAttemptsByTest(selectedTest!.id),
    enabled: Boolean(selectedTest),
  })

  const attemptsByStudentId = useMemo(() => {
    const map = new Map<string, Attempt>()
    for (const row of attemptsQuery.data ?? []) {
      map.set(row.student_id, row)
    }
    return map
  }, [attemptsQuery.data])

  const scoreLimits = useMemo(() => {
    const total = Number(selectedTest?.total_marks ?? 0)
    return { hasMax: total > 0, max: total }
  }, [selectedTest?.total_marks])

  const dirtyStudentIds = useMemo(() => {
    if (!studentsQuery.data) return new Set<string>()
    const dirty = new Set<string>()
    for (const student of studentsQuery.data) {
      const existing = attemptsByStudentId.get(student.id)
      const draft = scoreDrafts[student.id] ?? (existing ? String(existing.total_score ?? 0) : '')
      const parsedDraft = parseScoreInput(draft)
      const existingScore = existing ? Number(existing.total_score ?? 0) : null
      if (parsedDraft !== existingScore) dirty.add(student.id)
    }
    return dirty
  }, [studentsQuery.data, scoreDrafts, attemptsByStudentId])

  const totalScoresMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTestId || !studentsQuery.data) return

      for (const student of studentsQuery.data) {
        if (!dirtyStudentIds.has(student.id)) continue

        const raw = scoreDrafts[student.id] ?? ''
        const parsed = parseScoreInput(raw)
        const normalized = parsed ?? 0

        if (normalized < 0) throw new Error(`Score for ${student.full_name} cannot be negative.`)
        if (scoreLimits.hasMax && normalized > scoreLimits.max) {
          throw new Error(`Score for ${student.full_name} exceeds ${scoreLimits.max}.`)
        }

        await upsertAttempt({
          test_id: selectedTestId,
          student_id: student.id,
          total_score: normalized,
        })
      }
    },
    onSuccess: async () => {
      setScoreDrafts({})
      await queryClient.invalidateQueries({ queryKey: ['attempts', selectedTestId] })
      toast.success('Scores saved')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const dialogAttempt = answerDialogStudent ? attemptsByStudentId.get(answerDialogStudent.id) : undefined
  const attemptAnswersQuery = useQuery({
    queryKey: ['attempt-answers', dialogAttempt?.id ?? '__none__'],
    queryFn: () => getAttemptAnswers(dialogAttempt!.id),
    enabled: Boolean(dialogAttempt?.id && answerDialogStudent),
  })

  const savedAnswerDrafts = useMemo(() => {
    const next: Record<string, string> = {}
    for (const row of attemptAnswersQuery.data ?? []) {
      if (row.answer_text) next[row.question_id] = row.answer_text
    }
    return next
  }, [attemptAnswersQuery.data])

  const effectiveAnswerDrafts = useMemo(() => {
    const next: Record<string, string> = { ...savedAnswerDrafts }
    for (const [questionId, value] of Object.entries(answerDrafts)) {
      if (value == null || value === '') delete next[questionId]
      else next[questionId] = value
    }
    return next
  }, [savedAnswerDrafts, answerDrafts])

  const answerScoring = useMemo(() => {
    const rows = (testQuestionsQuery.data ?? []).map((row) => {
      const selected = effectiveAnswerDrafts[row.question_id] ?? ''
      const correct = row.question?.correct_answer ?? ''
      const isCorrect = selected ? selected === correct : null
      const score = selected && isCorrect ? Number(row.marks ?? 0) : 0
      return {
        row,
        selected,
        isCorrect,
        score,
      }
    })

    return {
      rows,
      total: rows.reduce((sum, item) => sum + item.score, 0),
    }
  }, [testQuestionsQuery.data, effectiveAnswerDrafts])

  const answerDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTestId || !answerDialogStudent) throw new Error('No student selected.')

      const attempt = await upsertAttempt({
        test_id: selectedTestId,
        student_id: answerDialogStudent.id,
        total_score: answerScoring.total,
      })

      const payload = answerScoring.rows
        .filter((item) => item.selected)
        .map((item) => ({
          question_id: item.row.question_id,
          answer_text: item.selected,
          is_correct: Boolean(item.isCorrect),
          score: item.score,
        }))

      await replaceAttemptAnswers(attempt.id, payload)

      return {
        attemptId: attempt.id,
        studentId: answerDialogStudent.id,
        totalScore: answerScoring.total,
      }
    },
    onSuccess: async (result) => {
      setScoreDrafts((prev) => ({ ...prev, [result.studentId]: String(result.totalScore) }))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attempts', selectedTestId] }),
        queryClient.invalidateQueries({ queryKey: ['attempt-answers', result.attemptId] }),
      ])
      toast.success('Answer details saved')
      setAnswerDrafts({})
      setAnswerDialogStudent(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const isLoading = testsQuery.isLoading || (selectedTestId && (testQuestionsQuery.isLoading || studentsQuery.isLoading || attemptsQuery.isLoading))

  if (isLoading) return <LoadingState label='Loading marking workspace...' />

  if (testsQuery.isError) {
    return <EmptyState title='Marking unavailable' description='Could not load tests. Check your connection and try again.' />
  }

  const noTests = myTests.length === 0

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Marking'
        description='Record hardcopy exam marks quickly and optionally capture answer details for analytics.'
      />

      {noTests ? (
        <EmptyState
          title='No teacher tests yet'
          description='Create and build a test first, then return here to record scores from paper marking.'
        />
      ) : (
        <>
          <Card className='rounded-3xl border-none shadow-sm'>
            <CardHeader>
              <CardTitle>Select Test</CardTitle>
              <CardDescription>Choose a test to load the class roster and saved marks.</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4 md:grid-cols-[1fr_auto_auto]'>
              <div className='space-y-2'>
                <Label>Test</Label>
                <Select
                  value={selectedTestId || '__none__'}
                  onValueChange={(value) => {
                    const next = new URLSearchParams(searchParams)
                    if (value === '__none__') next.delete('testId')
                    else next.set('testId', value)
                    setScoreDrafts({})
                    setAnswerDrafts({})
                    setAnswerDialogStudent(null)
                    setSearchParams(next, { replace: true })
                  }}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder='Select a test' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Choose test</SelectItem>
                    {myTests.map((test) => (
                      <SelectItem key={test.id} value={test.id}>
                        {test.title} | {test.classroom?.name ?? 'Class'} | {formatDate(test.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='rounded-2xl border p-4 text-sm'>
                <p className='font-medium'>Questions</p>
                <p className='text-muted-foreground'>{testQuestionsQuery.data?.length ?? 0}</p>
              </div>
              <div className='rounded-2xl border p-4 text-sm'>
                <p className='font-medium'>Total Marks</p>
                <p className='text-muted-foreground'>{selectedTest?.total_marks ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          {!selectedTestId ? (
            <EmptyState title='Choose a test' description='Select a test above to start recording marks.' />
          ) : !selectedTest ? (
            <EmptyState
              title='Test not available'
              description='This test is not in your teacher-owned test list. Choose another test.'
            />
          ) : (
            <>
              {selectedTest.total_marks === 0 ? (
                <Card className='rounded-3xl border border-amber-300/60 bg-amber-50/50 shadow-sm'>
                  <CardContent className='p-4 text-sm text-amber-900'>
                    This test currently has total marks = 0. Build the test and verify question marks first. You can
                    still record scores if needed.
                  </CardContent>
                </Card>
              ) : null}

              {!studentsQuery.data?.length ? (
                <EmptyState
                  title='No students in this class'
                  description='Add students to the selected class before recording marks.'
                />
              ) : (
                <Card className='rounded-3xl border-none shadow-sm'>
                  <CardHeader>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div>
                        <CardTitle>{selectedTest.title}</CardTitle>
                        <CardDescription>
                          {selectedTest.classroom?.name ?? 'Class'} | {selectedTest.subject?.name ?? 'Subject'} |{' '}
                          {formatDate(selectedTest.date)}
                        </CardDescription>
                      </div>
                      <Button
                        className='rounded-xl'
                        disabled={dirtyStudentIds.size === 0 || totalScoresMutation.isPending}
                        onClick={() => totalScoresMutation.mutate()}
                      >
                        <Save className='mr-2 h-4 w-4' />
                        Save changed totals ({dirtyStudentIds.size})
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='w-12'>#</TableHead>
                          <TableHead>Admission No</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead className='w-40'>Score</TableHead>
                          <TableHead className='w-40'>Status</TableHead>
                          <TableHead className='w-40'>Answers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsQuery.data.map((student, index) => {
                          const attempt = attemptsByStudentId.get(student.id)
                          const hasAnswerRecords = Boolean(attempt?.attempt_answers?.length)

                          return (
                            <TableRow key={student.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{student.admission_no ?? '-'}</TableCell>
                              <TableCell className='font-medium'>{student.full_name}</TableCell>
                              <TableCell>
                                <Input
                                  type='number'
                                  min={0}
                                  max={scoreLimits.hasMax ? scoreLimits.max : undefined}
                                  value={
                                    scoreDrafts[student.id] ??
                                    (attempt ? String(attempt.total_score ?? 0) : '')
                                  }
                                  onChange={(event) =>
                                    setScoreDrafts((prev) => ({ ...prev, [student.id]: event.target.value }))
                                  }
                                  className='h-9 rounded-lg'
                                />
                              </TableCell>
                              <TableCell>
                                {attempt ? (
                                  hasAnswerRecords ? (
                                    <Badge>Answers recorded</Badge>
                                  ) : (
                                    <Badge variant='secondary'>Total score recorded</Badge>
                                  )
                                ) : (
                                  <Badge variant='outline'>Not recorded</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  className='rounded-lg'
                                  disabled={!testQuestionsQuery.data?.length}
                                  onClick={() => {
                                    setAnswerDrafts({})
                                    setAnswerDialogStudent(student)
                                  }}
                                >
                                  Answer details
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      <Dialog
        open={Boolean(answerDialogStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setAnswerDrafts({})
            setAnswerDialogStudent(null)
          }
        }}
      >
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl'>
          <DialogHeader>
            <DialogTitle>
              Answer Details{answerDialogStudent ? `: ${answerDialogStudent.full_name}` : ''}
            </DialogTitle>
            <DialogDescription>
              Optional answer capture for paper marking. Saving here recalculates total score from selected answers.
            </DialogDescription>
          </DialogHeader>

          {attemptAnswersQuery.isLoading ? (
            <LoadingState label='Loading existing answers...' />
          ) : !testQuestionsQuery.data?.length ? (
            <EmptyState
              title='No test questions'
              description='This test has no questions yet. Build the test before capturing answers.'
            />
          ) : (
            <div className='space-y-4'>
              <div className='rounded-xl border bg-muted/30 p-3 text-sm'>
                Computed score from answers: <span className='font-semibold'>{answerScoring.total}</span>
                {selectedTest ? ` / ${selectedTest.total_marks}` : ''}
              </div>

              {answerScoring.rows.map((item, index) => {
                const question = item.row.question
                const choices = (question?.choices ?? {}) as Record<string, string>

                return (
                  <div key={item.row.id} className='rounded-2xl border p-4'>
                    <div className='mb-3 flex flex-wrap items-start justify-between gap-2'>
                      <div>
                        <p className='font-medium'>
                          Q{index + 1}. {question?.question_text ?? 'Question'}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Correct: {question?.correct_answer ?? '-'} | {item.row.marks} marks
                        </p>
                      </div>
                      {item.selected ? (
                        item.isCorrect ? (
                          <Badge>Correct (+{item.score})</Badge>
                        ) : (
                          <Badge variant='destructive'>Wrong (+0)</Badge>
                        )
                      ) : (
                        <Badge variant='outline'>No answer</Badge>
                      )}
                    </div>

                    <RadioGroup
                      value={effectiveAnswerDrafts[item.row.question_id] ?? ''}
                      onValueChange={(value) =>
                        setAnswerDrafts((prev) => ({ ...prev, [item.row.question_id]: value }))
                      }
                      className='grid gap-2 md:grid-cols-2'
                    >
                      {answerChoices.map((choice) => (
                        <label key={choice} className='flex cursor-pointer items-start gap-3 rounded-xl border p-3'>
                          <RadioGroupItem value={choice} className='mt-1' />
                          <div className='text-sm'>
                            <span className='font-semibold'>{choice}.</span> {choices[choice] ?? '-'}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>

                    <div className='mt-3'>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='rounded-lg'
                        onClick={() =>
                          setAnswerDrafts((prev) => {
                            const next = { ...prev }
                            next[item.row.question_id] = null
                            return next
                          })
                        }
                      >
                        Clear answer
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setAnswerDialogStudent(null)}>
              Cancel
            </Button>
            <Button
              className='rounded-xl'
              disabled={!answerDialogStudent || !testQuestionsQuery.data?.length || answerDetailsMutation.isPending}
              onClick={() => answerDetailsMutation.mutate()}
            >
              Save answer details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
