// src\lib\navigation.ts
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  NotebookPen,
  School,
  ScrollText,
  TestTube,
  Users,
  UserCheck,
} from 'lucide-react'

import type { UserRole } from '@/lib/types'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'School Profile', href: '/admin/school', icon: Building2 },
  { label: 'Classes', href: '/admin/classes', icon: Layers3 },
  { label: 'Subjects', href: '/admin/subjects', icon: BookOpen },
  { label: 'Topics', href: '/admin/topics', icon: ScrollText },
  { label: 'Lesson Plans', href: '/admin/lesson-plans', icon: NotebookPen },
  { label: 'Teachers', href: '/admin/teachers', icon: Users },
  { label: 'Students', href: '/admin/students', icon: GraduationCap },
  { label: 'Assignments', href: '/admin/assignments', icon: UserCheck },
  { label: 'Exam Timetable', href: '/admin/exam-timetable', icon: CalendarClock },
  { label: 'Reports', href: '/admin/reports', icon: ClipboardList },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
]

export const teacherNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard },
  { label: 'Lesson Plans', href: '/teacher/lesson-plans', icon: NotebookPen },
  { label: 'Question Bank', href: '/teacher/question-bank', icon: ClipboardList },
  { label: 'Tests', href: '/teacher/tests', icon: TestTube },
  { label: 'Exam Timetable', href: '/teacher/exam-timetable', icon: CalendarClock },
  { label: 'Marking', href: '/teacher/marking', icon: ClipboardCheck },
  { label: 'Analytics', href: '/teacher/analytics', icon: BarChart3 },
]

export function navItemsByRole(role: UserRole) {
  return role === 'school_admin' ? adminNavItems : teacherNavItems
}

export const routeTitleMap: Record<string, string> = {
  '/admin': 'Admin Dashboard',
  '/admin/analytics': 'School Analytics',
  '/admin/reports': 'Reports',
  '/admin/exam-timetable': 'Exam Timetable',
  '/admin/school': 'School Profile',
  '/admin/classes': 'Classes',
  '/admin/subjects': 'Subjects',
  '/admin/topics': 'Topics',
  '/admin/lesson-plans': 'Lesson Plans',
  '/admin/teachers': 'Teachers',
  '/admin/students': 'Students',
  '/admin/assignments': 'Assignments',
  '/teacher': 'Teacher Dashboard',
  '/teacher/lesson-plans': 'Lesson Plans',
  '/teacher/question-bank': 'Question Bank',
  '/teacher/tests': 'Tests',
  '/teacher/exam-timetable': 'Exam Timetable',
  '/teacher/marking': 'Marking',
  '/teacher/analytics': 'Analytics',
}

export function roleLabel(role: UserRole) {
  if (role === 'school_admin') return 'School Admin'
  return 'Teacher'
}

export const appIdentity = {
  name: 'Teacher Assistant',
  icon: School,
  subtitle: 'Tanzania Schools',
}

