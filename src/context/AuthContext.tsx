// src\context\AuthContext.tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { getProfile, getSession, onAuthStateChange } from '@/lib/auth'
import type { UserProfile } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  profile: UserProfile | null
  profileLoadError: string | null
  isLoading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10000

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('timed out')
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = AUTH_BOOTSTRAP_TIMEOUT_MS) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const profileRef = useRef<UserProfile | null>(null)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const load = async () => {
    setIsLoading(true)
    setProfileLoadError(null)
    try {
      const currentSession = await withTimeout(getSession(), 'getSession')
      setSession(currentSession)
      if (currentSession?.user) {
        try {
          const loaded = await withTimeout(getProfile(currentSession.user.id), 'getProfile')
          setProfile(loaded)
          setProfileLoadError(null)
        } catch (error) {
          console.error('Profile fetch failed during auth bootstrap', error)
          setProfile(null)
          setProfileLoadError(error instanceof Error ? error.message : 'Failed to load profile')
        }
      } else {
        setProfile(null)
        setProfileLoadError(null)
      }
    } catch (error) {
      console.error('Auth bootstrap failed', error)
      setSession(null)
      setProfile(null)
      setProfileLoadError(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()

    const { data: subscription } = onAuthStateChange(async (event: AuthChangeEvent, nextSession) => {
      setIsLoading(true)
      setProfileLoadError(null)
      try {
        setSession(nextSession)
        if (nextSession?.user) {
          // Token refreshes happen frequently on tab return. If we already have the same profile,
          // keep it instead of forcing a profile query that may be throttled in background tabs.
          if (event === 'TOKEN_REFRESHED' && profileRef.current?.id === nextSession.user.id) {
            setProfileLoadError(null)
            return
          }

          try {
            const loaded = await withTimeout(getProfile(nextSession.user.id), 'getProfile')
            setProfile(loaded)
            setProfileLoadError(null)
          } catch (error) {
            console.error('Profile fetch failed after auth state change', error)
            // Preserve the existing profile for transient failures (common after background-tab throttling)
            // so users are not kicked to /profile-error while their session is still valid.
            if (profileRef.current?.id === nextSession.user.id && isTimeoutError(error)) {
              setProfile(profileRef.current)
              setProfileLoadError(null)
            } else {
              setProfile(null)
              setProfileLoadError(error instanceof Error ? error.message : 'Failed to load profile')
            }
          }
        } else {
          setProfile(null)
          setProfileLoadError(null)
        }
      } catch (error) {
        console.error('Auth state change handling failed', error)
        setProfile(null)
        setProfileLoadError(null)
      } finally {
        setIsLoading(false)
      }
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
        session,
        profile,
        profileLoadError,
        isLoading,
        refreshProfile: load,
      }),
    [session, profile, profileLoadError, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
