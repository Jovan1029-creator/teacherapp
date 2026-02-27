import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { listStudentsByClass } from '@/api/students'
import { listTestQuestions } from '@/api/testQuestions'
import { getTestById } from '@/api/tests'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDate } from '@/lib/utils'

const optionKeys = ['A', 'B', 'C', 'D'] as const

export default function TeacherTestPrintPage() {
  const { id = '' } = useParams()
  const [showAnswerKey, setShowAnswerKey] = useState(true)
  const [showMarkSheet, setShowMarkSheet] = useState(true)

  const testQuery = useQuery({ queryKey: ['test', id], queryFn: () => getTestById(id), enabled: Boolean(id) })
  const testQuestionsQuery = useQuery({
    queryKey: ['test-questions', id],
    queryFn: () => listTestQuestions(id),
    enabled: Boolean(id),
  })
  const studentsQuery = useQuery({
    queryKey: ['students', 'test-print', testQuery.data?.class_id ?? '__none__'],
    queryFn: () => listStudentsByClass(testQuery.data?.class_id),
    enabled: Boolean(testQuery.data?.class_id),
  })

  const totalMarks = useMemo(
    () => (testQuestionsQuery.data ?? []).reduce((sum, row) => sum + Number(row.marks ?? 0), 0),
    [testQuestionsQuery.data],
  )

  if (testQuery.isLoading || testQuestionsQuery.isLoading || studentsQuery.isLoading) return <LoadingState />

  if (testQuery.isError) {
    return <EmptyState title='Test unavailable' description='The selected test could not be loaded for printing.' />
  }

  if (!testQuery.data) {
    return <EmptyState title='Test not found' description='The selected test does not exist or is inaccessible.' />
  }

  return (
    <div className='space-y-6'>
      <div className='print:hidden'>
        <PageHeader
          title={`Print Pack: ${testQuery.data.title}`}
          description='Generate a paper-first pack: question paper, answer key, and class mark sheet.'
        />

        <Card className='rounded-3xl border-none shadow-sm'>
          <CardContent className='flex flex-wrap items-center justify-between gap-4 p-6'>
            <div className='space-y-2'>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='secondary'>{testQuery.data.classroom?.name ?? 'Class'}</Badge>
                <Badge variant='secondary'>{testQuery.data.subject?.name ?? 'Subject'}</Badge>
                <Badge>{totalMarks} Marks</Badge>
              </div>
              <p className='text-sm text-muted-foreground'>
                Date: {formatDate(testQuery.data.date)} | {testQuestionsQuery.data?.length ?? 0} questions
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-4'>
              <label className='flex items-center gap-2 text-sm'>
                <Checkbox checked={showAnswerKey} onCheckedChange={(checked) => setShowAnswerKey(Boolean(checked))} />
                <span>Include answer key</span>
              </label>
              <label className='flex items-center gap-2 text-sm'>
                <Checkbox checked={showMarkSheet} onCheckedChange={(checked) => setShowMarkSheet(Boolean(checked))} />
                <span>Include mark sheet</span>
              </label>
              <Button className='rounded-xl' onClick={() => window.print()}>
                <Printer className='mr-2 h-4 w-4' />
                Print pack
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className='flex flex-wrap gap-2'>
          <Button asChild variant='outline' className='rounded-xl'>
            <Link to={`/teacher/tests/${id}`}>Back to Builder</Link>
          </Button>
          <Button asChild variant='outline' className='rounded-xl'>
            <Link to={`/teacher/marking?testId=${id}`}>Go to Marking</Link>
          </Button>
        </div>
      </div>

      <div className='space-y-8 print:space-y-6'>
        <section className='rounded-3xl border bg-white p-6 text-black shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none'>
          <div className='space-y-1'>
            <h2 className='text-xl font-semibold'>{testQuery.data.title}</h2>
            <p className='text-sm'>
              Class: {testQuery.data.classroom?.name ?? '-'} | Subject: {testQuery.data.subject?.name ?? '-'}
            </p>
            <p className='text-sm'>
              Term: {testQuery.data.term ?? '-'} | Date: {formatDate(testQuery.data.date)} | Total Marks: {totalMarks}
            </p>
          </div>

          {(testQuestionsQuery.data?.length ?? 0) === 0 ? (
            <div className='mt-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
              This test has no questions yet. Add questions in Test Builder before printing the paper.
            </div>
          ) : (
            <ol className='mt-6 space-y-5'>
              {(testQuestionsQuery.data ?? []).map((row, index) => {
                const question = row.question
                const choices = (question?.choices ?? {}) as Record<string, string>
                return (
                  <li key={row.id} className='rounded-xl border p-4 print:break-inside-avoid'>
                    <div className='mb-3 flex items-start justify-between gap-3'>
                      <p className='font-medium'>
                        {index + 1}. {question?.question_text ?? 'Question'}
                      </p>
                      <span className='text-sm'>{row.marks} marks</span>
                    </div>

                    <div className='grid gap-2 sm:grid-cols-2'>
                      {optionKeys.map((key) => (
                        <div key={key} className='rounded-lg border p-2 text-sm'>
                          <span className='font-semibold'>{key}.</span> {choices[key] ?? '-'}
                        </div>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {showAnswerKey ? (
          <section className='rounded-3xl border bg-white p-6 text-black shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none'>
            <h2 className='text-xl font-semibold'>Answer Key / Marking Scheme</h2>
            <div className='mt-4 overflow-x-auto'>
              <table className='w-full border-collapse text-sm'>
                <thead>
                  <tr>
                    <th className='border border-black px-2 py-2 text-left'>Qn</th>
                    <th className='border border-black px-2 py-2 text-left'>Correct Answer</th>
                    <th className='border border-black px-2 py-2 text-left'>Marks</th>
                    <th className='border border-black px-2 py-2 text-left'>Topic</th>
                  </tr>
                </thead>
                <tbody>
                  {(testQuestionsQuery.data ?? []).map((row, index) => (
                    <tr key={row.id}>
                      <td className='border border-black px-2 py-2'>{index + 1}</td>
                      <td className='border border-black px-2 py-2'>{row.question?.correct_answer ?? '-'}</td>
                      <td className='border border-black px-2 py-2'>{row.marks}</td>
                      <td className='border border-black px-2 py-2'>{row.question?.topic?.title ?? '-'}</td>
                    </tr>
                  ))}
                  {!testQuestionsQuery.data?.length ? (
                    <tr>
                      <td className='border border-black px-2 py-3 text-center' colSpan={4}>
                        No questions added yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {showMarkSheet ? (
          <section className='rounded-3xl border bg-white p-6 text-black shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div>
                <h2 className='text-xl font-semibold'>Class Mark Sheet</h2>
                <p className='text-sm'>
                  {testQuery.data.title} | {testQuery.data.classroom?.name ?? '-'} | Out of {totalMarks}
                </p>
              </div>
              <div className='text-sm'>
                <p>Teacher: ____________________</p>
                <p>Date marked: ________________</p>
              </div>
            </div>

            <div className='mt-4 overflow-x-auto'>
              <table className='w-full border-collapse text-sm'>
                <thead>
                  <tr>
                    <th className='border border-black px-2 py-2 text-left'>#</th>
                    <th className='border border-black px-2 py-2 text-left'>Admission No</th>
                    <th className='border border-black px-2 py-2 text-left'>Student Name</th>
                    <th className='border border-black px-2 py-2 text-left'>Score</th>
                    <th className='border border-black px-2 py-2 text-left'>Out Of</th>
                    <th className='border border-black px-2 py-2 text-left'>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(studentsQuery.data ?? []).map((student, index) => (
                    <tr key={student.id}>
                      <td className='border border-black px-2 py-2'>{index + 1}</td>
                      <td className='border border-black px-2 py-2'>{student.admission_no ?? '-'}</td>
                      <td className='border border-black px-2 py-2'>{student.full_name}</td>
                      <td className='border border-black px-2 py-2'>{' '.repeat(16)}</td>
                      <td className='border border-black px-2 py-2'>{totalMarks}</td>
                      <td className='border border-black px-2 py-2'>{' '.repeat(24)}</td>
                    </tr>
                  ))}
                  {!studentsQuery.data?.length ? (
                    <tr>
                      <td className='border border-black px-2 py-3 text-center' colSpan={6}>
                        No students found in this class yet. Add students to print a filled roster mark sheet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
