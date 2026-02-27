// src\pages\admin\Dashboard.tsx
import { Link } from 'react-router-dom'
import { BookOpen, GraduationCap, Layers3, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { listClasses } from '@/api/classes'
import { listStudentsByClass } from '@/api/students'
import { listSubjects } from '@/api/subjects'
import { listTeachers } from '@/api/users'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminDashboardPage() {
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: listClasses })
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: listTeachers })
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => listStudentsByClass() })

  if (classesQuery.isLoading || subjectsQuery.isLoading || teachersQuery.isLoading || studentsQuery.isLoading) {
    return <LoadingState />
  }

  if (classesQuery.isError || subjectsQuery.isError || teachersQuery.isError || studentsQuery.isError) {
    return (
      <EmptyState
        title='Failed to load dashboard'
        description='Please confirm your Supabase setup and try again.'
      />
    )
  }

  const quickLinks = [
    { href: '/admin/analytics', label: 'View school analytics' },
    { href: '/admin/exam-timetable', label: 'Prepare exam timetable' },
    { href: '/admin/classes', label: 'Create class' },
    { href: '/admin/subjects', label: 'Add subject' },
    { href: '/admin/teachers', label: 'Register teacher profile' },
    { href: '/admin/students', label: 'Import students CSV' },
  ]

  return (
    <div>
      <PageHeader
        title='Admin Dashboard'
        description='Monitor school setup progress and manage academic records.'
      />

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Classes' value={classesQuery.data?.length ?? 0} icon={Layers3} />
        <StatCard label='Subjects' value={subjectsQuery.data?.length ?? 0} icon={BookOpen} />
        <StatCard label='Teachers' value={teachersQuery.data?.length ?? 0} icon={Users} />
        <StatCard label='Students' value={studentsQuery.data?.length ?? 0} icon={GraduationCap} />
      </div>

      <Card className='mt-6 rounded-3xl border-none shadow-sm'>
        <CardHeader>
          <CardTitle className='font-heading text-xl'>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {quickLinks.map((link) => (
            <Button key={link.href} asChild variant='outline' className='justify-start rounded-xl'>
              <Link to={link.href}>{link.label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
