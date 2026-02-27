import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ClipboardList, Download, GraduationCap, Printer, School, UserCheck, Users } from 'lucide-react'

import { listClasses } from '@/api/classes'
import { listSchoolExamTimetable } from '@/api/examTimetable'
import { getSchool } from '@/api/schools'
import { listStudentsByClass } from '@/api/students'
import { listSubjects } from '@/api/subjects'
import { listAssignments } from '@/api/teacherSubjects'
import { listTeachers } from '@/api/users'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/csv'
import { formatDate } from '@/lib/utils'
import { printReportHtml } from '@/print/reports'

const ALL_CLASSES = '__all__'

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function countStudentsBySex(rows: Array<{ sex?: string | null }>) {
  let female = 0
  let male = 0

  for (const row of rows) {
    const sex = (row.sex ?? '').toUpperCase()
    if (sex === 'F') female += 1
    else if (sex === 'M') male += 1
  }

  return { female, male }
}

function slugifyFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report'
}

function nowDateSuffix() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function AdminReportsPage() {
  const [classFilterId, setClassFilterId] = useState(ALL_CLASSES)

  const schoolQuery = useQuery({
    queryKey: ['school', 'profile'],
    queryFn: getSchool,
  })
  const classesQuery = useQuery({
    queryKey: ['classes', 'school'],
    queryFn: listClasses,
  })
  const subjectsQuery = useQuery({
    queryKey: ['subjects', 'school'],
    queryFn: listSubjects,
  })
  const teachersQuery = useQuery({
    queryKey: ['teachers', 'school'],
    queryFn: listTeachers,
  })
  const studentsQuery = useQuery({
    queryKey: ['students', 'school', 'reports'],
    queryFn: () => listStudentsByClass(),
  })
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', 'school', 'reports'],
    queryFn: listAssignments,
  })
  const timetableQuery = useQuery({
    queryKey: ['exam-timetable', 'school', 'reports'],
    queryFn: listSchoolExamTimetable,
  })

  const isLoading =
    schoolQuery.isLoading ||
    classesQuery.isLoading ||
    subjectsQuery.isLoading ||
    teachersQuery.isLoading ||
    studentsQuery.isLoading ||
    assignmentsQuery.isLoading ||
    timetableQuery.isLoading

  if (isLoading) return <LoadingState label='Loading reports workspace...' />

  if (
    schoolQuery.isError ||
    classesQuery.isError ||
    subjectsQuery.isError ||
    teachersQuery.isError ||
    studentsQuery.isError ||
    assignmentsQuery.isError ||
    timetableQuery.isError
  ) {
    return (
      <EmptyState
        title='Reports unavailable'
        description='Could not load school data needed for printable reports. Please try again shortly.'
        icon={ClipboardList}
      />
    )
  }

  const school = schoolQuery.data
  const classes = classesQuery.data ?? []
  const subjects = subjectsQuery.data ?? []
  const teachers = teachersQuery.data ?? []
  const students = studentsQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []
  const timetableEntries = timetableQuery.data ?? []

  const validClassFilterId = classFilterId === ALL_CLASSES || classes.some((row) => row.id === classFilterId)
    ? classFilterId
    : ALL_CLASSES

  const selectedClassId = validClassFilterId === ALL_CLASSES ? '' : validClassFilterId
  const selectedClass = classes.find((row) => row.id === selectedClassId) ?? null
  const selectedClassName = selectedClass?.name ?? 'All classes'

  const classOptions = classes.map((row) => ({ value: row.id, label: row.name }))

  const studentsForSelectedClass = selectedClassId
    ? students.filter((student) => student.class_id === selectedClassId)
    : []

  const timetableInScope = selectedClassId
    ? timetableEntries.filter((entry) => entry.class_id === selectedClassId)
    : timetableEntries

  const sortedAssignments = [...assignments].sort((a, b) => {
    const teacherCmp = (a.teacher?.full_name ?? '').localeCompare(b.teacher?.full_name ?? '')
    if (teacherCmp !== 0) return teacherCmp
    const classCmp = (a.classroom?.name ?? '').localeCompare(b.classroom?.name ?? '')
    if (classCmp !== 0) return classCmp
    return (a.subject?.name ?? '').localeCompare(b.subject?.name ?? '')
  })

  const sortedTimetableEntries = [...timetableInScope].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )

  const { female: femaleStudents, male: maleStudents } = countStudentsBySex(studentsForSelectedClass)

  const schoolName = school?.name?.trim() || 'School'
  const fileDate = nowDateSuffix()

  const printFullReport = () => {
    const classScopeLabel = selectedClassId ? selectedClassName : 'All classes'
    const studentClassesInScope = (selectedClassId ? classes.filter((row) => row.id === selectedClassId) : classes).map(
      (classroom) => ({
        classroom,
        students: students
          .filter((student) => student.class_id === classroom.id)
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      }),
    )

    const studentsInScope = selectedClassId
      ? students.filter((student) => student.class_id === selectedClassId)
      : students

    const { female: totalFemaleInScope, male: totalMaleInScope } = countStudentsBySex(studentsInScope)

    const studentRegisterSections = studentClassesInScope
      .filter((bucket) => bucket.students.length > 0)
      .map((bucket) => {
        const sexCounts = countStudentsBySex(bucket.students)
        return {
          title: `Student Register - ${bucket.classroom.name}`,
          summaryItems: [
            { label: 'Class', value: bucket.classroom.name },
            { label: 'Students', value: bucket.students.length },
            { label: 'Female', value: sexCounts.female },
            { label: 'Male', value: sexCounts.male },
          ],
          tables: [
            {
              columns: ['No.', 'Admission No', 'Full Name', 'Sex', 'Created'],
              rows: bucket.students.map((student, index) => [
                index + 1,
                student.admission_no ?? '-',
                student.full_name,
                student.sex ?? '-',
                formatDate(student.created_at),
              ]),
            },
          ],
        }
      })

    printReportHtml({
      schoolName,
      title: selectedClassId ? `${selectedClassName} Full Administrative Report` : 'School Full Administrative Report',
      subtitle: 'Combined report pack for printing, filing, and sharing',
      filterSummary: `Class scope: ${classScopeLabel}`,
      sections: [
        {
          title: 'Executive Summary',
          paragraphs: [
            'This full report pack combines operational school records into a single printable document.',
            'Analytics and performance trend dashboards remain separate and are not included in this pack.',
          ],
          summaryItems: [
            { label: 'School', value: schoolName },
            { label: 'Class Scope', value: classScopeLabel },
            { label: 'Teachers', value: teachers.length },
            { label: 'Students (Scope)', value: studentsInScope.length },
            { label: 'Female (Scope)', value: totalFemaleInScope },
            { label: 'Male (Scope)', value: totalMaleInScope },
            { label: 'Assignments', value: sortedAssignments.length },
            { label: 'Timetable Entries (Scope)', value: sortedTimetableEntries.length },
          ],
        },
        {
          title: 'School Profile',
          summaryItems: [
            { label: 'School', value: schoolName },
            { label: 'Region', value: school?.region ?? '-' },
            { label: 'District', value: school?.district ?? '-' },
            { label: 'Phone', value: school?.phone ?? '-' },
            { label: 'Classes', value: classes.length },
            { label: 'Subjects', value: subjects.length },
          ],
        },
        {
          title: 'Class Directory',
          tables: [
            {
              columns: ['No.', 'Class', 'Year', 'Students', 'Created'],
              rows: classes.map((row, index) => [
                index + 1,
                row.name,
                row.year ?? '-',
                students.filter((student) => student.class_id === row.id).length,
                formatDate(row.created_at),
              ]),
            },
          ],
        },
        {
          title: 'Subject Directory',
          tables: [
            {
              columns: ['No.', 'Subject', 'Created'],
              rows: subjects.map((row, index) => [index + 1, row.name, formatDate(row.created_at)]),
            },
          ],
        },
        {
          title: 'Teacher Directory',
          tables: [
            {
              columns: ['No.', 'Teacher', 'Phone', 'Created'],
              rows: teachers.map((row, index) => [index + 1, row.full_name, row.phone ?? '-', formatDate(row.created_at)]),
            },
          ],
        },
        {
          title: 'Teacher Assignment Register',
          summaryItems: [
            { label: 'Assignments', value: sortedAssignments.length },
            { label: 'Teachers Assigned', value: new Set(sortedAssignments.map((row) => row.teacher_id)).size },
            { label: 'Classes Covered', value: new Set(sortedAssignments.map((row) => row.class_id)).size },
            { label: 'Subjects Covered', value: new Set(sortedAssignments.map((row) => row.subject_id)).size },
          ],
          tables: [
            {
              columns: ['No.', 'Teacher', 'Class', 'Subject', 'Assigned'],
              rows: sortedAssignments.map((assignment, index) => [
                index + 1,
                assignment.teacher?.full_name ?? 'Teacher',
                assignment.classroom?.name ?? 'Class',
                assignment.subject?.name ?? 'Subject',
                formatDate(assignment.created_at),
              ]),
            },
          ],
        },
        {
          title: 'Exam Timetable Report',
          summaryItems: [
            { label: 'Scope', value: classScopeLabel },
            { label: 'Entries', value: sortedTimetableEntries.length },
            { label: 'Classes in Scope', value: new Set(sortedTimetableEntries.map((entry) => entry.class_id)).size },
            { label: 'Subjects in Scope', value: new Set(sortedTimetableEntries.map((entry) => entry.subject_id)).size },
          ],
          tables: [
            {
              columns: ['No.', 'Date', 'Time', 'Class', 'Subject', 'Exam', 'Teacher', 'Venue', 'Term'],
              rows: sortedTimetableEntries.map((entry, index) => [
                index + 1,
                formatDate(entry.exam_date ?? entry.starts_at),
                formatTime(entry.starts_at),
                entry.classroom?.name ?? 'Class',
                entry.subject?.name ?? 'Subject',
                entry.title,
                entry.teacher?.full_name ?? 'Teacher',
                entry.venue ?? '-',
                entry.term ?? '-',
              ]),
              note: selectedClassId
                ? `Filtered to ${selectedClassName}.`
                : 'School-wide exam timetable entries in chronological order.',
            },
          ],
        },
        ...(studentRegisterSections.length
          ? studentRegisterSections
          : [
              {
                title: 'Student Registers',
                paragraphs: [
                  selectedClassId
                    ? `No students were found in ${selectedClassName}.`
                    : 'No students were found in the current school records.',
                ],
              },
            ]),
      ],
    })
  }

  const printStudentRegister = () => {
    if (!selectedClassId || !studentsForSelectedClass.length) return

    printReportHtml({
      schoolName,
      title: `${selectedClassName} Student Register`,
      subtitle: 'Administrative class register report',
      filterSummary: `Class: ${selectedClassName}`,
      sections: [
        {
          title: 'Class Summary',
          summaryItems: [
            { label: 'Class', value: selectedClassName },
            { label: 'Students', value: studentsForSelectedClass.length },
            { label: 'Female', value: femaleStudents },
            { label: 'Male', value: maleStudents },
          ],
          tables: [
            {
              title: 'Students',
              columns: ['No.', 'Admission No', 'Full Name', 'Sex', 'Created'],
              rows: studentsForSelectedClass.map((student, index) => [
                index + 1,
                student.admission_no ?? '-',
                student.full_name,
                student.sex ?? '-',
                formatDate(student.created_at),
              ]),
            },
          ],
        },
      ],
    })
  }

  const downloadStudentRegisterCsv = () => {
    if (!selectedClassId || !studentsForSelectedClass.length) return

    downloadCsv(
      `student-register-${slugifyFilenamePart(selectedClassName)}-${fileDate}.csv`,
      studentsForSelectedClass.map((student) => ({
        class_name: selectedClassName,
        admission_no: student.admission_no ?? '',
        full_name: student.full_name,
        sex: student.sex ?? '',
        created_at: student.created_at,
      })),
    )
  }

  const printAssignmentReport = () => {
    printReportHtml({
      schoolName,
      title: 'Teacher Assignment Register',
      subtitle: 'School-wide subject and class assignments',
      sections: [
        {
          title: 'Assignment Summary',
          summaryItems: [
            { label: 'Teachers', value: teachers.length },
            { label: 'Classes', value: classes.length },
            { label: 'Subjects', value: subjects.length },
            { label: 'Assignments', value: sortedAssignments.length },
          ],
          tables: [
            {
              title: 'Assignments',
              columns: ['No.', 'Teacher', 'Class', 'Subject', 'Assigned'],
              rows: sortedAssignments.map((assignment, index) => [
                index + 1,
                assignment.teacher?.full_name ?? 'Teacher',
                assignment.classroom?.name ?? 'Class',
                assignment.subject?.name ?? 'Subject',
                formatDate(assignment.created_at),
              ]),
              note: 'Generated from the Assignments page records.',
            },
          ],
        },
      ],
    })
  }

  const downloadAssignmentCsv = () => {
    downloadCsv(
      `teacher-assignments-${fileDate}.csv`,
      sortedAssignments.map((assignment) => ({
        teacher_name: assignment.teacher?.full_name ?? '',
        class_name: assignment.classroom?.name ?? '',
        subject_name: assignment.subject?.name ?? '',
        assigned_at: assignment.created_at,
      })),
    )
  }

  const printTimetableReport = () => {
    printReportHtml({
      schoolName,
      title: selectedClassId ? `${selectedClassName} Exam Timetable Report` : 'School Exam Timetable Report',
      subtitle: 'Official timetable schedule report',
      filterSummary: selectedClassId ? `Class: ${selectedClassName}` : 'Class: All classes',
      sections: [
        {
          title: 'Timetable Summary',
          summaryItems: [
            { label: 'Entries', value: sortedTimetableEntries.length },
            { label: 'Classes in Scope', value: new Set(sortedTimetableEntries.map((entry) => entry.class_id)).size },
            { label: 'Subjects in Scope', value: new Set(sortedTimetableEntries.map((entry) => entry.subject_id)).size },
          ],
          tables: [
            {
              title: 'Exam Schedule',
              columns: ['No.', 'Date', 'Time', 'Class', 'Subject', 'Exam', 'Teacher', 'Venue', 'Term'],
              rows: sortedTimetableEntries.map((entry, index) => [
                index + 1,
                formatDate(entry.exam_date ?? entry.starts_at),
                formatTime(entry.starts_at),
                entry.classroom?.name ?? 'Class',
                entry.subject?.name ?? 'Subject',
                entry.title,
                entry.teacher?.full_name ?? 'Teacher',
                entry.venue ?? '-',
                entry.term ?? '-',
              ]),
            },
          ],
        },
      ],
    })
  }

  const downloadTimetableCsv = () => {
    downloadCsv(
      `${selectedClassId ? `exam-timetable-${slugifyFilenamePart(selectedClassName)}` : 'exam-timetable-school'}-${fileDate}.csv`,
      sortedTimetableEntries.map((entry) => ({
        exam_date: entry.exam_date ?? '',
        starts_at: entry.starts_at,
        duration_minutes: entry.duration_minutes,
        class_name: entry.classroom?.name ?? '',
        subject_name: entry.subject?.name ?? '',
        exam_title: entry.title,
        teacher_name: entry.teacher?.full_name ?? '',
        venue: entry.venue ?? '',
        term: entry.term ?? '',
        notes: entry.notes ?? '',
      })),
    )
  }

  const printSchoolSetupSnapshot = () => {
    printReportHtml({
      schoolName,
      title: 'School Setup Snapshot',
      subtitle: 'Administrative setup and directory report',
      sections: [
        {
          title: 'School Profile',
          summaryItems: [
            { label: 'School', value: schoolName },
            { label: 'Region', value: school?.region ?? '-' },
            { label: 'District', value: school?.district ?? '-' },
            { label: 'Phone', value: school?.phone ?? '-' },
            { label: 'Teachers', value: teachers.length },
            { label: 'Students', value: students.length },
            { label: 'Classes', value: classes.length },
            { label: 'Subjects', value: subjects.length },
          ],
        },
        {
          title: 'Classes',
          tables: [
            {
              columns: ['No.', 'Class', 'Year', 'Created'],
              rows: classes.map((row, index) => [index + 1, row.name, row.year ?? '-', formatDate(row.created_at)]),
            },
          ],
        },
        {
          title: 'Subjects',
          tables: [
            {
              columns: ['No.', 'Subject', 'Created'],
              rows: subjects.map((row, index) => [index + 1, row.name, formatDate(row.created_at)]),
            },
          ],
        },
        {
          title: 'Teachers',
          tables: [
            {
              columns: ['No.', 'Teacher', 'Phone', 'Created'],
              rows: teachers.map((row, index) => [index + 1, row.full_name, row.phone ?? '-', formatDate(row.created_at)]),
            },
          ],
        },
      ],
    })
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Reports'
        description='Printable operational reports and exports for administration. Analytics remains separate for trends and performance insights.'
        actionLabel='Print Full Report'
        onAction={printFullReport}
      />

      <Card className='rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle>Report Scope</CardTitle>
          <CardDescription>
            Choose a class to prepare class-specific registers and timetable reports, or leave All classes for school-wide reports.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-[minmax(220px,360px)_1fr] md:items-end'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Class filter</label>
            <Select value={validClassFilterId} onValueChange={setClassFilterId}>
              <SelectTrigger className='rounded-xl'>
                <SelectValue placeholder='All classes' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
                {classOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className='text-sm text-muted-foreground'>
            Current scope: <span className='font-medium text-foreground'>{selectedClassName}</span>. Reports on this page are
            designed for printing and record-keeping. Use the Analytics page for score trends, comparisons, and performance
            analysis.
          </p>
        </CardContent>
      </Card>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Teachers' value={teachers.length} icon={Users} />
        <StatCard label='Students' value={students.length} icon={GraduationCap} />
        <StatCard label='Assignments' value={assignments.length} icon={UserCheck} />
        <StatCard label='Timetable Entries' value={timetableEntries.length} icon={CalendarClock} />
      </div>

      <div className='grid gap-6 xl:grid-cols-2'>
        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Student Register</CardTitle>
              <CardDescription>Class-based printable register and CSV export for student roll management.</CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                className='rounded-xl'
                onClick={downloadStudentRegisterCsv}
                disabled={!selectedClassId || studentsForSelectedClass.length === 0}
              >
                <Download className='mr-2 h-4 w-4' />
                CSV
              </Button>
              <Button
                className='rounded-xl'
                onClick={printStudentRegister}
                disabled={!selectedClassId || studentsForSelectedClass.length === 0}
              >
                <Printer className='mr-2 h-4 w-4' />
                Print
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!selectedClassId ? (
              <EmptyState
                title='Choose a class for a register'
                description='Select a class in Report Scope to preview and print that class student register.'
                icon={GraduationCap}
              />
            ) : !studentsForSelectedClass.length ? (
              <EmptyState
                title='No students in this class'
                description='Add students to this class first, then return here to print the register.'
                icon={GraduationCap}
              />
            ) : (
              <>
                <div className='grid gap-4 sm:grid-cols-3'>
                  <StatCard label='Class Students' value={studentsForSelectedClass.length} icon={GraduationCap} />
                  <StatCard label='Female' value={femaleStudents} icon={GraduationCap} />
                  <StatCard label='Male' value={maleStudents} icon={GraduationCap} />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-16'>No.</TableHead>
                      <TableHead className='w-28'>Adm No</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className='w-16'>Sex</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsForSelectedClass.slice(0, 12).map((student, index) => (
                      <TableRow key={student.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{student.admission_no ?? '-'}</TableCell>
                        <TableCell className='font-medium'>{student.full_name}</TableCell>
                        <TableCell>{student.sex ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {studentsForSelectedClass.length > 12 ? (
                  <p className='text-xs text-muted-foreground'>
                    Showing first 12 students. Use Print or CSV for the full class register.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Teacher Assignment Register</CardTitle>
              <CardDescription>Operational report of teacher-to-class-to-subject assignments.</CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button variant='outline' className='rounded-xl' onClick={downloadAssignmentCsv} disabled={!sortedAssignments.length}>
                <Download className='mr-2 h-4 w-4' />
                CSV
              </Button>
              <Button className='rounded-xl' onClick={printAssignmentReport} disabled={!sortedAssignments.length}>
                <Printer className='mr-2 h-4 w-4' />
                Print
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!sortedAssignments.length ? (
              <EmptyState
                title='No assignments yet'
                description='Create teacher assignments to generate an assignment register report.'
                icon={UserCheck}
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className='w-28'>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAssignments.slice(0, 12).map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className='font-medium'>{assignment.teacher?.full_name ?? 'Teacher'}</TableCell>
                        <TableCell>{assignment.classroom?.name ?? 'Class'}</TableCell>
                        <TableCell>{assignment.subject?.name ?? 'Subject'}</TableCell>
                        <TableCell>{formatDate(assignment.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {sortedAssignments.length > 12 ? (
                  <p className='mt-2 text-xs text-muted-foreground'>
                    Showing first 12 rows. Use Print or CSV for the full assignment register.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 xl:grid-cols-2'>
        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Exam Timetable Report</CardTitle>
              <CardDescription>
                Printable timetable report for {selectedClassId ? selectedClassName : 'all classes'}.
              </CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button variant='outline' className='rounded-xl' onClick={downloadTimetableCsv} disabled={!sortedTimetableEntries.length}>
                <Download className='mr-2 h-4 w-4' />
                CSV
              </Button>
              <Button className='rounded-xl' onClick={printTimetableReport} disabled={!sortedTimetableEntries.length}>
                <Printer className='mr-2 h-4 w-4' />
                Print
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!sortedTimetableEntries.length ? (
              <EmptyState
                title='No timetable entries in scope'
                description='Create exam timetable entries, or switch class scope to view school-wide schedule records.'
                icon={CalendarClock}
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-40'>Start</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Exam</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTimetableEntries.slice(0, 10).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDateTime(entry.starts_at)}</TableCell>
                        <TableCell>{entry.classroom?.name ?? 'Class'}</TableCell>
                        <TableCell>{entry.subject?.name ?? 'Subject'}</TableCell>
                        <TableCell className='font-medium'>{entry.title}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {sortedTimetableEntries.length > 10 ? (
                  <p className='mt-2 text-xs text-muted-foreground'>
                    Showing first 10 rows. Use Print or CSV for the full timetable report.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className='rounded-3xl border-none shadow-sm'>
          <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>School Setup Snapshot</CardTitle>
              <CardDescription>
                Print a consolidated administrative snapshot (school profile, classes, subjects, and teacher directory).
              </CardDescription>
            </div>
            <Button className='rounded-xl' onClick={printSchoolSetupSnapshot}>
              <Printer className='mr-2 h-4 w-4' />
              Print Snapshot
            </Button>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='rounded-2xl border p-4'>
              <div className='mb-3 flex items-center gap-2 font-medium'>
                <School className='h-4 w-4 text-primary' />
                {schoolName}
              </div>
              <div className='grid gap-2 text-sm text-muted-foreground sm:grid-cols-2'>
                <p>Region: {school?.region ?? '-'}</p>
                <p>District: {school?.district ?? '-'}</p>
                <p>Phone: {school?.phone ?? '-'}</p>
                <p>Created: {formatDate(school?.created_at)}</p>
              </div>
            </div>

            <div className='grid gap-4 sm:grid-cols-3'>
              <StatCard label='Classes' value={classes.length} icon={ClipboardList} />
              <StatCard label='Subjects' value={subjects.length} icon={ClipboardList} />
              <StatCard label='Teachers' value={teachers.length} icon={Users} />
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div>
                <h3 className='mb-2 text-sm font-semibold'>Classes (preview)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead className='w-16'>Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.slice(0, 8).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className='font-medium'>{row.name}</TableCell>
                        <TableCell>{row.year ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className='mb-2 text-sm font-semibold'>Teachers (preview)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead className='w-28'>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.slice(0, 8).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className='font-medium'>{row.full_name}</TableCell>
                        <TableCell>{row.phone ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
