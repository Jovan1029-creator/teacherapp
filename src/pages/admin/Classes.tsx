// src\pages\admin\Classes.tsx
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createClass, deleteClass, listClasses, updateClass } from '@/api/classes'
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
import type { Classroom } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Class name is required'),
  year: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined)),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function ClassesPage() {
  const queryClient = useQueryClient()
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Classroom | null>(null)
  const [deleting, setDeleting] = useState<Classroom | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', year: undefined },
  })

  const createMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class created')
      setOpen(false)
      setEditing(null)
      form.reset({ name: '', year: undefined })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class updated')
      setOpen(false)
      setEditing(null)
      form.reset({ name: '', year: undefined })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<DataTableColumn<Classroom>[]>(
    () => [
      {
        key: 'name',
        header: 'Class name',
        render: (row) => row.name,
      },
      {
        key: 'year',
        header: 'Year',
        render: (row) => row.year ?? '-',
      },
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
                form.reset({ name: row.name, year: row.year == null ? undefined : String(row.year) })
                setOpen(true)
              }}
            >
              <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
            </Button>
            <Button
              size='sm'
              variant='destructive'
              className='rounded-lg'
              onClick={() => setDeleting(row)}
            >
              <Trash2 className='mr-1 h-3.5 w-3.5' /> Delete
            </Button>
          </div>
        ),
      },
    ],
    [form],
  )

  if (classesQuery.isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title='Classes'
        description='Manage class groups and school year intake.'
        actionLabel='Add class'
        onAction={() => {
          setEditing(null)
          form.reset({ name: '', year: undefined })
          setOpen(true)
        }}
      />

      {!classesQuery.data?.length ? (
        <EmptyState
          title='No classes yet'
          description='Create your first class before adding students or assignments.'
          actionLabel='Create class'
          onAction={() => setOpen(true)}
        />
      ) : (
        <DataTable data={classesQuery.data} columns={columns} searchKeys={['name']} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit class' : 'Create class'}</DialogTitle>
            <DialogDescription>Use clear naming like Form 1A, Form 2B.</DialogDescription>
          </DialogHeader>

          <form
            id='class-form'
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => {
              if (editing) {
                updateMutation.mutate({ id: editing.id, name: values.name, year: values.year })
              } else {
                createMutation.mutate({ name: values.name, year: values.year })
              }
            })}
          >
            <div className='space-y-2'>
              <Label htmlFor='name'>Class Name</Label>
              <Input id='name' {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className='text-xs text-destructive'>{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='year'>Year</Label>
              <Input id='year' type='number' {...form.register('year')} />
            </div>
          </form>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              form='class-form'
              type='submit'
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save changes' : 'Create class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete class?'
        description='Students and assignments tied to this class can be affected.'
        confirmLabel='Delete class'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
