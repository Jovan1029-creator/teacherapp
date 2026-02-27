import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CalendarDays, Clock3, Printer } from 'lucide-react'

import { listTeacherClassExamTimetable } from '@/api/examTimetable'
import { listMyAssignments } from '@/api/teacherSubjects'
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ExamTimetableEntry, TeacherSubject } from '@/lib/types'
import { printExamTimetable } from '@/print/examTimetable'

const EMPTY_EXAM_TIMETABLE: ExamTimetableEntry[] = []
const EMPTY_ASSIGNMENTS: TeacherSubject[] = []

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function examStatus(entry: ExamTimetableEntry, nowMs: number) {
  const start = new Date(entry.starts_at).getTime()
  if (Number.isNaN(start)) return 'Unknown'
  const end = start + Math.max(1, entry.duration_minutes) * 60_000
  if (nowMs < start) return 'Upcoming'
  if (nowMs <= end) return 'In progress'
  return 'Completed'
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'In progress') return 'default'
  if (status === 'Upcoming') return 'secondary'
  return 'outline'
}

export default function TeacherExamTimetablePage() {
  const [nowMs] = useState(() => Date.now())
  const [selectedClassIdState, setSelectedClassIdState] = useState('')

  const timetableQuery = useQuery({
    queryKey: ['exam-timetable', 'teacher-classes'],
    queryFn: listTeacherClassExamTimetable,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', 'mine'],
    queryFn: listMyAssignments,
  })

  const entries = timetableQuery.data ?? EMPTY_EXAM_TIMETABLE
  const assignments = assignmentsQuery.data ?? EMPTY_ASSIGNMENTS

  const classOptions = useMemo(
    () =>
      Array.from(
        new Map(assignments.map((assignment) => [assignment.class_id, assignment.classroom?.name ?? 'Class'])).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [assignments],
  )

  const selectedClassId = classOptions.some((option) => option.value === selectedClassIdState)
    ? selectedClassIdState
    : (classOptions[0]?.value ?? '')

  const visibleEntries = useMemo(
    () => (selectedClassId ? entries.filter((entry) => entry.class_id === selectedClassId) : []),
    [entries, selectedClassId],
  )

  const selectedClassName = useMemo(
    () => classOptions.find((option) => option.value === selectedClassId)?.label ?? 'Selected class',
    [classOptions, selectedClassId],
  )

  const summaries = useMemo(() => {
    const now = new Date(nowMs)
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const endToday = startToday + 24 * 60 * 60 * 1000
    const end7Days = startToday + 7 * 24 * 60 * 60 * 1000

    let today = 0
    let next7Days = 0
    let upcoming = 0
    for (const entry of visibleEntries) {
      const start = new Date(entry.starts_at).getTime()
      if (Number.isNaN(start)) continue
      if (start >= startToday && start < endToday) today += 1
      if (start >= nowMs && start < end7Days) next7Days += 1
      if (start >= nowMs) upcoming += 1
    }

    return {
      total: visibleEntries.length,
      today,
      next7Days,
      upcoming,
      subjects: new Set(visibleEntries.map((entry) => entry.subject_id)).size,
    }
  }, [nowMs, visibleEntries])

  const subjectOptions = useMemo(
    () =>
      Array.from(
        new Map(visibleEntries.map((entry) => [entry.subject_id, entry.subject?.name?.trim() || 'Subject'])).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [visibleEntries],
  )

  const teacherOptions = useMemo(
    () =>
      Array.from(
        new Map(
          visibleEntries.map((entry) => [entry.teacher_id, entry.teacher?.full_name?.trim() || 'Teacher']),
        ).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [visibleEntries],
  )

  const termOptions = useMemo(
    () =>
      Array.from(new Set(visibleEntries.map((entry) => (entry.term ?? '').trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [visibleEntries],
  )

  const filters = useMemo<DataTableFilter<ExamTimetableEntry>[]>(
    () => [
      {
        id: 'subject',
        label: 'Subject',
        options: subjectOptions,
        getValue: (row) => row.subject_id,
      },
      {
        id: 'teacher',
        label: 'Teacher',
        options: teacherOptions,
        getValue: (row) => row.teacher_id,
      },
      {
        id: 'term',
        label: 'Term',
        options: termOptions,
        getValue: (row) => row.term ?? '',
      },
    ],
    [subjectOptions, teacherOptions, termOptions],
  )

  const columns = useMemo<DataTableColumn<ExamTimetableEntry>[]>(
    () => [
      {
        key: 'starts_at',
        header: 'Start Time',
        className: 'min-w-[180px]',
        render: (row) => (
          <div>
            <p className='font-medium'>{formatDateTime(row.starts_at)}</p>
            <p className='text-xs text-muted-foreground'>{row.duration_minutes} min</p>
          </div>
        ),
      },
      {
        key: 'exam',
        header: 'Exam',
        className: 'min-w-[240px]',
        render: (row) => {
          const status = examStatus(row, nowMs)
          return (
            <div className='space-y-1'>
              <p className='font-medium'>{row.title}</p>
              <div className='flex flex-wrap items-center gap-2'>
                {row.term ? (
                  <Badge variant='outline' className='rounded-md'>
                    {row.term}
                  </Badge>
                ) : null}
                <Badge variant={statusBadgeVariant(status)} className='rounded-md'>
                  {status}
                </Badge>
              </div>
            </div>
          )
        },
      },
      {
        key: 'subject',
        header: 'Subject',
        render: (row) => row.subject?.name ?? '-',
      },
      {
        key: 'teacher',
        header: 'Teacher',
        render: (row) => row.teacher?.full_name ?? 'Teacher',
      },
      {
        key: 'venue',
        header: 'Venue',
        render: (row) => row.venue?.trim() || '-',
      },
      {
        key: 'notes',
        header: 'Notes',
        className: 'min-w-[220px]',
        render: (row) =>
          row.notes?.trim() ? (
            <p className='max-w-[260px] truncate text-sm text-muted-foreground' title={row.notes}>
              {row.notes}
            </p>
          ) : (
            <span className='text-muted-foreground'>-</span>
          ),
      },
    ],
    [nowMs],
  )

  const upcomingEntries = useMemo(
    () =>
      visibleEntries
        .filter((entry) => new Date(entry.starts_at).getTime() >= nowMs)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 6),
    [nowMs, visibleEntries],
  )

  if (timetableQuery.isLoading || assignmentsQuery.isLoading) {
    return <LoadingState />
  }

  if (timetableQuery.isError || assignmentsQuery.isError) {
    return (
      <EmptyState
        title='Exam timetable unavailable'
        description='Could not load your class timetable. Please try again shortly.'
      />
    )
  }

  if (!classOptions.length) {
    return (
      <EmptyState
        title='No assigned classes'
        description='You do not have class assignments yet, so no class exam timetable can be shown.'
      />
    )
  }

  return (
    <div>
      <PageHeader
        title='Exam Timetable'
        description='View the official exam timetable for classes assigned to you. This timetable is prepared by the school administration.'
      />

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardContent className='grid gap-4 p-6 md:grid-cols-[minmax(220px,320px)_auto_1fr] md:items-end'>
          <div className='space-y-2'>
            <Label>Class timetable</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassIdState}>
              <SelectTrigger className='rounded-xl'>
                <SelectValue placeholder='Select class' />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant='outline'
            className='rounded-xl'
            disabled={!selectedClassId || visibleEntries.length === 0}
            onClick={() =>
              printExamTimetable({
                title: `${selectedClassName} Exam Timetable`,
                subtitle: 'Teacher view (official class timetable)',
                entries: visibleEntries,
              })
            }
          >
            <Printer className='mr-2 h-4 w-4' /> Print class timetable
          </Button>

          <p className='text-sm text-muted-foreground'>
            Teachers only see class timetables for classes assigned to them. Contact the admin if a timetable is missing or needs changes.
          </p>
        </CardContent>
      </Card>

      <div className='mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Entries (Class)' value={summaries.total} icon={CalendarClock} />
        <StatCard label='Today' value={summaries.today} icon={Clock3} />
        <StatCard label='Next 7 Days' value={summaries.next7Days} icon={CalendarDays} />
        <StatCard label='Subjects Scheduled' value={summaries.subjects} icon={CalendarClock} />
      </div>

      <div className='mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]'>
        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader>
            <CardTitle className='font-heading text-xl'>{selectedClassName} Timetable</CardTitle>
          </CardHeader>
          <CardContent>
            {visibleEntries.length ? (
              <DataTable
                data={visibleEntries}
                columns={columns}
                searchKeys={['title', 'term', 'venue', 'notes']}
                filters={filters}
                pageSize={12}
                emptyMessage='No exams match the current filters.'
              />
            ) : (
              <EmptyState
                title='No timetable entries for this class'
                description='The school admin has not yet prepared the exam timetable for this class.'
              />
            )}
          </CardContent>
        </Card>

        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader>
            <CardTitle className='font-heading text-xl'>Upcoming ({selectedClassName})</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEntries.length ? (
              <div className='space-y-3'>
                {upcomingEntries.map((entry) => (
                  <div key={entry.id} className='rounded-2xl border p-3'>
                    <p className='font-medium'>{entry.title}</p>
                    <p className='text-sm text-muted-foreground'>{entry.subject?.name ?? 'Subject'}</p>
                    <p className='text-xs text-muted-foreground'>{formatDateTime(entry.starts_at)}</p>
                    <p className='text-xs text-muted-foreground'>
                      {entry.duration_minutes} min • {entry.teacher?.full_name ?? 'Teacher'}
                      {entry.venue ? ` • ${entry.venue}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title='No upcoming exams'
                description='No future timetable entries are currently scheduled for this class.'
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
