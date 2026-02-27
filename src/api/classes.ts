// src\api\classes.ts
import type { Classroom } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId } from './helpers'

export async function listClasses() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Classroom[]
}

export async function createClass(payload: { name: string; year?: number }) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('classes')
    .insert({ school_id: schoolId, name: payload.name, year: payload.year ?? null })
    .select('*')
    .single<Classroom>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateClass(payload: { id: string; name: string; year?: number }) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('classes')
    .update({ name: payload.name, year: payload.year ?? null })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<Classroom>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteClass(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('classes').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}
