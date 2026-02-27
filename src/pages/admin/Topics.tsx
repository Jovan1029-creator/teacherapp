import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { listSubjects } from '@/api/subjects'
import { createTopic, deleteTopic, listTopics, updateTopic } from '@/api/topics'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
import type { Topic } from '@/lib/types'

const schema = z.object({
  subject_id: z.string().min(1, 'Subject is required'),
  form_level: z.coerce.number().min(1).max(6),
  title: z.string().min(1, 'Topic title is required'),
  syllabus_ref: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function TopicsPage() {
  const queryClient = useQueryClient()
  const topicsQuery = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() })
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [deleting, setDeleting] = useState<Topic | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject_id: '', form_level: 1, title: '', syllabus_ref: '' },
  })
  const selectedSubjectId = useWatch({ control: form.control, name: 'subject_id' })

  const createMutation = useMutation({
    mutationFn: createTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      toast.success('Topic created')
      setOpen(false)
      setEditing(null)
      form.reset({ subject_id: '', form_level: 1, title: '', syllabus_ref: '' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      toast.success('Topic updated')
      setOpen(false)
      setEditing(null)
      form.reset({ subject_id: '', form_level: 1, title: '', syllabus_ref: '' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics'] })
      toast.success('Topic deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<DataTableColumn<Topic>[]>(
    () => [
      {
        key: 'title',
        header: 'Topic',
        render: (row) => row.title,
      },
      {
        key: 'subject',
        header: 'Subject',
        render: (row) => row.subject?.name ?? '-',
      },
      {
        key: 'form_level',
        header: 'Form',
        render: (row) => `Form ${row.form_level}`,
      },
      {
        key: 'syllabus_ref',
        header: 'Syllabus Ref',
        render: (row) => row.syllabus_ref ?? '-',
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[180px]',
        render: (row) => (
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              className='rounded-lg'
              onClick={() => {
                setEditing(row)
                form.reset({
                  subject_id: row.subject_id,
                  form_level: row.form_level,
                  title: row.title,
                  syllabus_ref: row.syllabus_ref ?? '',
                })
                setOpen(true)
              }}
            >
              <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
            </Button>
            <Button size='sm' variant='destructive' className='rounded-lg' onClick={() => setDeleting(row)}>
              <Trash2 className='mr-1 h-3.5 w-3.5' /> Delete
            </Button>
          </div>
        ),
      },
    ],
    [form],
  )

  if (topicsQuery.isLoading || subjectsQuery.isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title='Topics'
        description='Map topics by subject and form level for planning and analytics.'
        actionLabel='Add topic'
        onAction={() => {
          setEditing(null)
          form.reset({ subject_id: '', form_level: 1, title: '', syllabus_ref: '' })
          setOpen(true)
        }}
      />

      {!topicsQuery.data?.length ? (
        <EmptyState
          title='No topics yet'
          description='Create topics to enable lesson planning and auto-generated tests.'
          actionLabel='Create topic'
          onAction={() => setOpen(true)}
        />
      ) : (
        <DataTable
          data={topicsQuery.data}
          columns={columns}
          searchKeys={['title', 'syllabus_ref']}
          filters={[
            {
              id: 'subject',
              label: 'Subject',
              options: (subjectsQuery.data ?? []).map((subject) => ({ label: subject.name, value: subject.id })),
              getValue: (row) => String(row.subject_id),
            },
          ]}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit topic' : 'Create topic'}</DialogTitle>
            <DialogDescription>Align topics to syllabus references where possible.</DialogDescription>
          </DialogHeader>

          <form
            id='topic-form'
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, ...values })
              } else {
                createMutation.mutate(values)
              }
            })}
          >
            <div className='space-y-2'>
              <Label>Subject</Label>
              <Select
                value={selectedSubjectId ?? ''}
                onValueChange={(value) => form.setValue('subject_id', value, { shouldValidate: true })}
              >
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='Select subject' />
                </SelectTrigger>
                <SelectContent>
                  {(subjectsQuery.data ?? []).map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.subject_id ? (
                <p className='text-xs text-destructive'>{form.formState.errors.subject_id.message}</p>
              ) : null}
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='form_level'>Form Level</Label>
                <Input id='form_level' type='number' min={1} max={6} {...form.register('form_level')} />
                {form.formState.errors.form_level ? (
                  <p className='text-xs text-destructive'>{form.formState.errors.form_level.message}</p>
                ) : null}
              </div>
              <div className='space-y-2'>
                <Label htmlFor='syllabus_ref'>Syllabus Ref</Label>
                <Input id='syllabus_ref' {...form.register('syllabus_ref')} />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='title'>Topic Title</Label>
              <Input id='title' {...form.register('title')} />
              {form.formState.errors.title ? (
                <p className='text-xs text-destructive'>{form.formState.errors.title.message}</p>
              ) : null}
            </div>
          </form>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              form='topic-form'
              type='submit'
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save changes' : 'Create topic'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete topic?'
        description='Questions and lesson plans linked to this topic may lose references.'
        confirmLabel='Delete topic'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
