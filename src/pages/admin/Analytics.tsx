import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, BookOpen, ClipboardCheck, FileDown, GraduationCap, Layers3, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { getAttemptAnswers, listAttemptsByTest } from '@/api/attempts'
import { listClasses } from '@/api/classes'
import { listStudentsByClass } from '@/api/students'
import { listSubjects } from '@/api/subjects'
import { listTests } from '@/api/tests'
import { listTeachers } from '@/api/users'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Attempt, AttemptAnswer, Test } from '@/lib/types'
import { formatDate } from '@/lib/utils'

type AttemptContext = {
  attempt: Attempt
  test: Test
  rawScore: number
  pctScore: number | null
}

type AggregateRow = {
  id: string
  name: string
  attempts: number
  testsCount: number
  avgPct: number
}

type StudentRow = {
  studentId: string
  studentName: string
  className: string
  attempts: number
  testsCount: number
  avgPct: number
  latestDate: string | null
}

type TestCoverageRow = {
  id: string
  title: string
  teacherName: string
  className: string
  subjectName: string
  date: string | null
  totalMarks: number
  attemptsCount: number
  avgPct: number | null
  status: 'pending_marking' | 'missing_total_marks' | 'recorded'
}

function toPercent(score: number, totalMarks: number) {
  if (!Number.isFinite(score) || !Number.isFinite(totalMarks) || totalMarks <= 0) return null
  return Number(((score / totalMarks) * 100).toFixed(2))
}

function truncateLabel(value: string, max = 22) {
  if (value.length <= max) return value
  return `${value.slice(0, max).trimEnd()}...`
}

function scoreDistribution(values: number[]) {
  const buckets = [
    { bucket: '0-19%', count: 0 },
    { bucket: '20-39%', count: 0 },
    { bucket: '40-59%', count: 0 },
    { bucket: '60-79%', count: 0 },
    { bucket: '80%+', count: 0 },
  ]

  for (const score of values) {
    if (score < 20) buckets[0].count += 1
    else if (score < 40) buckets[1].count += 1
    else if (score < 60) buckets[2].count += 1
    else if (score < 80) buckets[3].count += 1
    else buckets[4].count += 1
  }

  return buckets
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n')
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function aggregateRows(rows: AttemptContext[], getKey: (row: AttemptContext) => { id: string; name: string }) {
  const map = new Map<string, { id: string; name: string; attempts: number; tests: Set<string>; pct: number[] }>()

  for (const row of rows) {
    if (row.pctScore == null) continue
    const key = getKey(row)
    const current = map.get(key.id) ?? { id: key.id, name: key.name, attempts: 0, tests: new Set<string>(), pct: [] as number[] }
    current.attempts += 1
    current.tests.add(row.test.id)
    current.pct.push(row.pctScore)
    map.set(key.id, current)
  }

  return Array.from(map.values())
    .map(
      (row): AggregateRow => ({
        id: row.id,
        name: row.name,
        attempts: row.attempts,
        testsCount: row.tests.size,
        avgPct: row.pct.length ? Number((row.pct.reduce((sum, value) => sum + value, 0) / row.pct.length).toFixed(2)) : 0,
      }),
    )
    .sort((a, b) => a.avgPct - b.avgPct || a.name.localeCompare(b.name))
}

export default function AdminAnalyticsPage() {
  const [teacherIdFilter, setTeacherIdFilter] = useState('')
  const [classIdFilter, setClassIdFilter] = useState('')
  const [subjectIdFilter, setSubjectIdFilter] = useState('')
  const [termFilter, setTermFilter] = useState('')

  const testsQuery = useQuery({ queryKey: ['tests', 'school', 'admin-analytics'], queryFn: listTests })
  const teachersQuery = useQuery({ queryKey: ['teachers', 'school'], queryFn: listTeachers })
  const classesQuery = useQuery({ queryKey: ['classes', 'school'], queryFn: listClasses })
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'school'], queryFn: listSubjects })
  const studentsQuery = useQuery({ queryKey: ['students', 'school'], queryFn: () => listStudentsByClass() })

  const tests = testsQuery.data ?? []
  const teachers = teachersQuery.data ?? []
  const classes = classesQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const students = studentsQuery.data ?? []

  const teacherNameById = useMemo(
    () => new Map((teachersQuery.data ?? []).map((teacher) => [teacher.id, teacher.full_name])),
    [teachersQuery.data],
  )
  const classNameById = useMemo(
    () => new Map((classesQuery.data ?? []).map((classroom) => [classroom.id, classroom.name])),
    [classesQuery.data],
  )
  const subjectNameById = useMemo(
    () => new Map((subjectsQuery.data ?? []).map((subject) => [subject.id, subject.name])),
    [subjectsQuery.data],
  )
  const studentById = useMemo(
    () => new Map((studentsQuery.data ?? []).map((student) => [student.id, student])),
    [studentsQuery.data],
  )

  const terms = useMemo(
    () =>
          Array.from(
            new Set((testsQuery.data ?? []).map((test) => (test.term ?? '').trim()).filter((term) => term.length > 0)),
          ).sort((a, b) => a.localeCompare(b)),
    [testsQuery.data],
  )

  const filteredTests = useMemo(
    () =>
      (testsQuery.data ?? []).filter((test) => {
        if (teacherIdFilter && test.teacher_id !== teacherIdFilter) return false
        if (classIdFilter && test.class_id !== classIdFilter) return false
        if (subjectIdFilter && test.subject_id !== subjectIdFilter) return false
        if (termFilter && (test.term ?? '') !== termFilter) return false
        return true
      }),
    [testsQuery.data, teacherIdFilter, classIdFilter, subjectIdFilter, termFilter],
  )

  const attemptsByTestQuery = useQuery({
    queryKey: ['admin-analytics-attempts', filteredTests.map((test) => test.id)],
    enabled: filteredTests.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        filteredTests.map(async (test) => [test.id, await listAttemptsByTest(test.id)] as const),
      )
      return Object.fromEntries(pairs) as Record<string, Attempt[]>
    },
  })

  const filteredAttempts = useMemo(
    () => filteredTests.flatMap((test) => attemptsByTestQuery.data?.[test.id] ?? []),
    [filteredTests, attemptsByTestQuery.data],
  )

  const attemptIdsWithAnswers = useMemo(
    () => filteredAttempts.filter((attempt) => (attempt.attempt_answers?.length ?? 0) > 0).map((attempt) => attempt.id),
    [filteredAttempts],
  )

  const answerDetailsQuery = useQuery({
    queryKey: ['admin-analytics-answer-details', attemptIdsWithAnswers],
    enabled: attemptIdsWithAnswers.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        attemptIdsWithAnswers.map(async (attemptId) => [attemptId, await getAttemptAnswers(attemptId)] as const),
      )
      return Object.fromEntries(pairs) as Record<string, AttemptAnswer[]>
    },
  })

  const isLoading =
    testsQuery.isLoading ||
    teachersQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    studentsQuery.isLoading ||
    (filteredTests.length > 0 && attemptsByTestQuery.isLoading) ||
    answerDetailsQuery.isLoading

  if (isLoading) return <LoadingState label='Loading school analytics...' />

  if (
    testsQuery.isError ||
    teachersQuery.isError ||
    classesQuery.isError ||
    subjectsQuery.isError ||
    studentsQuery.isError ||
    attemptsByTestQuery.isError
  ) {
    return <EmptyState title='Analytics unavailable' description='Could not load school analytics. Try again shortly.' />
  }

  const filteredTestMap = new Map(filteredTests.map((test) => [test.id, test]))

  const attemptContexts: AttemptContext[] = filteredAttempts
    .map((attempt) => {
      const test = filteredTestMap.get(attempt.test_id)
      if (!test) return null
      const rawScore = Number(attempt.total_score ?? 0)
      return {
        attempt,
        test,
        rawScore,
        pctScore: toPercent(rawScore, Number(test.total_marks ?? 0)),
      }
    })
    .filter((row): row is AttemptContext => Boolean(row))

  const normalizedAttempts = attemptContexts.filter((row) => row.pctScore != null)
  const normalizedScores = normalizedAttempts.map((row) => row.pctScore ?? 0)
  const testsWithoutMarks = filteredTests.filter((test) => (attemptsByTestQuery.data?.[test.id]?.length ?? 0) === 0)

  const schoolAvgPct =
    normalizedScores.length > 0
      ? Number((normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length).toFixed(2))
      : null

  const scoreTrendData = filteredTests
    .map((test) => {
      const rows = attemptContexts.filter((row) => row.test.id === test.id && row.pctScore != null)
      if (!rows.length) return null
      return {
        id: test.id,
        label: test.title,
        shortLabel: truncateLabel(test.title),
        date: test.date,
        avgPct: Number((rows.reduce((sum, row) => sum + (row.pctScore ?? 0), 0) / rows.length).toFixed(2)),
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  const distributionData = scoreDistribution(normalizedScores)

  const classPerformance = aggregateRows(attemptContexts, (row) => ({
    id: row.test.class_id,
    name: row.test.classroom?.name ?? classNameById.get(row.test.class_id) ?? 'Class',
  }))

  const subjectPerformance = aggregateRows(attemptContexts, (row) => ({
    id: row.test.subject_id,
    name: row.test.subject?.name ?? subjectNameById.get(row.test.subject_id) ?? 'Subject',
  }))

  const teacherPerformance = aggregateRows(attemptContexts, (row) => ({
    id: row.test.teacher_id,
    name: teacherNameById.get(row.test.teacher_id) ?? 'Teacher',
  }))

  const studentPerformance: StudentRow[] = Array.from(
    attemptContexts.reduce((map, row) => {
      if (row.pctScore == null) return map
      const student = row.attempt.student ?? studentById.get(row.attempt.student_id)
      const key = row.attempt.student_id
      const current =
        map.get(key) ??
        {
          studentId: key,
          studentName: student?.full_name ?? 'Student',
          className: student?.classroom?.name ?? row.test.classroom?.name ?? 'Class',
          attempts: 0,
          tests: new Set<string>(),
          pct: [] as number[],
          latestDate: row.test.date ?? row.attempt.submitted_at ?? null,
        }

      current.attempts += 1
      current.tests.add(row.test.id)
      current.pct.push(row.pctScore)
      const candidateDate = row.test.date ?? row.attempt.submitted_at ?? null
      if ((candidateDate ?? '') > (current.latestDate ?? '')) current.latestDate = candidateDate
      map.set(key, current)
      return map
    }, new Map<string, { studentId: string; studentName: string; className: string; attempts: number; tests: Set<string>; pct: number[]; latestDate: string | null }>()).values(),
  )
    .map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName,
      className: row.className,
      attempts: row.attempts,
      testsCount: row.tests.size,
      avgPct: row.pct.length ? Number((row.pct.reduce((sum, value) => sum + value, 0) / row.pct.length).toFixed(2)) : 0,
      latestDate: row.latestDate,
    }))
    .sort((a, b) => a.avgPct - b.avgPct || a.studentName.localeCompare(b.studentName))

  const topStudents = [...studentPerformance].sort((a, b) => b.avgPct - a.avgPct).slice(0, 10)
  const supportStudents = studentPerformance.slice(0, 10)

  const testCoverageRows: TestCoverageRow[] = filteredTests
    .map((test) => {
      const attempts = attemptsByTestQuery.data?.[test.id] ?? []
      const normalized = attemptContexts.filter((row) => row.test.id === test.id && row.pctScore != null)
      const avgPct =
        normalized.length > 0
          ? Number((normalized.reduce((sum, row) => sum + (row.pctScore ?? 0), 0) / normalized.length).toFixed(2))
          : null

      let status: TestCoverageRow['status'] = 'recorded'
      if (!attempts.length) status = 'pending_marking'
      else if (Number(test.total_marks ?? 0) <= 0) status = 'missing_total_marks'

      return {
        id: test.id,
        title: test.title,
        teacherName: teacherNameById.get(test.teacher_id) ?? 'Teacher',
        className: test.classroom?.name ?? classNameById.get(test.class_id) ?? 'Class',
        subjectName: test.subject?.name ?? subjectNameById.get(test.subject_id) ?? 'Subject',
        date: test.date,
        totalMarks: Number(test.total_marks ?? 0),
        attemptsCount: attempts.length,
        avgPct,
        status,
      }
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title))

  const weakestTopics = (() => {
    const topicMap = new Map<string, { topicId: string; topicTitle: string; correct: number; total: number; pct: number }>()
    for (const attemptId of attemptIdsWithAnswers) {
      const rows = answerDetailsQuery.data?.[attemptId] ?? []
      for (const answer of rows) {
        const topicId = answer.question?.topic_id ?? answer.question?.topic?.id
        if (!topicId) continue
        const current =
          topicMap.get(topicId) ??
          { topicId, topicTitle: answer.question?.topic?.title ?? 'Untitled topic', correct: 0, total: 0, pct: 0 }
        current.total += 1
        if (answer.is_correct) current.correct += 1
        topicMap.set(topicId, current)
      }
    }
    return Array.from(topicMap.values())
      .map((row) => ({ ...row, pct: row.total ? Number(((row.correct / row.total) * 100).toFixed(2)) : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10)
  })()

  const hasTests = tests.length > 0
  const hasTestsInScope = filteredTests.length > 0
  const hasRecordedMarks = filteredAttempts.length > 0
  const attemptsWithAnswerLevel = filteredAttempts.filter((attempt) => (attempt.attempt_answers?.length ?? 0) > 0).length
  const answerLevelCoveragePct = filteredAttempts.length
    ? Number(((attemptsWithAnswerLevel / filteredAttempts.length) * 100).toFixed(1))
    : 0
  const uniqueStudentsAssessed = new Set(filteredAttempts.map((attempt) => attempt.student_id)).size

  const downloadStudentReport = () =>
    downloadCsv(
      'admin-student-performance-report.csv',
      studentPerformance.map((row) => ({
        student_name: row.studentName,
        class_name: row.className,
        average_percent: row.avgPct,
        attempts: row.attempts,
        tests_count: row.testsCount,
        latest_date: row.latestDate ?? '',
      })),
    )

  const downloadCoverageReport = () =>
    downloadCsv(
      'admin-test-coverage-report.csv',
      testCoverageRows.map((row) => ({
        test_title: row.title,
        teacher_name: row.teacherName,
        class_name: row.className,
        subject_name: row.subjectName,
        date: row.date ?? '',
        total_marks: row.totalMarks,
        scripts_recorded: row.attemptsCount,
        average_percent: row.avgPct ?? '',
        status: row.status,
      })),
    )

  return (
    <div className='space-y-6'>
      <PageHeader
        title='School Analytics'
        description='Principal/headmaster view of school-wide performance, marking coverage, and intervention priorities from recorded paper exams.'
      />

      {!hasTests ? (
        <EmptyState
          title='No tests created yet'
          description='Teachers need to create tests and record paper-marking scores before school analytics can appear.'
        />
      ) : (
        <>
          <Card className='rounded-3xl border-none shadow-sm'>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Review all data or narrow by teacher, class, subject, and term.</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
              <Select value={teacherIdFilter || '__all__'} onValueChange={(value) => setTeacherIdFilter(value === '__all__' ? '' : value)}>
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='All teachers' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All teachers</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={classIdFilter || '__all__'} onValueChange={(value) => setClassIdFilter(value === '__all__' ? '' : value)}>
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='All classes' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All classes</SelectItem>
                  {classes.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={subjectIdFilter || '__all__'}
                onValueChange={(value) => setSubjectIdFilter(value === '__all__' ? '' : value)}
              >
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='All subjects' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={termFilter || '__all__'} onValueChange={(value) => setTermFilter(value === '__all__' ? '' : value)}>
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='All terms' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>All terms</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term} value={term}>
                      {term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {!hasTestsInScope ? (
            <EmptyState title='No tests match the current filters' description='Clear or change filters to see analytics data.' />
          ) : (
            <>
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                <StatCard
                  label='Tests In Scope'
                  value={filteredTests.length}
                  description={`${testsWithoutMarks.length} pending marking`}
                  icon={ClipboardCheck}
                />
                <StatCard
                  label='Recorded Scripts'
                  value={filteredAttempts.length}
                  description={`${uniqueStudentsAssessed} unique students assessed`}
                  icon={GraduationCap}
                />
                <StatCard
                  label='Average Performance'
                  value={schoolAvgPct == null ? '-' : `${schoolAvgPct}%`}
                  description='Normalized by each test total marks'
                  icon={BarChart3}
                />
                <StatCard
                  label='Teachers In Scope'
                  value={new Set(filteredTests.map((test) => test.teacher_id)).size}
                  description='Teachers with tests in current scope'
                  icon={Users}
                />
                <StatCard
                  label='Classes Covered'
                  value={new Set(filteredTests.map((test) => test.class_id)).size}
                  description='Classes represented in current scope'
                  icon={Layers3}
                />
                <StatCard
                  label='Answer-Level Coverage'
                  value={`${answerLevelCoveragePct}%`}
                  description={`${attemptsWithAnswerLevel}/${filteredAttempts.length} attempts include answer details`}
                  icon={BookOpen}
                />
              </div>

              {!hasRecordedMarks ? (
                <EmptyState
                  title='No recorded marks yet in this scope'
                  description='Teachers have tests, but no scores have been recorded yet for the selected filters.'
                />
              ) : (
                <>
                  <div className='grid gap-6 xl:grid-cols-2'>
                    <Card className='rounded-3xl border-none shadow-sm'>
                      <CardHeader>
                        <CardTitle>School Score Trend</CardTitle>
                        <CardDescription>Average score percent per test (normalized by test total marks).</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {scoreTrendData.length ? (
                          <div className='h-80'>
                            <ResponsiveContainer width='100%' height='100%'>
                              <LineChart data={scoreTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                                <CartesianGrid strokeDasharray='3 3' />
                                <XAxis dataKey='shortLabel' angle={-20} textAnchor='end' height={55} />
                                <YAxis domain={[0, 100]} />
                                <Tooltip formatter={(value) => [`${value ?? 0}%`, 'Average']} />
                                <Line type='monotone' dataKey='avgPct' stroke='hsl(var(--primary))' strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className='text-sm text-muted-foreground'>Trend data appears after tests have marks and total marks.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className='rounded-3xl border-none shadow-sm'>
                      <CardHeader>
                        <CardTitle>Score Distribution</CardTitle>
                        <CardDescription>Distribution of normalized student scores (%) across recorded attempts.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className='h-80'>
                          <ResponsiveContainer width='100%' height='100%'>
                            <BarChart data={distributionData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray='3 3' />
                              <XAxis dataKey='bucket' />
                              <YAxis allowDecimals={false} />
                              <Tooltip formatter={(value) => [`${value ?? 0}`, 'Attempts']} />
                              <Bar dataKey='count' fill='hsl(var(--primary))' radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className='grid gap-6 xl:grid-cols-3'>
                    <Card className='rounded-3xl border-none shadow-sm'>
                      <CardHeader>
                        <CardTitle>Class Performance</CardTitle>
                        <CardDescription>Lowest average classes first (priority for intervention).</CardDescription>
                      </CardHeader>
                      <CardContent className='p-0'>
                        {!classPerformance.length ? (
                          <div className='p-6 text-sm text-muted-foreground'>No class performance data yet.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Class</TableHead>
                                <TableHead className='w-24'>Avg %</TableHead>
                                <TableHead className='w-24'>Attempts</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {classPerformance.slice(0, 10).map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className='font-medium'>{row.name}</TableCell>
                                  <TableCell>{row.avgPct}%</TableCell>
                                  <TableCell>{row.attempts}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card className='rounded-3xl border-none shadow-sm'>
                      <CardHeader>
                        <CardTitle>Subject Performance</CardTitle>
                        <CardDescription>Subjects with the lowest average scores appear first.</CardDescription>
                      </CardHeader>
                      <CardContent className='p-0'>
                        {!subjectPerformance.length ? (
                          <div className='p-6 text-sm text-muted-foreground'>No subject performance data yet.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead className='w-24'>Avg %</TableHead>
                                <TableHead className='w-24'>Attempts</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subjectPerformance.slice(0, 10).map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className='font-medium'>{row.name}</TableCell>
                                  <TableCell>{row.avgPct}%</TableCell>
                                  <TableCell>{row.attempts}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <Card className='rounded-3xl border-none shadow-sm'>
                      <CardHeader>
                        <CardTitle>Teacher Performance</CardTitle>
                        <CardDescription>Average outcomes by teacher in the current scope.</CardDescription>
                      </CardHeader>
                      <CardContent className='p-0'>
                        {!teacherPerformance.length ? (
                          <div className='p-6 text-sm text-muted-foreground'>No teacher performance data yet.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Teacher</TableHead>
                                <TableHead className='w-24'>Avg %</TableHead>
                                <TableHead className='w-20'>Tests</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {teacherPerformance.slice(0, 10).map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className='font-medium'>{row.name}</TableCell>
                                  <TableCell>{row.avgPct}%</TableCell>
                                  <TableCell>{row.testsCount}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className='rounded-3xl border-none shadow-sm'>
                    <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                      <div>
                        <CardTitle>Student Performance Report</CardTitle>
                        <CardDescription>
                          Student averages across recorded paper-marked tests (normalized to percent).
                        </CardDescription>
                      </div>
                      <Button
                        variant='outline'
                        className='rounded-xl'
                        onClick={downloadStudentReport}
                        disabled={!studentPerformance.length}
                      >
                        <FileDown className='mr-2 h-4 w-4' />
                        Download CSV
                      </Button>
                    </CardHeader>
                    <CardContent className='space-y-6'>
                      <div className='grid gap-6 xl:grid-cols-2'>
                        <div>
                          <h3 className='mb-3 text-sm font-semibold'>Students Needing Support</h3>
                          {!supportStudents.length ? (
                            <p className='text-sm text-muted-foreground'>No student score records available.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead>Class</TableHead>
                                  <TableHead className='w-24'>Avg %</TableHead>
                                  <TableHead className='w-20'>Tests</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {supportStudents.map((row) => (
                                  <TableRow key={row.studentId}>
                                    <TableCell className='font-medium'>{row.studentName}</TableCell>
                                    <TableCell>{row.className}</TableCell>
                                    <TableCell>{row.avgPct}%</TableCell>
                                    <TableCell>{row.testsCount}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>

                        <div>
                          <h3 className='mb-3 text-sm font-semibold'>Top Students</h3>
                          {!topStudents.length ? (
                            <p className='text-sm text-muted-foreground'>No student score records available.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead>Class</TableHead>
                                  <TableHead className='w-24'>Avg %</TableHead>
                                  <TableHead className='w-20'>Tests</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {topStudents.map((row) => (
                                  <TableRow key={row.studentId}>
                                    <TableCell className='font-medium'>{row.studentName}</TableCell>
                                    <TableCell>{row.className}</TableCell>
                                    <TableCell>{row.avgPct}%</TableCell>
                                    <TableCell>{row.testsCount}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className='mb-3 text-sm font-semibold'>All Students (first 20 rows)</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead className='w-24'>Avg %</TableHead>
                              <TableHead className='w-20'>Tests</TableHead>
                              <TableHead className='w-20'>Attempts</TableHead>
                              <TableHead className='w-36'>Latest</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentPerformance.slice(0, 20).map((row) => (
                              <TableRow key={row.studentId}>
                                <TableCell className='font-medium'>{row.studentName}</TableCell>
                                <TableCell>{row.className}</TableCell>
                                <TableCell>{row.avgPct}%</TableCell>
                                <TableCell>{row.testsCount}</TableCell>
                                <TableCell>{row.attempts}</TableCell>
                                <TableCell>{formatDate(row.latestDate)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {studentPerformance.length > 20 ? (
                          <p className='mt-2 text-xs text-muted-foreground'>
                            Showing first 20 rows. Use CSV export for the full report.
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  <div className='grid gap-6 xl:grid-cols-3'>
                    <Card className='rounded-3xl border-none shadow-sm xl:col-span-2'>
                      <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                          <CardTitle>Marking Coverage Report</CardTitle>
                          <CardDescription>
                            Tracks tests waiting for marks, missing test totals, and recorded coverage.
                          </CardDescription>
                        </div>
                        <Button
                          variant='outline'
                          className='rounded-xl'
                          onClick={downloadCoverageReport}
                          disabled={!testCoverageRows.length}
                        >
                          <FileDown className='mr-2 h-4 w-4' />
                          Download CSV
                        </Button>
                      </CardHeader>
                      <CardContent className='p-0'>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Test</TableHead>
                              <TableHead>Teacher</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead className='w-20'>Marks</TableHead>
                              <TableHead className='w-20'>Scripts</TableHead>
                              <TableHead className='w-24'>Avg %</TableHead>
                              <TableHead className='w-40'>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {testCoverageRows.slice(0, 15).map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <div className='font-medium'>{row.title}</div>
                                  <div className='text-xs text-muted-foreground'>{formatDate(row.date)}</div>
                                </TableCell>
                                <TableCell>{row.teacherName}</TableCell>
                                <TableCell>{row.className}</TableCell>
                                <TableCell>{row.subjectName}</TableCell>
                                <TableCell>{row.totalMarks}</TableCell>
                                <TableCell>{row.attemptsCount}</TableCell>
                                <TableCell>{row.avgPct == null ? '-' : `${row.avgPct}%`}</TableCell>
                                <TableCell>
                                  {row.status === 'pending_marking' ? (
                                    <Badge variant='destructive'>Pending marking</Badge>
                                  ) : row.status === 'missing_total_marks' ? (
                                    <Badge variant='secondary'>Missing total marks</Badge>
                                  ) : (
                                    <Badge variant='outline'>Recorded</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {testCoverageRows.length > 15 ? (
                          <p className='px-6 py-3 text-xs text-muted-foreground'>
                            Showing first 15 rows. Use CSV export for the full coverage report.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className='rounded-3xl border-none shadow-sm'>
                      <CardHeader>
                        <CardTitle>Headmaster Highlights</CardTitle>
                        <CardDescription>Quick signals for action and follow-up.</CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4 text-sm'>
                        <div className='rounded-2xl border p-4'>
                          <div className='mb-2 flex items-center gap-2 font-medium'>
                            <AlertTriangle className='h-4 w-4 text-amber-600' />
                            Marking backlog
                          </div>
                          <p className='text-muted-foreground'>
                            {testsWithoutMarks.length} of {filteredTests.length} tests have no recorded scores yet.
                          </p>
                        </div>

                        <div className='rounded-2xl border p-4'>
                          <div className='mb-2 flex items-center gap-2 font-medium'>
                            <BarChart3 className='h-4 w-4 text-primary' />
                            Performance watch
                          </div>
                          <p className='text-muted-foreground'>
                            {classPerformance.filter((row) => row.avgPct < 40).length} classes and{' '}
                            {subjectPerformance.filter((row) => row.avgPct < 40).length} subjects are below 40% average.
                          </p>
                        </div>

                        <div className='rounded-2xl border p-4'>
                          <div className='mb-2 flex items-center gap-2 font-medium'>
                            <BookOpen className='h-4 w-4 text-emerald-600' />
                            Topic insight coverage
                          </div>
                          <p className='text-muted-foreground'>
                            {attemptsWithAnswerLevel} attempts include answer details ({answerLevelCoveragePct}%).
                          </p>
                        </div>

                        <div className='rounded-2xl border p-4'>
                          <div className='mb-2 flex items-center gap-2 font-medium'>
                            <Users className='h-4 w-4 text-violet-600' />
                            Assessment reach
                          </div>
                          <p className='text-muted-foreground'>
                            {uniqueStudentsAssessed} of {students.length} students have recorded scores in this scope.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className='rounded-3xl border-none shadow-sm'>
                    <CardHeader>
                      <CardTitle>Weakest Topics (School-wide)</CardTitle>
                      <CardDescription>
                        Requires answer-level capture in Marking. Total-score-only entries do not populate topic analytics.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {answerDetailsQuery.isError ? (
                        <EmptyState
                          title='Topic analytics unavailable'
                          description='Answer-level details could not be loaded. Other analytics remain available.'
                        />
                      ) : !weakestTopics.length ? (
                        <EmptyState
                          title='No answer-level topic data yet'
                          description='Teachers can save optional answer details in Marking to unlock topic-level insights.'
                        />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Topic</TableHead>
                              <TableHead className='w-24'>Correct</TableHead>
                              <TableHead className='w-24'>Total</TableHead>
                              <TableHead className='w-28'>% Correct</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {weakestTopics.map((topic) => (
                              <TableRow key={topic.topicId}>
                                <TableCell className='font-medium'>{topic.topicTitle}</TableCell>
                                <TableCell>{topic.correct}</TableCell>
                                <TableCell>{topic.total}</TableCell>
                                <TableCell>{topic.pct}%</TableCell>
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
        </>
      )}
    </div>
  )
}
