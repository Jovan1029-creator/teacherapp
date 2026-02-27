import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pencil, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createExamTimetableEntry,
  deleteExamTimetableEntry,
  listSchoolExamTimetable,
  updateExamTimetableEntry,
} from '@/api/examTimetable'
import { listAssignments } from '@/api/teacherSubjects'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ExamTimetableEntry, TeacherSubject } from '@/lib/types'
import { printExamTimetable } from '@/print/examTimetable'

interface TimetableFormValues {
  class_id: string
  assignment_id: string
  title: string
  term: string
  starts_at_local: string
  duration_minutes: string
  venue: string
  notes: string
}

const EMPTY_FORM: TimetableFormValues = {
  class_id: '',
  assignment_id: '',
  title: '',
  term: '',
  starts_at_local: '',
  duration_minutes: '60',
  venue: '',
  notes: '',
}

const EMPTY_TIMETABLE_ENTRIES: ExamTimetableEntry[] = []
const EMPTY_ASSIGNMENTS: TeacherSubject[] = []

function toLocalDateTimeInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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

export default function AdminExamTimetablePage() {
  const queryClient = useQueryClient()
  const [nowMs] = useState(() => Date.now())

  const timetableQuery = useQuery({
    queryKey: ['exam-timetable', 'school'],
    queryFn: listSchoolExamTimetable,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['assignments'],
    queryFn: listAssignments,
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ExamTimetableEntry | null>(null)
  const [deleting, setDeleting] = useState<ExamTimetableEntry | null>(null)
  const [classFilterIdState, setClassFilterIdState] = useState('')
  const [form, setForm] = useState<TimetableFormValues>(EMPTY_FORM)

  const assignments = assignmentsQuery.data ?? EMPTY_ASSIGNMENTS
  const entries = timetableQuery.data ?? EMPTY_TIMETABLE_ENTRIES

  const classOptions = useMemo(
    () =>
      Array.from(
        new Map(assignments.map((a) => [a.class_id, a.classroom?.name?.trim() || 'Class'])).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [assignments],
  )

  const classFilterId = classOptions.some((option) => option.value === classFilterIdState)
    ? classFilterIdState
    : (classOptions[0]?.value ?? '')

  const assignmentOptionsForFormClass = useMemo(() => {
    if (!form.class_id) return [] as TeacherSubject[]
    return assignments
      .filter((assignment) => assignment.class_id === form.class_id)
      .sort((a, b) => {
        const subjectCmp = (a.subject?.name ?? '').localeCompare(b.subject?.name ?? '')
        if (subjectCmp !== 0) return subjectCmp
        return (a.teacher?.full_name ?? '').localeCompare(b.teacher?.full_name ?? '')
      })
  }, [assignments, form.class_id])

  const selectedAssignment = useMemo(
    () => assignmentOptionsForFormClass.find((assignment) => assignment.id === form.assignment_id) ?? null,
    [assignmentOptionsForFormClass, form.assignment_id],
  )

  const filteredEntries = useMemo(
    () =>
      classFilterId
        ? entries.filter((entry) => entry.class_id === classFilterId)
        : entries,
    [classFilterId, entries],
  )

  const selectedClassName = useMemo(
    () => classOptions.find((option) => option.value === classFilterId)?.label ?? 'Selected class',
    [classFilterId, classOptions],
  )

  const summaries = useMemo(() => {
    let upcoming = 0
    let today = 0
    const startToday = (() => {
      const now = new Date(nowMs)
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    })()
    const endToday = startToday + 24 * 60 * 60 * 1000

    for (const entry of filteredEntries) {
      const start = new Date(entry.starts_at).getTime()
      if (Number.isNaN(start)) continue
      if (start >= nowMs) upcoming += 1
      if (start >= startToday && start < endToday) today += 1
    }

    return {
      total: filteredEntries.length,
      upcoming,
      today,
      subjects: new Set(filteredEntries.map((entry) => entry.subject_id)).size,
    }
  }, [filteredEntries, nowMs])

  const createMutation = useMutation({
    mutationFn: createExamTimetableEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
      toast.success('Timetable entry added')
      setOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateExamTimetableEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
      toast.success('Timetable entry updated')
      setOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteExamTimetableEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
      toast.success('Timetable entry removed')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openCreateDialog = () => {
    setEditing(null)
    setForm((prev) => ({
      ...EMPTY_FORM,
      class_id: classFilterId || prev.class_id || classOptions[0]?.value || '',
    }))
    setOpen(true)
  }

  const openEditDialog = (entry: ExamTimetableEntry) => {
    const matchedAssignment = assignments.find(
      (assignment) =>
        assignment.class_id === entry.class_id &&
        assignment.subject_id === entry.subject_id &&
        assignment.teacher_id === entry.teacher_id,
    )

    setEditing(entry)
    setForm({
      class_id: entry.class_id,
      assignment_id: matchedAssignment?.id ?? '',
      title: entry.title,
      term: entry.term ?? '',
      starts_at_local: toLocalDateTimeInputValue(entry.starts_at),
      duration_minutes: String(entry.duration_minutes),
      venue: entry.venue ?? '',
      notes: entry.notes ?? '',
    })
    setOpen(true)
  }

  const handleSave = () => {
    if (!form.class_id) {
      toast.error('Select a class')
      return
    }
    if (!form.assignment_id) {
      toast.error('Select a subject/teacher assignment for this class')
      return
    }
    if (form.title.trim().length < 2) {
      toast.error('Enter an exam title')
      return
    }

    const startsAt = new Date(form.starts_at_local)
    if (!form.starts_at_local || Number.isNaN(startsAt.getTime())) {
      toast.error('Choose a valid start date and time')
      return
    }

    const duration = Math.max(1, Number.parseInt(form.duration_minutes || '60', 10) || 60)
    const assignment = assignments.find((row) => row.id === form.assignment_id)
    if (!assignment) {
      toast.error('Selected assignment is no longer available')
      return
    }

    const payload = {
      class_id: assignment.class_id,
      subject_id: assignment.subject_id,
      teacher_id: assignment.teacher_id,
      title: form.title.trim(),
      term: form.term,
      starts_at: startsAt.toISOString(),
      duration_minutes: duration,
      venue: form.venue,
      notes: form.notes,
    }

    if (editing) {
      updateMutation.mutate({ id: editing.id, ...payload })
      return
    }

    createMutation.mutate(payload)
  }

  const subjectFilterOptions = useMemo(
    () =>
      Array.from(
        new Map(filteredEntries.map((entry) => [entry.subject_id, entry.subject?.name?.trim() || 'Subject'])).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [filteredEntries],
  )

  const termFilterOptions = useMemo(
    () =>
      Array.from(new Set(filteredEntries.map((entry) => (entry.term ?? '').trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value })),
    [filteredEntries],
  )

  const columns: DataTableColumn<ExamTimetableEntry>[] = [
      {
        key: 'starts_at',
        header: 'Start',
        render: (row) => (
          <div>
            <p className='font-medium'>{formatDateTime(row.starts_at)}</p>
            <p className='text-xs text-muted-foreground'>{row.duration_minutes} min</p>
          </div>
        ),
      },
      {
        key: 'subject',
        header: 'Subject',
        render: (row) => row.subject?.name ?? '-',
      },
      {
        key: 'title',
        header: 'Exam',
        className: 'min-w-[220px]',
        render: (row) => (
          <div>
            <p className='font-medium'>{row.title}</p>
            <p className='text-xs text-muted-foreground'>
              {row.term ?? '-'} • {examStatus(row, nowMs)}
            </p>
          </div>
        ),
      },
      {
        key: 'teacher',
        header: 'Teacher',
        render: (row) => row.teacher?.full_name ?? '-',
      },
      {
        key: 'venue',
        header: 'Venue',
        render: (row) => row.venue?.trim() || '-',
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[180px]',
        render: (row) => (
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' variant='outline' className='rounded-lg' onClick={() => openEditDialog(row)}>
              <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
            </Button>
            <Button size='sm' variant='destructive' className='rounded-lg' onClick={() => setDeleting(row)}>
              <Trash2 className='mr-1 h-3.5 w-3.5' /> Delete
            </Button>
          </div>
        ),
      },
    ]

  const filters: DataTableFilter<ExamTimetableEntry>[] = [
      {
        id: 'subject',
        label: 'Subject',
        options: subjectFilterOptions,
        getValue: (row) => row.subject_id,
      },
      {
        id: 'term',
        label: 'Term',
        options: termFilterOptions,
        getValue: (row) => row.term ?? '',
      },
    ]

  if (timetableQuery.isLoading || assignmentsQuery.isLoading) {
    return <LoadingState />
  }

  if (timetableQuery.isError || assignmentsQuery.isError) {
    return (
      <EmptyState
        title='Exam timetable unavailable'
        description='Could not load timetable records or teacher assignments. Please try again.'
      />
    )
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Exam Timetable'
        description='Prepare and print class exam timetables. Teachers will only see timetable entries for classes assigned to them.'
        actionLabel='Add timetable entry'
        onAction={openCreateDialog}
      />

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardContent className='grid gap-4 p-6 md:grid-cols-[minmax(220px,320px)_auto_1fr] md:items-end'>
          <div className='space-y-2'>
            <Label>Class timetable</Label>
            <Select value={classFilterId} onValueChange={setClassFilterIdState}>
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
            disabled={!classFilterId || filteredEntries.length === 0}
            onClick={() =>
              printExamTimetable({
                title: `${selectedClassName} Exam Timetable`,
                subtitle: 'Prepared by school administration',
                entries: filteredEntries,
              })
            }
          >
            <Printer className='mr-2 h-4 w-4' /> Print class timetable
          </Button>

          <p className='text-sm text-muted-foreground'>
            Build the official class timetable here. Teachers assigned to this class will see the same timetable in their
            Exam Timetable page.
          </p>
        </CardContent>
      </Card>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Entries (Class)' value={summaries.total} icon={CalendarClock} />
        <StatCard label='Today' value={summaries.today} icon={CalendarClock} />
        <StatCard label='Upcoming' value={summaries.upcoming} icon={CalendarClock} />
        <StatCard label='Subjects Covered' value={summaries.subjects} icon={CalendarClock} />
      </div>

      {!classFilterId ? (
        <EmptyState
          title='Select a class'
          description='Choose a class above to view and print its exam timetable.'
          icon={CalendarClock}
        />
      ) : filteredEntries.length ? (
        <DataTable
          data={filteredEntries}
          columns={columns}
          searchKeys={['title', 'term', 'venue', 'notes']}
          filters={filters}
          pageSize={12}
          emptyMessage='No timetable entries match the current filters.'
        />
      ) : (
        <EmptyState
          title='No timetable entries for this class'
          description='Add timetable entries for this class to make them visible to assigned teachers.'
          actionLabel='Add timetable entry'
          onAction={openCreateDialog}
          icon={CalendarClock}
        />
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setEditing(null)
            setForm(EMPTY_FORM)
          }
        }}
      >
        <DialogContent className='max-w-2xl rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit timetable entry' : 'Add timetable entry'}</DialogTitle>
            <DialogDescription>
              Create the official class exam timetable entry. Teachers assigned to the selected class can view it.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Class</Label>
                <Select
                  value={form.class_id}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      class_id: value,
                      assignment_id: '',
                    }))
                  }
                >
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

              <div className='space-y-2'>
                <Label>Subject / Teacher</Label>
                <Select
                  value={form.assignment_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, assignment_id: value }))}
                  disabled={!form.class_id}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder={form.class_id ? 'Select assigned subject/teacher' : 'Select class first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentOptionsForFormClass.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {(assignment.subject?.name ?? 'Subject') + ' • ' + (assignment.teacher?.full_name ?? 'Teacher')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editing && !selectedAssignment && form.class_id ? (
                  <p className='text-xs text-amber-600'>
                    Re-select an assigned subject/teacher before saving (original assignment was not found).
                  </p>
                ) : null}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='tt-title'>Exam title</Label>
              <Input
                id='tt-title'
                className='rounded-xl'
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder='Example: Midterm English Test'
              />
            </div>

            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='tt-term'>Term (optional)</Label>
                <Input
                  id='tt-term'
                  className='rounded-xl'
                  value={form.term}
                  onChange={(event) => setForm((prev) => ({ ...prev, term: event.target.value }))}
                  placeholder='Term 1'
                />
              </div>
              <div className='space-y-2 md:col-span-2'>
                <Label htmlFor='tt-start'>Start date and time</Label>
                <Input
                  id='tt-start'
                  type='datetime-local'
                  className='rounded-xl'
                  value={form.starts_at_local}
                  onChange={(event) => setForm((prev) => ({ ...prev, starts_at_local: event.target.value }))}
                />
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='tt-duration'>Duration (minutes)</Label>
                <Input
                  id='tt-duration'
                  type='number'
                  min={1}
                  max={600}
                  className='rounded-xl'
                  value={form.duration_minutes}
                  onChange={(event) => setForm((prev) => ({ ...prev, duration_minutes: event.target.value }))}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='tt-venue'>Venue (optional)</Label>
                <Input
                  id='tt-venue'
                  className='rounded-xl'
                  value={form.venue}
                  onChange={(event) => setForm((prev) => ({ ...prev, venue: event.target.value }))}
                  placeholder='Hall / Room 3'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='tt-notes'>Notes (optional)</Label>
              <Textarea
                id='tt-notes'
                rows={3}
                className='rounded-xl'
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder='Invigilation notes or reminders'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              className='rounded-xl'
              onClick={() => {
                setOpen(false)
                setEditing(null)
                setForm(EMPTY_FORM)
              }}
            >
              Cancel
            </Button>
            <Button
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={handleSave}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editing
                  ? 'Save changes'
                  : 'Add to timetable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete timetable entry?'
        description='Teachers will no longer see this exam in the class timetable.'
        confirmLabel='Delete'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
