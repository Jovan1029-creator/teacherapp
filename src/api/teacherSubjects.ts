// src\api\teacherSubjects.ts
import type { TeacherSubject } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId, getCurrentUserId } from './helpers'

export async function listAssignments() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('teacher_subjects')
    .select('*, teacher:users(*), subject:subjects(*), classroom:classes(*)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TeacherSubject[]
}

export async function listMyAssignments() {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('teacher_subjects')
    .select('*, teacher:users(*), subject:subjects(*), classroom:classes(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TeacherSubject[]
}

export async function createAssignment(payload: {
  teacher_id: string
  subject_id: string
  class_id: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('teacher_subjects')
    .insert({ school_id: schoolId, ...payload })
    .select('*')
    .single<TeacherSubject>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteAssignment(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('teacher_subjects').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
