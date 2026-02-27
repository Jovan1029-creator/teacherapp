// src\pages\admin\Subjects.tsx
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createSubject, deleteSubject, listSubjects, updateSubject } from '@/api/subjects'
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
import type { Subject } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Subject name is required'),
})

type FormValues = z.infer<typeof schema>

export default function SubjectsPage() {
  const queryClient = useQueryClient()
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [deleting, setDeleting] = useState<Subject | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  const createMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Subject created')
      setOpen(false)
      setEditing(null)
      form.reset({ name: '' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Subject updated')
      setOpen(false)
      setEditing(null)
      form.reset({ name: '' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Subject deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<DataTableColumn<Subject>[]>(
    () => [
      { key: 'name', header: 'Subject Name', render: (row) => row.name },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[160px]',
        render: (row) => (
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              className='rounded-lg'
              onClick={() => {
                setEditing(row)
                form.reset({ name: row.name })
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

  if (subjectsQuery.isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title='Subjects'
        description='Define all subjects taught in your school.'
        actionLabel='Add subject'
        onAction={() => {
          setEditing(null)
          form.reset({ name: '' })
          setOpen(true)
        }}
      />

      {!subjectsQuery.data?.length ? (
        <EmptyState
          title='No subjects yet'
          description='Create your first subject to map topics and tests.'
          actionLabel='Create subject'
          onAction={() => setOpen(true)}
        />
      ) : (
        <DataTable data={subjectsQuery.data} columns={columns} searchKeys={['name']} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit subject' : 'Create subject'}</DialogTitle>
            <DialogDescription>Use standardized names for consistency.</DialogDescription>
          </DialogHeader>

          <form
            id='subject-form'
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, name: values.name })
              } else {
                createMutation.mutate({ name: values.name })
              }
            })}
          >
            <div className='space-y-2'>
              <Label htmlFor='name'>Subject Name</Label>
              <Input id='name' {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className='text-xs text-destructive'>{form.formState.errors.name.message}</p>
              ) : null}
            </div>
          </form>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              form='subject-form'
              type='submit'
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save changes' : 'Create subject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete subject?'
        description='This may impact linked topics and assessments.'
        confirmLabel='Delete subject'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
