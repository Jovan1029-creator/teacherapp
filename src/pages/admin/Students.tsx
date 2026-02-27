// src\pages\admin\Students.tsx
import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { listClasses } from '@/api/classes'
import { bulkInsertStudents, createStudent, deleteStudent, listStudentsByClass } from '@/api/students'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { Student, StudentCsvRow } from '@/lib/types'
import { safeText } from '@/lib/utils'

const schema = z.object({
  class_id: z.string().min(1, 'Class is required'),
  admission_no: z.string().optional(),
  full_name: z.string().min(2, 'Full name is required'),
  sex: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface PreviewRow {
  admission_no: string
  full_name: string
  sex: string
  valid: boolean
  error?: string
}

function normalizeSex(value: string) {
  const normalized = safeText(value).toUpperCase()
  if (!normalized) return ''
  if (normalized === 'M' || normalized === 'MALE') return 'M'
  if (normalized === 'F' || normalized === 'FEMALE') return 'F'
  return normalized
}

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })

  const [selectedClassId, setSelectedClassId] = useState('')
  const studentsQuery = useQuery({
    queryKey: ['students', selectedClassId],
    queryFn: () => listStudentsByClass(selectedClassId || undefined),
  })

  const [openManual, setOpenManual] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [csvRows, setCsvRows] = useState<PreviewRow[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { class_id: '', admission_no: '', full_name: '', sex: '' },
  })
  const manualClassId = useWatch({ control: form.control, name: 'class_id' })

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Student added')
      setOpenManual(false)
      form.reset({ class_id: '', admission_no: '', full_name: '', sex: '' })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Student deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const importMutation = useMutation({
    mutationFn: (payload: { classId: string; rows: PreviewRow[] }) =>
      bulkInsertStudents(
        payload.classId,
        payload.rows
          .filter((row) => row.valid)
          .map((row) => ({
            admission_no: row.admission_no || undefined,
            full_name: row.full_name,
            sex: row.sex || undefined,
          })),
        100,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success('Students imported')
      setCsvRows([])
      setCsvErrors([])
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<DataTableColumn<Student>[]>(
    () => [
      { key: 'admission_no', header: 'Admission No', render: (row) => row.admission_no ?? '-' },
      { key: 'full_name', header: 'Student Name', render: (row) => row.full_name },
      { key: 'sex', header: 'Sex', render: (row) => row.sex ?? '-' },
      { key: 'classroom', header: 'Class', render: (row) => row.classroom?.name ?? '-' },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[120px]',
        render: (row) => (
          <Button variant='destructive' size='sm' className='rounded-lg' onClick={() => setDeleting(row)}>
            Delete
          </Button>
        ),
      },
    ],
    [],
  )

  const validCsvRows = csvRows.filter((row) => row.valid)

  const parseCsv = (file: File) => {
    Papa.parse<StudentCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: PreviewRow[] = []
        const errors: string[] = []

        results.data.forEach((record, index) => {
          const full_name = safeText(record.full_name)
          const admission_no = safeText(record.admission_no)
          const sex = normalizeSex(safeText(record.sex))

          let error = ''
          if (!full_name) {
            error = 'Full name is required'
          } else if (sex && sex !== 'M' && sex !== 'F') {
            error = 'Sex must be M or F'
          }

          const row: PreviewRow = {
            admission_no,
            full_name,
            sex,
            valid: !error,
            error,
          }

          if (error) {
            errors.push(`Row ${index + 2}: ${error}`)
          }

          rows.push(row)
        })

        setCsvRows(rows)
        setCsvErrors(errors)
        if (!rows.length) toast.error('No CSV rows detected')
      },
      error: (error) => {
        toast.error(error.message)
      },
    })
  }

  if (classesQuery.isLoading || studentsQuery.isLoading) return <LoadingState />

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Students'
        description='Manage student rosters per class and import from CSV.'
        actionLabel='Add student'
        onAction={() => setOpenManual(true)}
      />

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle className='font-heading text-xl'>Filters</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-3'>
          <Select value={selectedClassId || '__all__'} onValueChange={(value) => setSelectedClassId(value === '__all__' ? '' : value)}>
            <SelectTrigger className='w-[260px] rounded-xl'>
              <SelectValue placeholder='Filter by class' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>All classes</SelectItem>
              {(classesQuery.data ?? []).map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!studentsQuery.data?.length ? (
        <EmptyState
          title='No students found'
          description='Add students manually or import a CSV file to get started.'
          actionLabel='Add student'
          onAction={() => setOpenManual(true)}
        />
      ) : (
        <DataTable
          data={studentsQuery.data}
          columns={columns}
          searchKeys={['admission_no', 'full_name', 'sex']}
          filters={[
            {
              id: 'classroom',
              label: 'Class',
              options: (classesQuery.data ?? []).map((item) => ({ label: item.name, value: item.id })),
              getValue: (row) => row.class_id,
            },
          ]}
        />
      )}

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle className='font-heading text-xl'>CSV Import</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-[280px_1fr]'>
            <div className='space-y-2'>
              <Label>Target Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className='rounded-xl'>
                  <SelectValue placeholder='Select class for import' />
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
              <Label>Upload CSV</Label>
              <Input
                type='file'
                accept='.csv'
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) parseCsv(file)
                }}
              />
              <p className='text-xs text-muted-foreground'>Expected columns: admission_no, full_name, sex</p>
            </div>
          </div>

          {csvErrors.length > 0 ? (
            <div className='rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'>
              <p className='font-medium'>Validation issues:</p>
              <ul className='mt-1 list-disc pl-5'>
                {csvErrors.slice(0, 8).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {csvRows.length ? (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Preview rows: {csvRows.length} total, {validCsvRows.length} valid
              </p>
              <div className='max-h-72 overflow-auto rounded-2xl border'>
                <table className='min-w-full text-sm'>
                  <thead className='bg-muted/50'>
                    <tr>
                      <th className='px-3 py-2 text-left'>Admission No</th>
                      <th className='px-3 py-2 text-left'>Full Name</th>
                      <th className='px-3 py-2 text-left'>Sex</th>
                      <th className='px-3 py-2 text-left'>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, index) => (
                      <tr key={`preview-${index}`} className='border-t'>
                        <td className='px-3 py-2'>{row.admission_no || '-'}</td>
                        <td className='px-3 py-2'>{row.full_name}</td>
                        <td className='px-3 py-2'>{row.sex || '-'}</td>
                        <td className='px-3 py-2'>
                          {row.valid ? (
                            <span className='text-emerald-600'>Valid</span>
                          ) : (
                            <span className='text-destructive'>{row.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button
                className='rounded-xl'
                disabled={!selectedClassId || !validCsvRows.length || importMutation.isPending}
                onClick={() => {
                  if (!selectedClassId) {
                    toast.error('Select a target class first')
                    return
                  }
                  importMutation.mutate({ classId: selectedClassId, rows: csvRows })
                }}
              >
                <FileUp className='mr-2 h-4 w-4' />
                {importMutation.isPending ? 'Importing...' : 'Import valid rows'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={openManual} onOpenChange={setOpenManual}>
        <DialogContent className='rounded-2xl'>
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>Enter a student record manually.</DialogDescription>
          </DialogHeader>

          <form
            id='student-form'
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className='space-y-2'>
              <Label>Class</Label>
              <Select
                value={manualClassId ?? ''}
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
              {form.formState.errors.class_id ? (
                <p className='text-xs text-destructive'>{form.formState.errors.class_id.message}</p>
              ) : null}
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='admission_no'>Admission No</Label>
                <Input id='admission_no' {...form.register('admission_no')} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='sex'>Sex</Label>
                <Input id='sex' placeholder='M or F' {...form.register('sex')} />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='full_name'>Full Name</Label>
              <Input id='full_name' {...form.register('full_name')} />
              {form.formState.errors.full_name ? (
                <p className='text-xs text-destructive'>{form.formState.errors.full_name.message}</p>
              ) : null}
            </div>
          </form>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpenManual(false)}>
              Cancel
            </Button>
            <Button form='student-form' type='submit' className='rounded-xl' disabled={createMutation.isPending}>
              <Plus className='mr-2 h-4 w-4' />
              {createMutation.isPending ? 'Saving...' : 'Add student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete student?'
        description='This will remove student attempts tied to tests.'
        confirmLabel='Delete student'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
