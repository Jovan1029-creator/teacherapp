import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { getAttemptAnswers, listAttemptsByTest } from '@/api/attempts'
import { listMyTests } from '@/api/tests'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { Attempt, AttemptAnswer, Test } from '@/lib/types'
import { formatDate } from '@/lib/utils'

function groupAttemptsByTest(tests: Test[], attemptMap: Record<string, Attempt[]>) {
  return tests.map((test) => ({
    test,
    attempts: attemptMap[test.id] ?? [],
  }))
}

export default function TeacherAnalyticsPage() {
  const [selectedTestId, setSelectedTestId] = useState<string>('')

  const testsQuery = useQuery({ queryKey: ['tests', 'mine'], queryFn: listMyTests })

  const myTests = useMemo(() => testsQuery.data ?? [], [testsQuery.data])

  const visibleTests = useMemo(
    () => (selectedTestId ? myTests.filter((test) => test.id === selectedTestId) : myTests),
    [myTests, selectedTestId],
  )

  const attemptsByTestQuery = useQuery({
    queryKey: ['teacher-analytics-attempts', myTests.map((test) => test.id)],
    enabled: myTests.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(myTests.map(async (test) => [test.id, await listAttemptsByTest(test.id)] as const))
      return Object.fromEntries(entries) as Record<string, Attempt[]>
    },
  })

  const visibleAttemptGroups = useMemo(
    () => groupAttemptsByTest(visibleTests, attemptsByTestQuery.data ?? {}),
    [visibleTests, attemptsByTestQuery.data],
  )

  const visibleAttempts = useMemo(
    () => visibleAttemptGroups.flatMap((group) => group.attempts),
    [visibleAttemptGroups],
  )

  const answerDetailsQuery = useQuery({
    queryKey: ['teacher-analytics-answers', visibleAttempts.map((attempt) => attempt.id)],
    enabled: visibleAttempts.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        visibleAttempts.map(async (attempt) => [attempt.id, await getAttemptAnswers(attempt.id)] as const),
      )
      return Object.fromEntries(entries) as Record<string, AttemptAnswer[]>
    },
  })

  const scoreTrendData = useMemo(
    () =>
      visibleAttemptGroups
        .filter((group) => group.attempts.length > 0)
        .map((group) => {
          const total = group.attempts.reduce((sum, attempt) => sum + Number(attempt.total_score ?? 0), 0)
          const avg = group.attempts.length ? Number((total / group.attempts.length).toFixed(2)) : 0
          return {
            id: group.test.id,
            label: group.test.title,
            shortLabel:
              group.test.title.length > 24 ? `${group.test.title.slice(0, 24).trimEnd()}…` : group.test.title,
            date: group.test.date,
            average_score: avg,
          }
        })
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [visibleAttemptGroups],
  )

  const scoreDistributionData = useMemo(() => {
    const buckets = [
      { bucket: '0-19', count: 0 },
      { bucket: '20-39', count: 0 },
      { bucket: '40-59', count: 0 },
      { bucket: '60-79', count: 0 },
      { bucket: '80-100', count: 0 },
    ]

    for (const attempt of visibleAttempts) {
      const score = Number(attempt.total_score ?? 0)
      if (score < 20) buckets[0].count += 1
      else if (score < 40) buckets[1].count += 1
      else if (score < 60) buckets[2].count += 1
      else if (score < 80) buckets[3].count += 1
      else buckets[4].count += 1
    }

    return buckets
  }, [visibleAttempts])

  const weakestTopics = useMemo(() => {
    const topicMap = new Map<
      string,
      { topic_id: string; topic_title: string; correct_count: number; total_count: number; pct_correct: number }
    >()

    for (const attempt of visibleAttempts) {
      const answerRows = answerDetailsQuery.data?.[attempt.id] ?? []
      for (const row of answerRows) {
        const topicId = row.question?.topic_id ?? row.question?.topic?.id
        if (!topicId) continue

        const current = topicMap.get(topicId) ?? {
          topic_id: topicId,
          topic_title: row.question?.topic?.title ?? 'Untitled topic',
          correct_count: 0,
          total_count: 0,
          pct_correct: 0,
        }

        current.total_count += 1
        if (row.is_correct) current.correct_count += 1
        topicMap.set(topicId, current)
      }
    }

    return Array.from(topicMap.values())
      .map((row) => ({
        ...row,
        pct_correct: row.total_count ? Number(((row.correct_count / row.total_count) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.pct_correct - b.pct_correct)
      .slice(0, 8)
  }, [visibleAttempts, answerDetailsQuery.data])

  const hasAnyTests = myTests.length > 0
  const isLoading = testsQuery.isLoading || (hasAnyTests && attemptsByTestQuery.isLoading) || answerDetailsQuery.isLoading

  if (isLoading) return <LoadingState label='Loading analytics...' />

  if (testsQuery.isError || attemptsByTestQuery.isError) {
    return <EmptyState title='Analytics unavailable' description='Could not load analytics data. Try again later.' />
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Analytics'
        description='Review score trends and distributions from recorded paper-marking results.'
      />

      {!hasAnyTests ? (
        <EmptyState
          title='No teacher tests yet'
          description='Create and build a test first, then record marks to see analytics.'
        />
      ) : (
        <>
          <Card className='rounded-3xl border-none shadow-sm'>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
              <CardDescription>Default scope is your tests only.</CardDescription>
            </CardHeader>
            <CardContent className='max-w-xl'>
              <Select value={selectedTestId || '__all__'} onValueChange={(value) => setSelectedTestId(value === '__all__' ? '' : value)}>
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='Filter by test' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All my tests</SelectItem>
                  {myTests.map((test) => (
                    <SelectItem key={test.id} value={test.id}>
                      {test.title} | {test.classroom?.name ?? 'Class'} | {formatDate(test.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {visibleAttempts.length === 0 ? (
            <EmptyState
              title='No recorded marks yet'
              description='Use the Marking page to record paper exam scores, then analytics will appear here.'
            />
          ) : (
            <>
              <div className='grid gap-6 xl:grid-cols-2'>
                <Card className='rounded-3xl border-none shadow-sm'>
                  <CardHeader>
                    <CardTitle>Score Trend</CardTitle>
                    <CardDescription>Average score per test based on recorded marks.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoreTrendData.length ? (
                      <div className='h-80'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <LineChart data={scoreTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray='3 3' />
                            <XAxis dataKey='shortLabel' angle={-20} textAnchor='end' height={55} />
                            <YAxis allowDecimals={false} />
                            <Tooltip formatter={(value) => [`${value ?? 0}`, 'Average score']} />
                            <Line type='monotone' dataKey='average_score' stroke='hsl(var(--primary))' strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className='text-sm text-muted-foreground'>No trend data yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className='rounded-3xl border-none shadow-sm'>
                  <CardHeader>
                    <CardTitle>Score Distribution</CardTitle>
                    <CardDescription>Bucketed total scores from recorded marks.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className='h-80'>
                      <ResponsiveContainer width='100%' height='100%'>
                        <BarChart data={scoreDistributionData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray='3 3' />
                          <XAxis dataKey='bucket' />
                          <YAxis allowDecimals={false} />
                          <Tooltip formatter={(value) => [`${value ?? 0}`, 'Students']} />
                          <Bar dataKey='count' fill='hsl(var(--primary))' radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className='rounded-3xl border-none shadow-sm'>
                <CardHeader>
                  <CardTitle>Weakest Topics</CardTitle>
                  <CardDescription>
                    Requires answer-level capture from the Marking page. Total-score-only entries do not populate topic analytics.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!weakestTopics.length ? (
                    <EmptyState
                      title='No answer-level data yet'
                      description='Open a student in Marking and save optional answer details to unlock topic performance analytics.'
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Topic</TableHead>
                          <TableHead className='w-32'>Correct</TableHead>
                          <TableHead className='w-32'>Total</TableHead>
                          <TableHead className='w-32'>% Correct</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weakestTopics.map((topic) => (
                          <TableRow key={topic.topic_id}>
                            <TableCell className='font-medium'>{topic.topic_title}</TableCell>
                            <TableCell>{topic.correct_count}</TableCell>
                            <TableCell>{topic.total_count}</TableCell>
                            <TableCell>{topic.pct_correct}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
