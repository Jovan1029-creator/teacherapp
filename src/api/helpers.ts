// src\api\helpers.ts
import { supabase } from '@/lib/supabaseClient'
import type { UserProfile } from '@/lib/types'

export function assertData<T>(data: T, error: { message: string } | null) {
  if (error) throw new Error(error.message)
  return data
}

export async function getCurrentUserProfile(): Promise<UserProfile> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!authData.user) throw new Error('You are not signed in.')

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single<UserProfile>()

  if (error) throw new Error(error.message)
  return data
}

export async function getCurrentSchoolId() {
  const profile = await getCurrentUserProfile()
  return profile.school_id
}

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('You are not signed in.')
  return data.user.id
}
