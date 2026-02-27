// src\pages\admin\SchoolProfile.tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getSchool, updateSchool, uploadSchoolLogo } from '@/api/schools'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(2, 'School name is required'),
  logo_url: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value), 'Use a valid image URL'),
  region: z.string().optional(),
  district: z.string().optional(),
  phone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function SchoolProfilePage() {
  const queryClient = useQueryClient()
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: getSchool })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', logo_url: '', region: '', district: '', phone: '' },
  })

  useEffect(() => {
    if (!schoolQuery.data) return
    form.reset({
      name: schoolQuery.data.name,
      logo_url: schoolQuery.data.logo_url ?? '',
      region: schoolQuery.data.region ?? '',
      district: schoolQuery.data.district ?? '',
      phone: schoolQuery.data.phone ?? '',
    })
  }, [schoolQuery.data, form])

  const mutation = useMutation({
    mutationFn: updateSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school'] })
      toast.success('School profile updated')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const logoUploadMutation = useMutation({
    mutationFn: uploadSchoolLogo,
    onSuccess: (logoUrl) => {
      form.setValue('logo_url', logoUrl, { shouldDirty: true, shouldValidate: true })
      toast.success('Logo uploaded. Save changes to apply it to your school profile.')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const logoPreviewUrl = (form.watch('logo_url') ?? '').trim()

  if (schoolQuery.isLoading) return <LoadingState />

  return (
    <div>
      <PageHeader title='School Profile' description='Manage your institution details used in reports and test papers.' />

      <Card className='max-w-3xl rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle className='font-heading text-xl'>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className='space-y-5'
            onSubmit={form.handleSubmit((values) =>
              mutation.mutate({
                name: values.name,
                logo_url: values.logo_url?.trim() || null,
                region: values.region || null,
                district: values.district || null,
                phone: values.phone || null,
              }),
            )}
          >
            <div className='rounded-2xl border border-border/70 bg-background/60 p-4'>
              <div className='mb-4 flex flex-wrap items-center gap-4'>
                <div className='flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white shadow-sm'>
                  {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt='School logo preview' className='h-full w-full object-cover' />
                  ) : (
                    <span className='text-xs text-muted-foreground'>No logo</span>
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='font-medium'>School Logo</p>
                  <p className='text-sm text-muted-foreground'>
                    This logo appears in the admin and teacher workspace header/sidebar.
                  </p>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-[1fr_auto] md:items-end'>
                <div className='space-y-2'>
                  <Label htmlFor='logo-file'>Upload logo (image, max 1MB)</Label>
                  <Input
                    id='logo-file'
                    type='file'
                    accept='image/png,image/jpeg,image/webp,image/svg+xml'
                    disabled={logoUploadMutation.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) logoUploadMutation.mutate(file)
                      event.currentTarget.value = ''
                    }}
                  />
                </div>

                <Button
                  type='button'
                  variant='outline'
                  className='rounded-xl'
                  disabled={!logoPreviewUrl}
                  onClick={() => form.setValue('logo_url', '', { shouldDirty: true, shouldValidate: true })}
                >
                  Remove logo
                </Button>
              </div>

              <div className='mt-4 space-y-2'>
                <Label htmlFor='logo_url'>Logo URL</Label>
                <Input id='logo_url' placeholder='https://...' {...form.register('logo_url')} />
                {form.formState.errors.logo_url ? (
                  <p className='text-xs text-destructive'>{form.formState.errors.logo_url.message}</p>
                ) : (
                  <p className='text-xs text-muted-foreground'>
                    Uploaded files are kept in the `school-assets` bucket. Save changes to persist the logo on your school profile.
                  </p>
                )}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='name'>School Name</Label>
              <Input id='name' {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className='text-xs text-destructive'>{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className='grid gap-5 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='region'>Region</Label>
                <Input id='region' {...form.register('region')} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='district'>District</Label>
                <Input id='district' {...form.register('district')} />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='phone'>Phone</Label>
              <Input id='phone' {...form.register('phone')} />
            </div>

            <Button type='submit' className='rounded-xl' disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
