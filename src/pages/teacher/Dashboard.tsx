// src\pages\teacher\Dashboard.tsx
import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ClipboardCheck, NotebookPen, TestTube } from 'lucide-react'

import { listMyLessonPlans } from '@/api/lessonPlans'
import { listMyQuestions } from '@/api/questions'
import { listMyTests } from '@/api/tests'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

export default function TeacherDashboardPage() {
  const lessonPlansQuery = useQuery({ queryKey: ['lesson-plans', 'mine'], queryFn: listMyLessonPlans })
  const questionsQuery = useQuery({ queryKey: ['questions', 'mine'], queryFn: () => listMyQuestions() })
  const testsQuery = useQuery({ queryKey: ['tests', 'mine'], queryFn: listMyTests })

  const upcomingTests = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10)
    return (testsQuery.data ?? [])
      .filter((test) => test.date && test.date >= now)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .slice(0, 5)
  }, [testsQuery.data])

  if (lessonPlansQuery.isLoading || questionsQuery.isLoading || testsQuery.isLoading) {
    return <LoadingState />
  }

  if (lessonPlansQuery.isError || questionsQuery.isError || testsQuery.isError) {
    return (
      <EmptyState
        title='Dashboard unavailable'
        description='Could not load records. Check your connection and Supabase setup.'
      />
    )
  }

  return (
    <div>
      <PageHeader title='Teacher Dashboard' description='Track your planning, assessments, and marking progress.' />

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Lesson Plans' value={lessonPlansQuery.data?.length ?? 0} icon={NotebookPen} />
        <StatCard label='Question Bank' value={questionsQuery.data?.length ?? 0} icon={BookOpen} />
        <StatCard label='Tests' value={testsQuery.data?.length ?? 0} icon={TestTube} />
        <StatCard label='Ready for Marking' value={testsQuery.data?.length ?? 0} icon={ClipboardCheck} />
      </div>

      <div className='mt-6 grid gap-6 lg:grid-cols-2'>
        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader>
            <CardTitle className='font-heading text-xl'>Upcoming Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTests.length ? (
              <div className='space-y-3'>
                {upcomingTests.map((test) => (
                  <div key={test.id} className='rounded-2xl border p-3'>
                    <p className='font-medium'>{test.title}</p>
                    <p className='text-sm text-muted-foreground'>
                      {test.classroom?.name ?? 'Class'} | {test.subject?.name ?? 'Subject'}
                    </p>
                    <p className='text-xs text-muted-foreground'>Date: {formatDate(test.date)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title='No upcoming tests' description='Create a new test from the Tests page.' />
            )}
          </CardContent>
        </Card>

        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader>
            <CardTitle className='font-heading text-xl'>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-3 sm:grid-cols-2'>
            <Button asChild variant='outline' className='justify-start rounded-xl'>
              <Link to='/teacher/lesson-plans'>Create lesson plan</Link>
            </Button>
            <Button asChild variant='outline' className='justify-start rounded-xl'>
              <Link to='/teacher/question-bank'>Add MCQ question</Link>
            </Button>
            <Button asChild variant='outline' className='justify-start rounded-xl'>
              <Link to='/teacher/tests'>Build new test</Link>
            </Button>
            <Button asChild variant='outline' className='justify-start rounded-xl'>
              <Link to='/teacher/exam-timetable'>View exam timetable</Link>
            </Button>
            <Button asChild variant='outline' className='justify-start rounded-xl'>
              <Link to='/teacher/marking'>Enter marking</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
