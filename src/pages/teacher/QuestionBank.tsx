// src\pages\teacher\QuestionBank.tsx
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createQuestion, deleteQuestion, listMyQuestions, updateQuestion } from '@/api/questions'
import { listMyAssignedSubjects } from '@/api/subjects'
import { listTopics } from '@/api/topics'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Question } from '@/lib/types'

const schema = z.object({
  subject_id: z.string().min(1, 'Subject is required'),
  topic_id: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  question_text: z.string().min(5, 'Question text is required'),
  choice_a: z.string().min(1, 'Choice A is required'),
  choice_b: z.string().min(1, 'Choice B is required'),
  choice_c: z.string().min(1, 'Choice C is required'),
  choice_d: z.string().min(1, 'Choice D is required'),
  correct_answer: z.enum(['A', 'B', 'C', 'D']),
  marks: z.coerce.number().min(1).max(100).default(1),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function toChoices(values: FormValues) {
  return {
    A: values.choice_a,
    B: values.choice_b,
    C: values.choice_c,
    D: values.choice_d,
  }
}

export default function QuestionBankPage() {
  const queryClient = useQueryClient()

  const questionsQuery = useQuery({ queryKey: ['questions', 'mine'], queryFn: () => listMyQuestions() })
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'assigned'], queryFn: listMyAssignedSubjects })
  const topicsQuery = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [deleting, setDeleting] = useState<Question | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject_id: '',
      topic_id: '',
      difficulty: 'medium',
      question_text: '',
      choice_a: '',
      choice_b: '',
      choice_c: '',
      choice_d: '',
      correct_answer: 'A',
      marks: 1,
    },
  })
  const selectedSubjectId = useWatch({ control: form.control, name: 'subject_id' })
  const selectedTopicId = useWatch({ control: form.control, name: 'topic_id' })
  const selectedCorrectAnswer = useWatch({ control: form.control, name: 'correct_answer' })
  const selectedDifficulty = useWatch({ control: form.control, name: 'difficulty' })

  const createMutation = useMutation({
    mutationFn: createQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      toast.success('Question created')
      setOpen(false)
      form.reset()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      toast.success('Question updated')
      setOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      toast.success('Question deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const columns = useMemo<DataTableColumn<Question>[]>(
    () => [
      {
        key: 'question_text',
        header: 'Question',
        render: (row) => (
          <div>
            <p className='line-clamp-2 font-medium'>{row.question_text}</p>
            <p className='text-xs text-muted-foreground'>
              {row.subject?.name ?? '-'} | {row.topic?.title ?? 'No topic'}
            </p>
          </div>
        ),
      },
      {
        key: 'difficulty',
        header: 'Difficulty',
        render: (row) => row.difficulty,
      },
      {
        key: 'marks',
        header: 'Marks',
        render: (row) => row.marks,
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[200px]',
        render: (row) => (
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              className='rounded-lg'
              onClick={() => {
                const choices = row.choices as Record<string, string>
                setEditing(row)
                form.reset({
                  subject_id: row.subject_id,
                  topic_id: row.topic_id ?? '',
                  difficulty: row.difficulty,
                  question_text: row.question_text,
                  choice_a: choices.A ?? '',
                  choice_b: choices.B ?? '',
                  choice_c: choices.C ?? '',
                  choice_d: choices.D ?? '',
                  correct_answer: row.correct_answer as 'A' | 'B' | 'C' | 'D',
                  marks: row.marks,
                })
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

  if (questionsQuery.isLoading || subjectsQuery.isLoading || topicsQuery.isLoading) return <LoadingState />

  const visibleTopics = (topicsQuery.data ?? []).filter(
    (topic) => Boolean(selectedSubjectId) && topic.subject_id === selectedSubjectId,
  )

  return (
    <div>
      <PageHeader
        title='Question Bank'
        description='Maintain your reusable MCQ bank for tests and analytics.'
        actionLabel='Add question'
        onAction={() => {
          setEditing(null)
          form.reset({
            subject_id: '',
            topic_id: '',
            difficulty: 'medium',
            question_text: '',
            choice_a: '',
            choice_b: '',
            choice_c: '',
            choice_d: '',
            correct_answer: 'A',
            marks: 1,
          })
          setOpen(true)
        }}
      />

      {!questionsQuery.data?.length ? (
        <EmptyState
          title='No questions yet'
          description='Add MCQ questions to build your tests quickly.'
          actionLabel='Create question'
          onAction={() => setOpen(true)}
        />
      ) : (
        <DataTable
          data={questionsQuery.data}
          columns={columns}
          searchKeys={['question_text', 'correct_answer']}
          filters={[
            {
              id: 'subject',
              label: 'Subject',
              options: (subjectsQuery.data ?? []).map((subject) => ({ label: subject.name, value: subject.id })),
              getValue: (row) => row.subject_id,
            },
          ]}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit question' : 'Create MCQ question'}</DialogTitle>
            <DialogDescription>Provide four choices (A-D) and one correct answer.</DialogDescription>
          </DialogHeader>

          <form
            id='question-form'
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => {
              const payload = {
                subject_id: values.subject_id,
                topic_id: values.topic_id || undefined,
                difficulty: values.difficulty,
                question_text: values.question_text,
                choices: toChoices(values),
                correct_answer: values.correct_answer,
                marks: values.marks,
              }

              if (editing) {
                updateMutation.mutate({ id: editing.id, ...payload })
              } else {
                createMutation.mutate(payload)
              }
            })}
          >
            <div className='grid gap-4 md:grid-cols-2'>
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
              </div>

              <div className='space-y-2'>
                <Label>Topic</Label>
                <Select
                  value={selectedTopicId || '__none__'}
                  onValueChange={(value) => form.setValue('topic_id', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder='Optional topic' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>No topic</SelectItem>
                    {visibleTopics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='question_text'>Question text</Label>
              <Textarea id='question_text' rows={3} {...form.register('question_text')} />
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='choice_a'>Choice A</Label>
                <Input id='choice_a' {...form.register('choice_a')} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='choice_b'>Choice B</Label>
                <Input id='choice_b' {...form.register('choice_b')} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='choice_c'>Choice C</Label>
                <Input id='choice_c' {...form.register('choice_c')} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='choice_d'>Choice D</Label>
                <Input id='choice_d' {...form.register('choice_d')} />
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label>Correct answer</Label>
                <Select
                  value={selectedCorrectAnswer ?? 'A'}
                  onValueChange={(value: 'A' | 'B' | 'C' | 'D') =>
                    form.setValue('correct_answer', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='A'>A</SelectItem>
                    <SelectItem value='B'>B</SelectItem>
                    <SelectItem value='C'>C</SelectItem>
                    <SelectItem value='D'>D</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Difficulty</Label>
                <Select
                  value={selectedDifficulty ?? 'medium'}
                  onValueChange={(value: 'easy' | 'medium' | 'hard') =>
                    form.setValue('difficulty', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='easy'>Easy</SelectItem>
                    <SelectItem value='medium'>Medium</SelectItem>
                    <SelectItem value='hard'>Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='marks'>Marks</Label>
                <Input id='marks' type='number' min={1} {...form.register('marks')} />
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              form='question-form'
              type='submit'
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save changes' : 'Create question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete question?'
        description='Any tests using this question may lose linked items.'
        confirmLabel='Delete question'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
