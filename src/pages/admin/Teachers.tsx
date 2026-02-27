// src\pages\admin\Teachers.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { createTeacherAccount, createTeacherProfile, listTeachers, updateTeacherProfile } from '@/api/users'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { UserProfile } from '@/lib/types'

const createAccountSchema = z.object({
  email: z.string().email('Use a valid email address'),
  password: z.string().min(8, 'Temporary password must be at least 8 characters'),
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
})

const linkExistingSchema = z.object({
  id: z.string().uuid('Use a valid Auth user UUID'),
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
})

const updateSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
})

type CreateAccountFormValues = z.infer<typeof createAccountSchema>
type LinkExistingFormValues = z.infer<typeof linkExistingSchema>
type UpdateFormValues = z.infer<typeof updateSchema>
type CreateMode = 'account' | 'link'

const emptyUpdateValues: UpdateFormValues = { full_name: '', phone: '' }
const emptyCreateAccountValues: CreateAccountFormValues = { email: '', password: '', full_name: '', phone: '' }
const emptyLinkValues: LinkExistingFormValues = { id: '', full_name: '', phone: '' }

export default function TeachersPage() {
  const queryClient = useQueryClient()
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: listTeachers })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [createMode, setCreateMode] = useState<CreateMode>('account')

  const createAccountForm = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: emptyCreateAccountValues,
  })

  const linkExistingForm = useForm<LinkExistingFormValues>({
    resolver: zodResolver(linkExistingSchema),
    defaultValues: emptyLinkValues,
  })

  const updateForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: emptyUpdateValues,
  })

  function resetCreateForms() {
    createAccountForm.reset(emptyCreateAccountValues)
    linkExistingForm.reset(emptyLinkValues)
    setCreateMode('account')
  }

  function closeDialog() {
    setOpen(false)
    setEditing(null)
    updateForm.reset(emptyUpdateValues)
    resetCreateForms()
  }

  function openCreateDialog(mode: CreateMode = 'account') {
    setEditing(null)
    resetCreateForms()
    setCreateMode(mode)
    setOpen(true)
  }

  function openEditDialog(teacher: UserProfile) {
    setEditing(teacher)
    updateForm.reset({ full_name: teacher.full_name, phone: teacher.phone ?? '' })
    setOpen(true)
  }

  const createAccountMutation = useMutation({
    mutationFn: createTeacherAccount,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success(`Teacher account created${result.email ? ` (${result.email})` : ''}`)
      closeDialog()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const linkProfileMutation = useMutation({
    mutationFn: createTeacherProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success('Teacher profile linked')
      closeDialog()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateTeacherProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success('Teacher profile updated')
      closeDialog()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns: DataTableColumn<UserProfile>[] = [
    {
      key: 'full_name',
      header: 'Teacher Name',
      render: (row) => row.full_name,
    },
    {
      key: 'id',
      header: 'Auth UUID',
      render: (row) => <span className='font-mono text-xs'>{row.id}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => row.phone ?? '-',
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-[140px]',
      render: (row) => (
        <Button size='sm' variant='outline' className='rounded-lg' onClick={() => openEditDialog(row)}>
          <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
        </Button>
      ),
    },
  ]

  const createFormId = createMode === 'account' ? 'teacher-create-account-form' : 'teacher-link-form'
  const isSubmitting = createAccountMutation.isPending || linkProfileMutation.isPending || updateMutation.isPending

  if (teachersQuery.isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader
        title='Teachers'
        description='Create teacher accounts in-app (Auth + profile) and maintain teacher profiles for this school.'
        actionLabel='Add teacher'
        onAction={() => openCreateDialog('account')}
      />

      {!teachersQuery.data?.length ? (
        <EmptyState
          title='No teacher profiles'
          description='Create teacher accounts directly in the app. You can also link an existing Supabase Auth user as a fallback.'
          actionLabel='Create teacher account'
          onAction={() => openCreateDialog('account')}
        />
      ) : (
        <DataTable data={teachersQuery.data} columns={columns} searchKeys={['full_name', 'phone', 'id']} />
      )}

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit teacher profile' : createMode === 'account' ? 'Create teacher account' : 'Link existing Auth user'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update teacher profile details.'
                : createMode === 'account'
                  ? 'Creates a Supabase Auth user and the matching teacher profile row in this school.'
                  : 'Fallback mode: link a profile row to a user that already exists in Supabase Auth.'}
            </DialogDescription>
          </DialogHeader>

          {!editing ? (
            <Tabs value={createMode} onValueChange={(value) => setCreateMode(value as CreateMode)} className='w-full'>
              <TabsList className='grid w-full grid-cols-2 rounded-xl'>
                <TabsTrigger value='account'>Create Account</TabsTrigger>
                <TabsTrigger value='link'>Link Existing Auth</TabsTrigger>
              </TabsList>

              <TabsContent value='account' className='mt-4'>
                <form
                  id='teacher-create-account-form'
                  className='space-y-4'
                  onSubmit={createAccountForm.handleSubmit((values) => createAccountMutation.mutate(values))}
                >
                  <div className='space-y-2'>
                    <Label htmlFor='create-email'>Email</Label>
                    <Input id='create-email' placeholder='teacher@school.ac.tz' {...createAccountForm.register('email')} />
                    {createAccountForm.formState.errors.email ? (
                      <p className='text-xs text-destructive'>{createAccountForm.formState.errors.email.message}</p>
                    ) : null}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='create-password'>Temporary Password</Label>
                    <Input
                      id='create-password'
                      type='password'
                      placeholder='At least 8 characters'
                      {...createAccountForm.register('password')}
                    />
                    {createAccountForm.formState.errors.password ? (
                      <p className='text-xs text-destructive'>{createAccountForm.formState.errors.password.message}</p>
                    ) : null}
                    <p className='text-xs text-muted-foreground'>
                      Share this temporary password with the teacher, then ask them to change it after first login.
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='create-full_name'>Full Name</Label>
                    <Input id='create-full_name' {...createAccountForm.register('full_name')} />
                    {createAccountForm.formState.errors.full_name ? (
                      <p className='text-xs text-destructive'>{createAccountForm.formState.errors.full_name.message}</p>
                    ) : null}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='create-phone'>Phone</Label>
                    <Input id='create-phone' {...createAccountForm.register('phone')} />
                  </div>
                </form>
              </TabsContent>

              <TabsContent value='link' className='mt-4'>
                <form
                  id='teacher-link-form'
                  className='space-y-4'
                  onSubmit={linkExistingForm.handleSubmit((values) => linkProfileMutation.mutate(values))}
                >
                  <div className='space-y-2'>
                    <Label htmlFor='link-id'>Auth User UUID</Label>
                    <Input id='link-id' placeholder='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' {...linkExistingForm.register('id')} />
                    {linkExistingForm.formState.errors.id ? (
                      <p className='text-xs text-destructive'>{linkExistingForm.formState.errors.id.message}</p>
                    ) : null}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='link-full_name'>Full Name</Label>
                    <Input id='link-full_name' {...linkExistingForm.register('full_name')} />
                    {linkExistingForm.formState.errors.full_name ? (
                      <p className='text-xs text-destructive'>{linkExistingForm.formState.errors.full_name.message}</p>
                    ) : null}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='link-phone'>Phone</Label>
                    <Input id='link-phone' {...linkExistingForm.register('phone')} />
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <form
              id='teacher-update-form'
              className='space-y-4'
              onSubmit={updateForm.handleSubmit((values) => {
                if (!editing) return
                updateMutation.mutate({ id: editing.id, ...values })
              })}
            >
              <div className='space-y-2'>
                <Label htmlFor='full_name'>Full Name</Label>
                <Input id='full_name' {...updateForm.register('full_name')} />
                {updateForm.formState.errors.full_name ? (
                  <p className='text-xs text-destructive'>{updateForm.formState.errors.full_name.message}</p>
                ) : null}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='phone'>Phone</Label>
                <Input id='phone' {...updateForm.register('phone')} />
              </div>
            </form>
          )}

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={closeDialog}>
              Cancel
            </Button>
            <Button form={editing ? 'teacher-update-form' : createFormId} type='submit' className='rounded-xl' disabled={isSubmitting}>
              {editing ? 'Save changes' : createMode === 'account' ? 'Create teacher account' : 'Create profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
