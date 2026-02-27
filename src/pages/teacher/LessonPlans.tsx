// src\pages\teacher\LessonPlans.tsx
import { useMemo, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { listClasses } from '@/api/classes'
import {
  createLessonPlan,
  deleteLessonPlan,
  duplicateLessonPlan,
  listMyLessonPlans,
  setLessonPlanExecutedAt,
  updateLessonPlan,
} from '@/api/lessonPlans'
import { getSchool } from '@/api/schools'
import { listStudentsByClass } from '@/api/students'
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
import { useAuth } from '@/context/AuthContext'
import type { LessonPlan } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  class_id: z.string().min(1, 'Class is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  topic_id: z.string().optional(),
  week_no: z.coerce.number().optional(),
  executed_at: z.string().optional(),
  objectives: z.string().optional(),
  introduction: z.string().optional(),
  activities: z.string().optional(),
  resources: z.string().optional(),
  assessment: z.string().optional(),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface GeneratorFields extends Record<string, string> {
  date: string
  dayAndTime: string
  period: string
  presentBoys: string
  presentGirls: string
  subtopic: string
  reference: string
  introductionTime: string
  introductionLearnersActivities: string
  introductionAssessment: string
  buildingTime: string
  buildingLearnersActivities: string
  conclusionTime: string
  conclusionLearnersActivities: string
  conclusionAssessment: string
  lessonUnderstoodOrNot: string
  pupilsParticipation: string
  remarks: string
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
}

function toCount(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function sanitizeFileSegment(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'subject'
}

function getInitialGeneratorFields(row?: LessonPlan | null): GeneratorFields {
  const saved = ((row?.generator_fields ?? {}) as Partial<GeneratorFields>) ?? {}
  const fallbackDate = saved.date ?? row?.executed_at ?? getTodayDateString()
  const fallbackReference = saved.reference ?? row?.topic?.syllabus_ref ?? ''

  const defaults: GeneratorFields = {
    date: fallbackDate,
    dayAndTime: '',
    period: '',
    presentBoys: '',
    presentGirls: '',
    subtopic: '',
    reference: fallbackReference,
    introductionTime: '',
    introductionLearnersActivities: '',
    introductionAssessment: '',
    buildingTime: '',
    buildingLearnersActivities: '',
    conclusionTime: '',
    conclusionLearnersActivities: '',
    conclusionAssessment: '',
    lessonUnderstoodOrNot: '',
    pupilsParticipation: '',
    remarks: '',
  }

  return {
    ...defaults,
    ...saved,
    date: fallbackDate,
    reference: fallbackReference,
  }
}

export default function LessonPlansPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const lessonPlansQuery = useQuery({ queryKey: ['lesson-plans', 'mine'], queryFn: listMyLessonPlans })
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'assigned'], queryFn: listMyAssignedSubjects })
  const topicsQuery = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() })
  const schoolQuery = useQuery({ queryKey: ['school'], queryFn: getSchool })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LessonPlan | null>(null)
  const [deleting, setDeleting] = useState<LessonPlan | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [generatorFields, setGeneratorFields] = useState<GeneratorFields>(() => getInitialGeneratorFields())

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      class_id: '',
      subject_id: '',
      topic_id: '',
      week_no: undefined,
      executed_at: '',
      objectives: '',
      introduction: '',
      activities: '',
      resources: '',
      assessment: '',
      notes: '',
    },
  })
  const selectedFormClassId = useWatch({ control: form.control, name: 'class_id' })
  const selectedSubjectId = useWatch({ control: form.control, name: 'subject_id' })
  const selectedTopicId = useWatch({ control: form.control, name: 'topic_id' })
  const objectivesValue = useWatch({ control: form.control, name: 'objectives' })
  const resourcesValue = useWatch({ control: form.control, name: 'resources' })
  const introductionValue = useWatch({ control: form.control, name: 'introduction' })
  const activitiesValue = useWatch({ control: form.control, name: 'activities' })
  const assessmentValue = useWatch({ control: form.control, name: 'assessment' })
  const notesValue = useWatch({ control: form.control, name: 'notes' })

  const classStudentsQuery = useQuery({
    queryKey: ['students', 'lesson-plan', selectedFormClassId || '__none__'],
    queryFn: () => listStudentsByClass(selectedFormClassId),
    enabled: Boolean(selectedFormClassId),
  })

  const createMutation = useMutation({
    mutationFn: createLessonPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] })
      toast.success('Lesson plan created')
      setOpen(false)
      setEditing(null)
      form.reset({
        class_id: '',
        subject_id: '',
        topic_id: '',
        week_no: undefined,
        executed_at: '',
        objectives: '',
        introduction: '',
        activities: '',
        resources: '',
        assessment: '',
        notes: '',
      })
      setGeneratorFields(getInitialGeneratorFields())
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: updateLessonPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] })
      toast.success('Lesson plan updated')
      setOpen(false)
      setEditing(null)
      form.reset({
        class_id: '',
        subject_id: '',
        topic_id: '',
        week_no: undefined,
        executed_at: '',
        objectives: '',
        introduction: '',
        activities: '',
        resources: '',
        assessment: '',
        notes: '',
      })
      setGeneratorFields(getInitialGeneratorFields())
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLessonPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] })
      toast.success('Lesson plan deleted')
      setDeleting(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const duplicateMutation = useMutation({
    mutationFn: duplicateLessonPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] })
      toast.success('Lesson plan duplicated')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const executionMutation = useMutation({
    mutationFn: ({ id, executedAt }: { id: string; executedAt: string | null }) => setLessonPlanExecutedAt(id, executedAt),
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] })
      toast.success(variables.executedAt ? 'Lesson plan marked executed' : 'Execution status cleared')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const selectedClass = useMemo(
    () => (classesQuery.data ?? []).find((item) => item.id === selectedFormClassId) ?? null,
    [classesQuery.data, selectedFormClassId],
  )

  const selectedSubject = useMemo(
    () => (subjectsQuery.data ?? []).find((item) => item.id === selectedSubjectId) ?? null,
    [subjectsQuery.data, selectedSubjectId],
  )

  const selectedTopic = useMemo(
    () => (topicsQuery.data ?? []).find((item) => item.id === selectedTopicId) ?? null,
    [topicsQuery.data, selectedTopicId],
  )

  const enrolledCounts = useMemo(() => {
    if (!selectedFormClassId) {
      return { boys: 0, girls: 0, total: 0 }
    }

    const rows = classStudentsQuery.data ?? []
    let boys = 0
    let girls = 0

    rows.forEach((student) => {
      const sex = (student.sex ?? '').trim().toUpperCase()
      if (sex === 'M') boys += 1
      if (sex === 'F') girls += 1
    })

    return {
      boys,
      girls,
      total: rows.length,
    }
  }, [classStudentsQuery.data, selectedFormClassId])

  const presentBoys = toCount(generatorFields.presentBoys)
  const presentGirls = toCount(generatorFields.presentGirls)
  const presentTotal = presentBoys + presentGirls

  const columns = useMemo<DataTableColumn<LessonPlan>[]>(
    () => [
      {
        key: 'context',
        header: 'Context',
        render: (row) => (
          <div>
            <p className='font-medium'>{row.topic?.title ?? 'No topic selected'}</p>
            <p className='text-xs text-muted-foreground'>
              {row.classroom?.name ?? '-'} | {row.subject?.name ?? '-'}
            </p>
          </div>
        ),
      },
      {
        key: 'week_no',
        header: 'Week',
        render: (row) => row.week_no ?? '-',
      },
      {
        key: 'executed_at',
        header: 'Execution',
        render: (row) => (row.executed_at ? formatDate(row.executed_at) : 'Not executed'),
      },
      {
        key: 'objectives',
        header: 'Objectives',
        render: (row) => <span className='line-clamp-2 text-sm'>{row.objectives ?? '-'}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[420px]',
        render: (row) => (
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              variant='outline'
              className='rounded-lg'
              onClick={() => {
                setEditing(row)
                form.reset({
                  class_id: row.class_id,
                  subject_id: row.subject_id,
                  topic_id: row.topic_id ?? '',
                  week_no: row.week_no ?? undefined,
                  executed_at: row.executed_at ?? '',
                  objectives: row.objectives ?? '',
                  introduction: row.introduction ?? '',
                  activities: row.activities ?? '',
                  resources: row.resources ?? '',
                  assessment: row.assessment ?? '',
                  notes: row.notes ?? '',
                })
                setGeneratorFields(getInitialGeneratorFields(row))
                setOpen(true)
              }}
            >
              <Pencil className='mr-1 h-3.5 w-3.5' /> Edit
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='rounded-lg'
              disabled={executionMutation.isPending}
              onClick={() =>
                executionMutation.mutate({
                  id: row.id,
                  executedAt: row.executed_at ? null : getTodayDateString(),
                })
              }
            >
              {row.executed_at ? 'Clear Executed' : 'Mark Executed'}
            </Button>
            <Button
              size='sm'
              variant='secondary'
              className='rounded-lg'
              onClick={() => duplicateMutation.mutate(row.id)}
            >
              <Copy className='mr-1 h-3.5 w-3.5' /> Duplicate
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
    [form, duplicateMutation, executionMutation],
  )

  const onGeneratorFieldChange = (field: keyof GeneratorFields, value: string) => {
    setGeneratorFields((prev) => ({ ...prev, [field]: value }))
  }

  const handleDownloadPdf = async () => {
    const lessonPlanElement = document.getElementById('lesson-plan')
    if (!lessonPlanElement) {
      toast.error('Lesson plan preview not found')
      return
    }

    try {
      setIsDownloadingPdf(true)

      const canvas = await html2canvas(lessonPlanElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imageData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const contentWidth = pageWidth - margin * 2
      const contentHeight = pageHeight - margin * 2
      const imageHeight = (canvas.height * contentWidth) / canvas.width

      let remainingHeight = imageHeight
      let yPosition = margin

      pdf.addImage(imageData, 'PNG', margin, yPosition, contentWidth, imageHeight, undefined, 'FAST')
      remainingHeight -= contentHeight

      while (remainingHeight > 0) {
        pdf.addPage()
        yPosition = margin - (imageHeight - remainingHeight)
        pdf.addImage(imageData, 'PNG', margin, yPosition, contentWidth, imageHeight, undefined, 'FAST')
        remainingHeight -= contentHeight
      }

      const subjectPart = sanitizeFileSegment(selectedSubject?.name ?? editing?.subject?.name ?? 'subject')
      const datePart = generatorFields.date || getTodayDateString()
      pdf.save(`lesson-plan-${subjectPart}-${datePart}.pdf`)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  if (
    lessonPlansQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    topicsQuery.isLoading ||
    schoolQuery.isLoading
  ) {
    return <LoadingState />
  }

  const visibleTopics = (topicsQuery.data ?? []).filter(
    (topic) => Boolean(selectedSubjectId) && topic.subject_id === selectedSubjectId,
  )

  return (
    <div>
      <PageHeader
        title='Lesson Plans'
        description='Create and manage your lesson plans, then duplicate quickly for recurring weeks.'
        actionLabel='Create lesson plan'
        onAction={() => {
          setEditing(null)
          form.reset({
            class_id: '',
            subject_id: '',
            topic_id: '',
            week_no: undefined,
            executed_at: '',
            objectives: '',
            introduction: '',
            activities: '',
            resources: '',
            assessment: '',
            notes: '',
          })
          setGeneratorFields(getInitialGeneratorFields())
          setOpen(true)
        }}
      />

      {!lessonPlansQuery.data?.length ? (
        <EmptyState
          title='No lesson plans yet'
          description='Create your first lesson plan to organize classroom teaching.'
          actionLabel='Create lesson plan'
          onAction={() => {
            setEditing(null)
            form.reset({
              class_id: '',
              subject_id: '',
              topic_id: '',
              week_no: undefined,
              executed_at: '',
              objectives: '',
              introduction: '',
              activities: '',
              resources: '',
              assessment: '',
              notes: '',
            })
            setGeneratorFields(getInitialGeneratorFields())
            setOpen(true)
          }}
        />
      ) : (
        <DataTable
          data={lessonPlansQuery.data}
          columns={columns}
          searchKeys={['objectives', 'notes']}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto rounded-2xl'>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit lesson plan' : 'Create lesson plan'}</DialogTitle>
            <DialogDescription>Capture learning objectives, activities, and assessment notes.</DialogDescription>
          </DialogHeader>

          <form
            id='lesson-plan-form'
            className='space-y-5'
            onSubmit={form.handleSubmit((values) => {
              const payload = { ...values, generator_fields: generatorFields }
              if (editing) {
                updateMutation.mutate({ id: editing.id, ...payload })
              } else {
                createMutation.mutate(payload)
              }
            })}
          >
            <div className='grid gap-4 md:grid-cols-3'>
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
                  value={selectedSubjectId ?? ''}
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

              <div className='space-y-2'>
                <Label>Topic (optional)</Label>
                <Select
                  value={selectedTopicId || '__none__'}
                  onValueChange={(value) => form.setValue('topic_id', value === '__none__' ? '' : value)}
                >
                  <SelectTrigger className='rounded-xl'>
                    <SelectValue placeholder='Select topic' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>No topic</SelectItem>
                    {visibleTopics.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='week_no'>Week Number</Label>
                <Input id='week_no' type='number' min={1} {...form.register('week_no')} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='executed_at'>Executed on (optional)</Label>
                <Input id='executed_at' type='date' {...form.register('executed_at')} />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='objectives'>Objectives</Label>
              <Textarea id='objectives' rows={2} {...form.register('objectives')} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='introduction'>Introduction</Label>
              <Textarea id='introduction' rows={2} {...form.register('introduction')} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='activities'>Activities</Label>
              <Textarea id='activities' rows={3} {...form.register('activities')} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='resources'>Resources</Label>
              <Textarea id='resources' rows={2} {...form.register('resources')} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='assessment'>Assessment</Label>
              <Textarea id='assessment' rows={2} {...form.register('assessment')} />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='notes'>Notes</Label>
              <Textarea id='notes' rows={2} {...form.register('notes')} />
            </div>
          </form>

          <div className='space-y-5 rounded-2xl border p-4'>
            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='generator-date'>Date</Label>
                <Input
                  id='generator-date'
                  type='date'
                  value={generatorFields.date}
                  onChange={(event) => onGeneratorFieldChange('date', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-day-and-time'>Day and Time</Label>
                <Input
                  id='generator-day-and-time'
                  value={generatorFields.dayAndTime}
                  onChange={(event) => onGeneratorFieldChange('dayAndTime', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-period'>Period</Label>
                <Input
                  id='generator-period'
                  value={generatorFields.period}
                  onChange={(event) => onGeneratorFieldChange('period', event.target.value)}
                />
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='generator-present-boys'>Present Boys</Label>
                <Input
                  id='generator-present-boys'
                  type='number'
                  min={0}
                  value={generatorFields.presentBoys}
                  onChange={(event) => onGeneratorFieldChange('presentBoys', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-present-girls'>Present Girls</Label>
                <Input
                  id='generator-present-girls'
                  type='number'
                  min={0}
                  value={generatorFields.presentGirls}
                  onChange={(event) => onGeneratorFieldChange('presentGirls', event.target.value)}
                />
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='generator-subtopic'>Subtopic</Label>
                <Input
                  id='generator-subtopic'
                  value={generatorFields.subtopic}
                  onChange={(event) => onGeneratorFieldChange('subtopic', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-reference'>Reference</Label>
                <Input
                  id='generator-reference'
                  value={generatorFields.reference}
                  onChange={(event) => onGeneratorFieldChange('reference', event.target.value)}
                />
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Lesson Development Inputs</h4>
              <div className='grid gap-4 md:grid-cols-3'>
                <div className='space-y-2'>
                  <Label htmlFor='generator-introduction-time'>Introduction Time</Label>
                  <Input
                    id='generator-introduction-time'
                    value={generatorFields.introductionTime}
                    onChange={(event) => onGeneratorFieldChange('introductionTime', event.target.value)}
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='generator-introduction-learners'>Introduction Learners’ Activities</Label>
                  <Textarea
                    id='generator-introduction-learners'
                    rows={2}
                    value={generatorFields.introductionLearnersActivities}
                    onChange={(event) => onGeneratorFieldChange('introductionLearnersActivities', event.target.value)}
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-introduction-assessment'>Introduction Assessment</Label>
                <Textarea
                  id='generator-introduction-assessment'
                  rows={2}
                  value={generatorFields.introductionAssessment}
                  onChange={(event) => onGeneratorFieldChange('introductionAssessment', event.target.value)}
                />
              </div>

              <div className='grid gap-4 md:grid-cols-3'>
                <div className='space-y-2'>
                  <Label htmlFor='generator-building-time'>Building New Knowledge Time</Label>
                  <Input
                    id='generator-building-time'
                    value={generatorFields.buildingTime}
                    onChange={(event) => onGeneratorFieldChange('buildingTime', event.target.value)}
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='generator-building-learners'>Building New Knowledge Learners’ Activities</Label>
                  <Textarea
                    id='generator-building-learners'
                    rows={2}
                    value={generatorFields.buildingLearnersActivities}
                    onChange={(event) => onGeneratorFieldChange('buildingLearnersActivities', event.target.value)}
                  />
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-3'>
                <div className='space-y-2'>
                  <Label htmlFor='generator-conclusion-time'>Conclusion Time</Label>
                  <Input
                    id='generator-conclusion-time'
                    value={generatorFields.conclusionTime}
                    onChange={(event) => onGeneratorFieldChange('conclusionTime', event.target.value)}
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='generator-conclusion-learners'>Conclusion Learners’ Activities</Label>
                  <Textarea
                    id='generator-conclusion-learners'
                    rows={2}
                    value={generatorFields.conclusionLearnersActivities}
                    onChange={(event) => onGeneratorFieldChange('conclusionLearnersActivities', event.target.value)}
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-conclusion-assessment'>Conclusion Assessment</Label>
                <Textarea
                  id='generator-conclusion-assessment'
                  rows={2}
                  value={generatorFields.conclusionAssessment}
                  onChange={(event) => onGeneratorFieldChange('conclusionAssessment', event.target.value)}
                />
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium'>Teacher Evaluation Inputs</h4>
              <div className='space-y-2'>
                <Label htmlFor='generator-lesson-understood'>Lesson understood or not</Label>
                <Textarea
                  id='generator-lesson-understood'
                  rows={2}
                  value={generatorFields.lessonUnderstoodOrNot}
                  onChange={(event) => onGeneratorFieldChange('lessonUnderstoodOrNot', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-pupils-participation'>Pupils’ participation</Label>
                <Textarea
                  id='generator-pupils-participation'
                  rows={2}
                  value={generatorFields.pupilsParticipation}
                  onChange={(event) => onGeneratorFieldChange('pupilsParticipation', event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='generator-remarks'>Remarks</Label>
                <Textarea
                  id='generator-remarks'
                  rows={2}
                  value={generatorFields.remarks}
                  onChange={(event) => onGeneratorFieldChange('remarks', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div
            id='lesson-plan'
            className='space-y-6 rounded-2xl border bg-white p-6 text-black print:rounded-none print:border-none print:p-0'
          >
            <section className='space-y-3'>
              <h3 className='text-lg font-semibold'>HEADER</h3>
              <div className='space-y-2 text-sm'>
                <p>
                  <span className='font-semibold'>School Name:</span> {schoolQuery.data?.name ?? '-'}
                </p>
                <p>
                  <span className='font-semibold'>Teacher’s Name:</span> {profile?.full_name ?? '-'}
                </p>
                <p>
                  <span className='font-semibold'>Date:</span> {generatorFields.date || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Day and Time:</span> {generatorFields.dayAndTime || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Class:</span> {selectedClass?.name ?? '-'}
                </p>
                <p>
                  <span className='font-semibold'>Period:</span> {generatorFields.period || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Subject:</span> {selectedSubject?.name ?? '-'}
                </p>
                <p>
                  <span className='font-semibold'>Number of Students Enrolled (Boys, Girls, Total):</span>{' '}
                  {enrolledCounts.boys}, {enrolledCounts.girls}, {enrolledCounts.total}
                </p>
                <p>
                  <span className='font-semibold'>Number of Students Present (Boys, Girls, Total):</span> {presentBoys},{' '}
                  {presentGirls}, {presentTotal}
                </p>
              </div>
            </section>

            <section className='space-y-3'>
              <h3 className='text-lg font-semibold'>LESSON INFORMATION</h3>
              <div className='space-y-2 text-sm'>
                <p>
                  <span className='font-semibold'>Main Topic:</span> {selectedTopic?.title ?? '-'}
                </p>
                <p>
                  <span className='font-semibold'>Subtopic:</span> {generatorFields.subtopic || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Specific Objectives:</span> {objectivesValue || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Teaching/Learning Materials:</span> {resourcesValue || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Reference:</span> {generatorFields.reference || '-'}
                </p>
              </div>
            </section>

            <section className='space-y-3'>
              <h3 className='text-lg font-semibold'>LESSON DEVELOPMENT TABLE</h3>
              <div className='overflow-x-auto'>
                <table className='w-full border-collapse text-sm'>
                  <thead>
                    <tr>
                      <th className='border border-black px-3 py-2 text-left'>Steps/Stage</th>
                      <th className='border border-black px-3 py-2 text-left'>Time</th>
                      <th className='border border-black px-3 py-2 text-left'>Teacher’s Activities</th>
                      <th className='border border-black px-3 py-2 text-left'>Learners’ Activities</th>
                      <th className='border border-black px-3 py-2 text-left'>Assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className='border border-black px-3 py-2 font-medium'>Introduction</td>
                      <td className='border border-black px-3 py-2'>{generatorFields.introductionTime || '-'}</td>
                      <td className='border border-black px-3 py-2'>{introductionValue || '-'}</td>
                      <td className='border border-black px-3 py-2'>
                        {generatorFields.introductionLearnersActivities || '-'}
                      </td>
                      <td className='border border-black px-3 py-2'>{generatorFields.introductionAssessment || '-'}</td>
                    </tr>
                    <tr>
                      <td className='border border-black px-3 py-2 font-medium'>Building New Knowledge</td>
                      <td className='border border-black px-3 py-2'>{generatorFields.buildingTime || '-'}</td>
                      <td className='border border-black px-3 py-2'>{activitiesValue || '-'}</td>
                      <td className='border border-black px-3 py-2'>
                        {generatorFields.buildingLearnersActivities || '-'}
                      </td>
                      <td className='border border-black px-3 py-2'>{assessmentValue || '-'}</td>
                    </tr>
                    <tr>
                      <td className='border border-black px-3 py-2 font-medium'>Conclusion</td>
                      <td className='border border-black px-3 py-2'>{generatorFields.conclusionTime || '-'}</td>
                      <td className='border border-black px-3 py-2'>{notesValue || '-'}</td>
                      <td className='border border-black px-3 py-2'>
                        {generatorFields.conclusionLearnersActivities || '-'}
                      </td>
                      <td className='border border-black px-3 py-2'>{generatorFields.conclusionAssessment || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className='space-y-3'>
              <h3 className='text-lg font-semibold'>TEACHER’S EVALUATION</h3>
              <div className='space-y-2 text-sm'>
                <p>
                  <span className='font-semibold'>Lesson understood or not:</span> {generatorFields.lessonUnderstoodOrNot || '-'}
                </p>
                <p>
                  <span className='font-semibold'>Pupils’ participation:</span> {generatorFields.pupilsParticipation || '-'}
                </p>
              </div>
            </section>

            <section className='space-y-3'>
              <h3 className='text-lg font-semibold'>REMARKS</h3>
              <p className='min-h-6 text-sm'>{generatorFields.remarks || '-'}</p>
            </section>
          </div>

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type='button'
              variant='secondary'
              className='rounded-xl'
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              Download PDF
            </Button>
            <Button
              form='lesson-plan-form'
              type='submit'
              className='rounded-xl'
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title='Delete lesson plan?'
        description='This action cannot be undone.'
        confirmLabel='Delete plan'
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </div>
  )
}
