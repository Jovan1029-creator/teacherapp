import { useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'

import { listClasses } from '@/api/classes'
import { listSchoolLessonPlans } from '@/api/lessonPlans'
import { listSubjects } from '@/api/subjects'
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
import type { LessonPlan } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const generatorFieldLabels: Record<string, string> = {
  date: 'Date',
  dayAndTime: 'Day and Time',
  period: 'Period',
  presentBoys: 'Present Boys',
  presentGirls: 'Present Girls',
  subtopic: 'Subtopic',
  reference: 'Reference',
  introductionTime: 'Introduction Time',
  introductionLearnersActivities: "Introduction Learners' Activities",
  introductionAssessment: 'Introduction Assessment',
  buildingTime: 'Building New Knowledge Time',
  buildingLearnersActivities: "Building New Knowledge Learners' Activities",
  conclusionTime: 'Conclusion Time',
  conclusionLearnersActivities: "Conclusion Learners' Activities",
  conclusionAssessment: 'Conclusion Assessment',
  lessonUnderstoodOrNot: 'Lesson understood or not',
  pupilsParticipation: "Pupils' participation",
  remarks: 'Remarks',
}

function sanitizeFileSegment(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'lesson-plan'
}

export default function AdminLessonPlansPage() {
  const lessonPlansQuery = useQuery({ queryKey: ['lesson-plans', 'school'], queryFn: listSchoolLessonPlans })
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects })
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)

  const columns = useMemo<DataTableColumn<LessonPlan>[]>(
    () => [
      {
        key: 'teacher',
        header: 'Teacher',
        render: (row) => row.teacher?.full_name ?? row.teacher_id,
      },
      {
        key: 'context',
        header: 'Class / Subject / Topic',
        render: (row) => (
          <button
            type='button'
            className='text-left hover:opacity-80'
            onClick={() => setSelectedPlan(row)}
          >
            <p className='font-medium'>
              {row.classroom?.name ?? '-'} | {row.subject?.name ?? '-'}
            </p>
            <p className='text-xs text-muted-foreground'>{row.topic?.title ?? 'No topic selected'}</p>
          </button>
        ),
      },
      {
        key: 'week',
        header: 'Week',
        render: (row) => row.week_no ?? '-',
      },
      {
        key: 'executed',
        header: 'Executed',
        render: (row) => (row.executed_at ? formatDate(row.executed_at) : 'Not executed'),
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => formatDate(row.created_at),
      },
      {
        key: 'objectives',
        header: 'Objectives',
        className: 'min-w-[280px]',
        render: (row) => <span className='line-clamp-2 text-sm'>{row.objectives ?? '-'}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[120px]',
        render: (row) => (
          <Button size='sm' variant='outline' className='rounded-lg' onClick={() => setSelectedPlan(row)}>
            <Eye className='mr-1 h-3.5 w-3.5' /> View
          </Button>
        ),
      },
    ],
    [],
  )

  const handleDownloadPdf = async () => {
    if (!selectedPlan) return
    if (!previewRef.current) {
      toast.error('Lesson plan preview not found')
      return
    }

    try {
      setIsDownloadingPdf(true)

      const canvas = await html2canvas(previewRef.current, {
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

      const teacherPart = sanitizeFileSegment(selectedPlan.teacher?.full_name ?? 'teacher')
      const subjectPart = sanitizeFileSegment(selectedPlan.subject?.name ?? 'subject')
      const datePart = selectedPlan.executed_at ?? selectedPlan.created_at.slice(0, 10)
      pdf.save(`lesson-plan-${teacherPart}-${subjectPart}-${datePart}.pdf`)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  if (lessonPlansQuery.isLoading || classesQuery.isLoading || subjectsQuery.isLoading) return <LoadingState />

  if (lessonPlansQuery.isError) {
    return (
      <EmptyState
        title='Lesson plans unavailable'
        description='Could not load teacher lesson plans. Check your connection and Supabase setup.'
      />
    )
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Lesson Plans'
        description='View lesson plans created by teachers in your school.'
      />

      {!lessonPlansQuery.data?.length ? (
        <EmptyState
          title='No lesson plans yet'
          description='Teacher-created lesson plans will appear here once they are saved.'
        />
      ) : (
        <DataTable
          data={lessonPlansQuery.data}
          columns={columns}
          searchKeys={['objectives', 'notes']}
          filters={[
            {
              id: 'teacher',
              label: 'Teacher',
              options: Array.from(
                new Map(
                  (lessonPlansQuery.data ?? [])
                    .filter((row) => row.teacher_id)
                    .map((row) => [row.teacher_id, row.teacher?.full_name ?? row.teacher_id]),
                ),
              ).map(([value, label]) => ({ value, label })),
              getValue: (row) => row.teacher_id,
            },
            {
              id: 'class',
              label: 'Class',
              options: (classesQuery.data ?? []).map((item) => ({ label: item.name, value: item.id })),
              getValue: (row) => row.class_id,
            },
            {
              id: 'subject',
              label: 'Subject',
              options: (subjectsQuery.data ?? []).map((item) => ({ label: item.name, value: item.id })),
              getValue: (row) => row.subject_id,
            },
          ]}
          emptyMessage='No lesson plans match the current filters.'
          pageSize={12}
        />
      )}

      <Dialog
        open={Boolean(selectedPlan)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null)
        }}
      >
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl'>
          <DialogHeader>
            <DialogTitle>Lesson Plan Details</DialogTitle>
            <DialogDescription>
              Read-only view of the teacher-submitted lesson plan. You can also download this view as PDF.
            </DialogDescription>
          </DialogHeader>

          {selectedPlan ? (
            (() => {
              const generatorEntries = Object.entries(selectedPlan.generator_fields ?? {})
                .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
                .map(([key, value]) => [generatorFieldLabels[key] ?? key, value] as const)

              return (
                <div
                  ref={previewRef}
                  className='space-y-6 rounded-2xl border bg-white p-6 text-black print:border-none print:p-0'
                >
                  <section className='space-y-2'>
                <h3 className='text-lg font-semibold'>Lesson Summary</h3>
                <div className='grid gap-2 text-sm md:grid-cols-2'>
                  <p>
                    <span className='font-semibold'>Teacher:</span> {selectedPlan.teacher?.full_name ?? selectedPlan.teacher_id}
                  </p>
                  <p>
                    <span className='font-semibold'>Phone:</span> {selectedPlan.teacher?.phone ?? '-'}
                  </p>
                  <p>
                    <span className='font-semibold'>Class:</span> {selectedPlan.classroom?.name ?? '-'}
                  </p>
                  <p>
                    <span className='font-semibold'>Subject:</span> {selectedPlan.subject?.name ?? '-'}
                  </p>
                  <p>
                    <span className='font-semibold'>Topic:</span> {selectedPlan.topic?.title ?? 'No topic selected'}
                  </p>
                  <p>
                    <span className='font-semibold'>Week:</span> {selectedPlan.week_no ?? '-'}
                  </p>
                  <p>
                    <span className='font-semibold'>Executed:</span>{' '}
                    {selectedPlan.executed_at ? formatDate(selectedPlan.executed_at) : 'Not executed'}
                  </p>
                  <p>
                    <span className='font-semibold'>Created:</span> {formatDate(selectedPlan.created_at)}
                  </p>
                  <p className='md:col-span-2'>
                    <span className='font-semibold'>Syllabus Ref:</span> {selectedPlan.topic?.syllabus_ref ?? '-'}
                  </p>
                </div>
                  </section>

                  <section className='space-y-3'>
                    <h3 className='text-lg font-semibold'>Objectives</h3>
                    <div className='min-h-10 rounded-xl border p-3 text-sm whitespace-pre-wrap'>
                      {selectedPlan.objectives?.trim() || '-'}
                    </div>
                  </section>

                  <section className='space-y-3'>
                    <h3 className='text-lg font-semibold'>Introduction</h3>
                    <div className='min-h-10 rounded-xl border p-3 text-sm whitespace-pre-wrap'>
                      {selectedPlan.introduction?.trim() || '-'}
                    </div>
                  </section>

                  <section className='space-y-3'>
                    <h3 className='text-lg font-semibold'>Activities</h3>
                    <div className='min-h-10 rounded-xl border p-3 text-sm whitespace-pre-wrap'>
                      {selectedPlan.activities?.trim() || '-'}
                    </div>
                  </section>

                  <section className='space-y-3'>
                    <h3 className='text-lg font-semibold'>Resources</h3>
                    <div className='min-h-10 rounded-xl border p-3 text-sm whitespace-pre-wrap'>
                      {selectedPlan.resources?.trim() || '-'}
                    </div>
                  </section>

                  <section className='space-y-3'>
                    <h3 className='text-lg font-semibold'>Assessment</h3>
                    <div className='min-h-10 rounded-xl border p-3 text-sm whitespace-pre-wrap'>
                      {selectedPlan.assessment?.trim() || '-'}
                    </div>
                  </section>

                  <section className='space-y-3'>
                    <h3 className='text-lg font-semibold'>Notes</h3>
                    <div className='min-h-10 rounded-xl border p-3 text-sm whitespace-pre-wrap'>
                      {selectedPlan.notes?.trim() || '-'}
                    </div>
                  </section>

                  {generatorEntries.length ? (
                    <section className='space-y-3'>
                      <h3 className='text-lg font-semibold'>Teaching Sheet Inputs (Saved)</h3>
                      <div className='grid gap-3 md:grid-cols-2'>
                        {generatorEntries.map(([label, value]) => (
                          <div key={label} className='rounded-xl border p-3'>
                            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                              {label}
                            </p>
                            <p className='mt-1 text-sm whitespace-pre-wrap'>{value}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )
            })()
          ) : null}

          <DialogFooter>
            <Button variant='outline' className='rounded-xl' onClick={() => setSelectedPlan(null)}>
              Close
            </Button>
            <Button className='rounded-xl' onClick={handleDownloadPdf} disabled={!selectedPlan || isDownloadingPdf}>
              {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
