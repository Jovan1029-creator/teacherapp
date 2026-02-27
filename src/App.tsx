// src\App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleGate } from '@/components/RoleGate'
import { LoadingState } from '@/components/LoadingState'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import AssignmentsPage from '@/pages/admin/Assignments'
import AdminAnalyticsPage from '@/pages/admin/Analytics'
import ClassesPage from '@/pages/admin/Classes'
import AdminDashboardPage from '@/pages/admin/Dashboard'
import AdminExamTimetablePage from '@/pages/admin/ExamTimetable'
import AdminLessonPlansPage from '@/pages/admin/LessonPlans'
import AdminReportsPage from '@/pages/admin/Reports'
import SchoolProfilePage from '@/pages/admin/SchoolProfile'
import StudentsPage from '@/pages/admin/Students'
import SubjectsPage from '@/pages/admin/Subjects'
import TeachersPage from '@/pages/admin/Teachers'
import TopicsPage from '@/pages/admin/Topics'
import LoginPage from '@/pages/Login'
import NotFound from '@/pages/shared/NotFound'
import { ProfileLoadError } from '@/pages/shared/ProfileLoadError'
import { ProfileMissing } from '@/pages/shared/ProfileMissing'
import TeacherDashboardPage from '@/pages/teacher/Dashboard'
import TeacherExamTimetablePage from '@/pages/teacher/ExamTimetable'
import LessonPlansPage from '@/pages/teacher/LessonPlans'
import TeacherAnalyticsPage from '@/pages/teacher/Analytics'
import TeacherMarkingPage from '@/pages/teacher/Marking'
import QuestionBankPage from '@/pages/teacher/QuestionBank'
import TestBuilderPage from '@/pages/teacher/TestBuilder'
import TeacherTestPrintPage from '@/pages/teacher/TestPrint'
import TestsPage from '@/pages/teacher/Tests'

const queryClient = new QueryClient()

function RootRedirect() {
  const { session, profile, profileLoadError, isLoading } = useAuth()

  if (isLoading) return <LoadingState label='Loading workspace...' />
  if (!session) return <Navigate to='/login' replace />
  if (profileLoadError && !profile) return <Navigate to='/profile-error' replace />
  if (!profile) return <Navigate to='/profile-missing' replace />
  return <Navigate to={profile.role === 'school_admin' ? '/admin' : '/teacher'} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path='/' element={<RootRedirect />} />
            <Route path='/login' element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path='/profile-missing' element={<ProfileMissing />} />
              <Route path='/profile-error' element={<ProfileLoadError />} />

              <Route
                path='/admin'
                element={
                  <RoleGate role='school_admin'>
                    <AppShell role='school_admin' />
                  </RoleGate>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path='analytics' element={<AdminAnalyticsPage />} />
                <Route path='reports' element={<AdminReportsPage />} />
                <Route path='exam-timetable' element={<AdminExamTimetablePage />} />
                <Route path='school' element={<SchoolProfilePage />} />
                <Route path='classes' element={<ClassesPage />} />
                <Route path='subjects' element={<SubjectsPage />} />
                <Route path='topics' element={<TopicsPage />} />
                <Route path='lesson-plans' element={<AdminLessonPlansPage />} />
                <Route path='teachers' element={<TeachersPage />} />
                <Route path='students' element={<StudentsPage />} />
                <Route path='assignments' element={<AssignmentsPage />} />
              </Route>

              <Route
                path='/teacher'
                element={
                  <RoleGate role='teacher'>
                    <AppShell role='teacher' />
                  </RoleGate>
                }
              >
                <Route index element={<TeacherDashboardPage />} />
                <Route path='lesson-plans' element={<LessonPlansPage />} />
                <Route path='question-bank' element={<QuestionBankPage />} />
                <Route path='tests' element={<TestsPage />} />
                <Route path='exam-timetable' element={<TeacherExamTimetablePage />} />
                <Route path='tests/:id' element={<TestBuilderPage />} />
                <Route path='tests/:id/print' element={<TeacherTestPrintPage />} />
                <Route path='marking' element={<TeacherMarkingPage />} />
                <Route path='analytics' element={<TeacherAnalyticsPage />} />
              </Route>
            </Route>

            <Route path='*' element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position='top-right' />
      </AuthProvider>
    </QueryClientProvider>
  )
}
