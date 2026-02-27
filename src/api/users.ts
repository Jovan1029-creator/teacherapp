// src\api\users.ts
import type { UserProfile } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId } from './helpers'

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle<UserProfile>()

  if (error) throw new Error(error.message)
  return data
}

export async function listTeachers() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .order('full_name')

  if (error) throw new Error(error.message)
  return (data ?? []) as UserProfile[]
}

export async function createTeacherProfile(payload: {
  id: string
  full_name: string
  phone?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: payload.id,
      school_id: schoolId,
      role: 'teacher',
      full_name: payload.full_name,
      phone: payload.phone || null,
    })
    .select('*')
    .single<UserProfile>()

  if (error) throw new Error(error.message)
  return data
}

export async function createTeacherAccount(payload: {
  email: string
  password: string
  full_name: string
  phone?: string
}) {
  const { data, error } = await supabase.functions.invoke('admin-create-teacher', {
    body: {
      email: payload.email,
      password: payload.password,
      full_name: payload.full_name,
      phone: payload.phone || null,
    },
  })

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context
    if (context?.json) {
      try {
        const details = (await context.json()) as { error?: string; message?: string }
        throw new Error(details.error || details.message || error.message)
      } catch (parseError) {
        if (parseError instanceof Error) throw parseError
      }
    }

    throw new Error(error.message)
  }

  const response = (data ?? {}) as {
    ok?: boolean
    error?: string
    profile?: UserProfile
    auth_user_id?: string
    email?: string | null
  }

  if (!response.ok || !response.profile) {
    throw new Error(response.error || 'Failed to create teacher account')
  }

  return response
}

export async function updateTeacherProfile(payload: {
  id: string
  full_name: string
  phone?: string
}) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('users')
    .update({
      full_name: payload.full_name,
      phone: payload.phone || null,
    })
    .eq('id', payload.id)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .select('*')
    .single<UserProfile>()

  if (error) throw new Error(error.message)
  return data
}
