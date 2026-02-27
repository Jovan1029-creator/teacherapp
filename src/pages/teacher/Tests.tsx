// src\pages\teacher\Tests.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Clock3, Pencil, Printer, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'

import { listClasses } from '@/api/classes'
import { listMyExamTimetableEntries, removeExamTimetableForTest, upsertExamTimetableForTest } from '@/api/examTimetable'
import { listMyAssignedSubjects } from '@/api/subjects'
import { createTest, deleteTest, listMyTests, updateTest } from '@/api/tests'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Test } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  class_id: z.string().min(1, 'Class is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  title: z.string().min(2, 'Title is required'),
  term: z.string().optional(),
  date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const EMPTY_FORM_VALUES: FormValues = {
  class_id: '',
  subject_id: '',
  title: '',
  term: '',
  date: '',
}

interface ScheduleFormValues {
  starts_at_local: string
  duration_minutes: string
  venue: string
  notes: string
}

const EMPTY_SCHEDULE_FORM: ScheduleFormValues = {
  starts_at_local: '',
  duration_minutes: '60',
  venue: '',
  notes: '',
}

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

export default function TestsPage() {
  const queryClient = useQueryClient()

  const testsQuery = useQuery({ queryKey: ['tests', 'mine'], queryFn: listMyTests })
  const myExamTimetableQuery = useQuery({
    queryKey: ['exam-timetable', 'mine'],
    queryFn: listMyExamTimetableEntries,
  })
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'assigned'], queryFn: listMyAssignedSubjects })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Test | null>(null)
  const [deleting, setDeleting] = useState<Test | null>(null)
  const [scheduling, setScheduling] = useState<Test | null>(null)
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormValues>(EMPTY_SCHEDULE_FORM)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM_VALUES,
  })
  const selectedFormClassId = useWatch({ control: form.control, name: 'class_id' })
  const selectedFormSubjectId = useWatch({ control: form.control, name: 'subject_id' })

  const openCreateTestDialog = () => {
    setEditing(null)
    form.reset(EMPTY_FORM_VALUES)
    setOpen(true)
  }

  const openEditTestDialog = (row: Test) => {
    setEditing(row)
    form.reset({
      class_id: row.class_id,
      subject_id: row.subject_id,
      title: row.title,
      term: row.term ?? '',
      date: row.date ?? '',
    })
    setOpen(true)
  }

  const closeTestDialog = () => {
    setOpen(false)
    setEditing(null)
    form.reset(EMPTY_FORM_VALUES)
  }

  const openScheduleDialog = (row: Test) => {
    setScheduling(row)
    const existing = myTimetableByTestId.get(row.id)
    setScheduleForm({
      starts_at_local: toLocalDateTimeInputValue(existing?.starts_at) || (row.date ? `${row.date}T08:00` : ''),
      duration_minutes: String(existing?.duration_minutes ?? 60),
      venue: existing?.venue ?? '',
      notes: existing?.notes ?? '',
    })
  }

  const createMutation = useMutation({
    mutationFn: createTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      toast.success('Test created')
      closeTestDialog()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateTest,
    onSuccess: async (updatedTest) => {
      const existingSchedule = myTimetableByTestId.get(updatedTest.id)
      if (existingSchedule) {
        try {
          await upsertExamTimetableForTest(updatedTest, {
            starts_at: existingSchedule.starts_at,
            duration_minutes: existingSchedule.duration_minutes,
            venue: existingSchedule.venue ?? undefined,
            notes: existingSchedule.notes ?? undefined,
          })
          queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
        } catch (error) {
          toast.error(error instanceof Error ? `Test updated, but timetable sync failed: ${error.message}` : 'Test updated, but timetable sync failed')
        }
      }
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      toast.success('Test updated')
      closeTestDialog()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] })
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
      toast.success('Test deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const scheduleMutation = useMutation({
    mutationFn: ({ test, values }: { test: Test; values: ScheduleFormValues }) => {
      const startsAtDate = new Date(values.starts_at_local)
      if (!values.starts_at_local || Number.isNaN(startsAtDate.getTime())) {
        throw new Error('Choose a valid exam start date and time')
      }
      const startsAtIso = startsAtDate.toISOString()
      const duration = Math.max(1, Number.parseInt(values.duration_minutes || '60', 10) || 60)
      return upsertExamTimetableForTest(test, {
        starts_at: startsAtIso,
        duration_minutes: duration,
        venue: values.venue,
        notes: values.notes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
      toast.success('Exam added to timetable')
      setScheduling(null)
      setScheduleForm(EMPTY_SCHEDULE_FORM)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const removeScheduleMutation = useMutation({
    mutationFn: removeExamTimetableForTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })
      toast.success('Exam removed from timetable')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const myTimetableByTestId = new Map((myExamTimetableQuery.data ?? []).map((entry) => [entry.test_id, entry]))

  const columns: DataTableColumn<Test>[] = [
      {
        key: 'title',
        header: 'Test',
        render: (row) => (
          <div>
            <p className='font-medium'>{row.title}</p>
            <p className='text-xs text-muted-foreground'>
              {row.classroom?.name ?? '-'} | {row.subject?.name ?? '-'}
            </p>
          </div>
        ),
      },
      {
        key: 'term',
        header: 'Term',
        render: (row) => row.term ?? '-',
      },
      {
        key: 'date',
        header: 'Date',
        render: (row) => formatDate(row.date),
      },
      {
        key: 'timetable',
        header: 'Timetable',
        render: (row) => {
          const schedule = myTimetableByTestId.get(row.id)
          if (!schedule) return <span className='text-muted-foreground'>Admin-managed timetable</span>

          return (
            <div className='space-y-1'>
              <Badge variant='secondary' className='rounded-lg'>
                Scheduled
              </Badge>
              <p className='text-xs text-muted-foreground'>{formatDateTime(schedule.starts_at)}</p>
              <p className='text-xs text-muted-foreground'>{schedule.duration_minutes} min</p>
            </div>
          )
        },
      },
      {
        key: 'total_marks',
        header: 'Total Marks',
        render: (row) => row.total_marks,
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[520px]',
        render: (row) => (
          <div className='flex flex-wrap gap-2'>
            <Button asChild size='sm' variant='secondary' className='rounded-lg'>
              <Link to={`/teacher/tests/${row.id}`}>
                <Wrench className='mr-1 h-3.5 w-3.5' /> Builder
              </Link>
            </Button>
            <Button asChild size='sm' variant='outline' className='rounded-lg'>
              <Link to={`/teacher/tests/${row.id}/print`}>
                <Printer className='mr-1 h-3.5 w-3.5' /> Print
              </Link>
            </Button>
            <Button asChild size='sm' variant='outline' className='rounded-lg'>
              <Link to={`/teacher/marking?testId=${row.id}`}>
                <ClipboardCheck className='mr-1 h-3.5 w-3.5' /> Mark
              </Link>
            </Button>
            <Button size='sm' variant='outline' className='rounded-lg' onClick={() => openScheduleDialog(row)} disabled>
              <Clock3 className='mr-1 h-3.5 w-3.5' />
              Admin timetable
            </Button>
            {myTimetableByTestId.has(row.id) ? (
              <Button
                size='sm'
                variant='outline'
                className='rounded-lg'
                disabled
                onClick={() => removeScheduleMutation.mutate(row.id)}
              >
                Admin only
              </Button>
            ) : null}
            <Button
              size='sm'
              variant='outline'
              className='rounded-lg'
              onClick={() => openEditTestDialog(row)}
            >
              <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
            </Button>
            <Button size='sm' variant='destructive' className='rounded-lg' onClick={() => setDeleting(row)}>
              <Trash2 className='mr-1 h-3.5 w-3.5' /> Delete
            </Button>
          </div>
        ),
      },
    ]

  if (testsQuery.isLoading || myExamTimetableQuery.isLoading || classesQuery.isLoading || subjectsQuery.isLoading) {
    return <LoadingState />
  }

  if (testsQuery.isError || myExamTimetableQuery.isError || classesQuery.isError || subjectsQuery.isError) {
    return (
      <EmptyState
        title='Tests unavailable'
        description='Could not load tests or your exam timetable entries. Try again shortly.'
      />
    )
  }

  return (
    <div>
      <PageHeader
        title='Tests'
        description='Create and manage your tests, build question sets, and print papers. The official exam timetable is prepared by the admin.'
        actionLabel='Create test'
        onAction={openCreateTestDialog}
      />

      {!testsQuery.data?.length ? (
        <EmptyState
          title='No tests yet'
          description='Create a test and then add questions from your bank.'
          actionLabel='Create test'
          onAction={openCreateTestDialog}
        />
      ) : (
        <DataTable
          data={testsQuery.data}
          columns={columns}
          searchKeys={['title', 'term']}
          filters={[
            {
              id: 'class',
              label: 'Class',
              options: (classesQuery.data ?? []).map((item) => ({ label: item.name, value: item.id })),
              getValue: (row) => row.class_id,
            },
          ]}
        />
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true)
          else closeTestDialog()
        }}
      >
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit test' : 'Create test'}</DialogTitle>
            <DialogDescription>Set class, subject, term and date before adding questions.</DialogDescription>
          </DialogHeader>

          <form
            id='test-form'
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => {
              if (editing) {
                updateMutation.mutate({
                  id: editing.id,
                  class_id: values.class_id,
                  subject_id: values.subject_id,
                  title: values.title,
                  term: values.term,
                  date: values.date,
                  total_marks: editing.total_marks,
                })
              } else {
                createMutation.mutate(values)
              }
            })}
          >
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Class</Label>
                <Select
                  value={selectedFormClassId ?? ''}
                  onValueChange={(value) => form.setValue('class_id', value, { shouldValidate: true })}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder='Select class' />
                  </SelectTrigger>
                  <SelectContent>
                    {(classesQuery.data ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Subject</Label>
                <Select
                  value={selectedFormSubjectId ?? ''}
                  onValueChange={(value) => form.setValue('subject_id', value, { shouldValidate: true })}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder='Select subject' />
                  </SelectTrigger>
                  <SelectContent>
                    {(subjectsQuery.data ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='title'>Title</Label>
              <Input id='title' {...form.register('title')} />
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='term'>Term</Label>
                <Input id='term' {...form.register('term')} />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='date'>Date</Label>
                <Input id='date' type='date' {...form.register('date')} />
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              form='test-form'
              type='submit'
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save changes' : 'Create test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(scheduling)}
        onOpenChange={(next) => {
          if (!next) {
            setScheduling(null)
            setScheduleForm(EMPTY_SCHEDULE_FORM)
          }
        }}
      >
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{myTimetableByTestId.has(scheduling?.id ?? '') ? 'Reschedule exam' : 'Schedule exam'}</DialogTitle>
            <DialogDescription>
              Publish the exam time to the shared teacher timetable so all teachers can see it.
            </DialogDescription>
          </DialogHeader>

          {scheduling ? (
            <div className='space-y-4'>
              <div className='rounded-xl border bg-muted/30 p-3 text-sm'>
                <p className='font-medium'>{scheduling.title}</p>
                <p className='text-muted-foreground'>
                  {scheduling.classroom?.name ?? 'Class'} | {scheduling.subject?.name ?? 'Subject'}
                </p>
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='exam-start-time'>Start time</Label>
                  <Input
                    id='exam-start-time'
                    type='datetime-local'
                    value={scheduleForm.starts_at_local}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, starts_at_local: event.target.value }))
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='exam-duration'>Duration (minutes)</Label>
                  <Input
                    id='exam-duration'
                    type='number'
                    min={1}
                    max={600}
                    value={scheduleForm.duration_minutes}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({ ...prev, duration_minutes: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='exam-venue'>Venue / room (optional)</Label>
                <Input
                  id='exam-venue'
                  placeholder='Example: Room 4 / Hall'
                  value={scheduleForm.venue}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, venue: event.target.value }))}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='exam-notes'>Notes for timetable (optional)</Label>
                <Textarea
                  id='exam-notes'
                  rows={3}
                  placeholder='Example: Invigilation shared with Grade 3 teacher.'
                  value={scheduleForm.notes}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant='outline'
              className='rounded-xl'
              onClick={() => {
                setScheduling(null)
                setScheduleForm(EMPTY_SCHEDULE_FORM)
              }}
            >
              Cancel
            </Button>
            <Button
              className='rounded-xl'
              disabled={scheduleMutation.isPending || !scheduling}
              onClick={() => {
                if (!scheduling) return
                scheduleMutation.mutate({ test: scheduling, values: scheduleForm })
              }}
            >
              {scheduleMutation.isPending ? 'Saving...' : 'Publish to timetable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete test?'
        description='All test questions and attempts will be removed.'
        confirmLabel='Delete test'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
