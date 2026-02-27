// src\lib\auth.ts
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'
import type { UserProfile } from '@/lib/types'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(payload: {
  email: string
  password: string
  full_name: string
  school_name: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.full_name,
        school_name: payload.school_name,
        role: 'school_admin',
      },
    },
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getProfile(userId?: string): Promise<UserProfile | null> {
  const { data: authData } = await supabase.auth.getUser()
  const id = userId ?? authData.user?.id

  if (!id) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle<UserProfile>()

  if (error) throw error
  return data
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback)
}
