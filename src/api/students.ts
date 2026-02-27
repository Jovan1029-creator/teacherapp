// src\api\students.ts
import type { Student } from '@/lib/types'
import { chunk } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId } from './helpers'

export async function listStudentsByClass(classId?: string) {
  const schoolId = await getCurrentSchoolId()
  let query = supabase
    .from('students')
    .select('*, classroom:classes(*)')
    .eq('school_id', schoolId)
    .order('full_name')

  if (classId) {
    query = query.eq('class_id', classId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Student[]
}

export async function createStudent(payload: {
  class_id: string
  admission_no?: string
  full_name: string
  sex?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('students')
    .insert({
      school_id: schoolId,
      class_id: payload.class_id,
      admission_no: payload.admission_no || null,
      full_name: payload.full_name,
      sex: payload.sex || null,
    })
    .select('*')
    .single<Student>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateStudent(payload: {
  id: string
  class_id: string
  admission_no?: string
  full_name: string
  sex?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('students')
    .update({
      class_id: payload.class_id,
      admission_no: payload.admission_no || null,
      full_name: payload.full_name,
      sex: payload.sex || null,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .select('*')
    .single<Student>()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteStudent(id: string) {
  const schoolId = await getCurrentSchoolId()
  const { error } = await supabase.from('students').delete().eq('id', id).eq('school_id', schoolId)
  if (error) throw new Error(error.message)
}

export async function bulkInsertStudents(
  classId: string,
  students: Array<{ admission_no?: string; full_name: string; sex?: string }>,
  batchSize = 100,
) {
  const schoolId = await getCurrentSchoolId()
  const rows = students.map((student) => ({
    school_id: schoolId,
    class_id: classId,
    admission_no: student.admission_no || null,
    full_name: student.full_name,
    sex: student.sex || null,
  }))

  for (const batch of chunk(rows, batchSize)) {
    const { error } = await supabase.from('students').insert(batch)
    if (error) throw new Error(error.message)
  }
}
