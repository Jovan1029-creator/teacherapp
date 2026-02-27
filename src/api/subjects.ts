// src\api\subjects.ts
import type { Subject } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId, getCurrentUserId } from './helpers'

export async function listSubjects() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Subject[]
}

export async function listMyAssignedSubjects() {
  const schoolId = await getCurrentSchoolId()
  const teacherId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('teacher_subjects')
    .select('subject:subjects(*)')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)

  if (error) throw new Error(error.message)

  const unique = new Map<string, Subject>()

  for (const row of (data ?? []) as Array<{ subject: Subject | Subject[] | null }>) {
    const nested = Array.isArray(row.subject) ? row.subject[0] : row.subject
    if (!nested?.id) continue
    unique.set(nested.id, nested)
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function createSubject(payload: { name: string }) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('subjects')
    .insert({ school_id: schoolId, name: payload.name })
    .select('*')
    .single<Subject>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateSubject(payload: { id: string; name: string }) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('subjects')
    .update({ name: payload.name })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<Subject>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteSubject(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('subjects').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
