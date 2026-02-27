// src\pages\admin\Assignments.tsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { listClasses } from '@/api/classes'
import { listSubjects } from '@/api/subjects'
import { createAssignment, deleteAssignment, listAssignments } from '@/api/teacherSubjects'
import { listTeachers } from '@/api/users'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TeacherSubject } from '@/lib/types'

export default function AssignmentsPage() {
  const queryClient = useQueryClient()

  const assignmentsQuery = useQuery({ queryKey: ['assignments'], queryFn: listAssignments })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: listTeachers })
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects })
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })

  const [teacherId, setTeacherId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [classId, setClassId] = useState('')
  const [deleting, setDeleting] = useState<TeacherSubject | null>(null)

  const createMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success('Assignment created')
      setTeacherId('')
      setSubjectId('')
      setClassId('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success('Assignment removed')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<DataTableColumn<TeacherSubject>[]>(
    () => [
      { key: 'teacher', header: 'Teacher', render: (row) => row.teacher?.full_name ?? '-' },
      { key: 'subject', header: 'Subject', render: (row) => row.subject?.name ?? '-' },
      { key: 'classroom', header: 'Class', render: (row) => row.classroom?.name ?? '-' },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[120px]',
        render: (row) => (
          <Button size='sm' variant='destructive' className='rounded-lg' onClick={() => setDeleting(row)}>
            Remove
          </Button>
        ),
      },
    ],
    [],
  )

  if (assignmentsQuery.isLoading || teachersQuery.isLoading || subjectsQuery.isLoading || classesQuery.isLoading) {
    return <LoadingState />
  }

  return (
    <div className='space-y-6'>
      <PageHeader title='Assignments' description='Assign teachers to class and subject combinations.' />

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardContent className='grid gap-4 p-6 md:grid-cols-4'>
          <div className='space-y-2'>
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger className='rounded-xl'>
                <SelectValue placeholder='Select teacher' />
              </SelectTrigger>
              <SelectContent>
                {(teachersQuery.data ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
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
          </div>

          <div className='space-y-2'>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className='rounded-xl'>
                <SelectValue placeholder='Select class' />
              </SelectTrigger>
              <SelectContent>
                {(classesQuery.data ?? []).map((classroom) => (
                  <SelectItem key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-end'>
            <Button
              className='w-full rounded-xl'
              disabled={!teacherId || !subjectId || !classId || createMutation.isPending}
              onClick={() => createMutation.mutate({ teacher_id: teacherId, subject_id: subjectId, class_id: classId })}
            >
              {createMutation.isPending ? 'Assigning...' : 'Create assignment'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!assignmentsQuery.data?.length ? (
        <EmptyState
          title='No assignments yet'
          description='Assign at least one teacher to a class-subject pair.'
        />
      ) : (
        <DataTable
          data={assignmentsQuery.data}
          columns={columns}
          searchKeys={[]}
          filters={[
            {
              id: 'teacher',
              label: 'Teacher',
              options: (teachersQuery.data ?? []).map((teacher) => ({ label: teacher.full_name, value: teacher.id })),
              getValue: (row) => row.teacher_id,
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Remove assignment?'
        description='The teacher will no longer appear for this class-subject pairing.'
        confirmLabel='Remove'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
