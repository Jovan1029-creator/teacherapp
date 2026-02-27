// src\components\RoleGate.tsx
import { Navigate } from 'react-router-dom'

import { LoadingState } from '@/components/LoadingState'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/lib/types'

interface RoleGateProps {
  role: UserRole
  children: React.ReactElement
}

export function RoleGate({ role, children }: RoleGateProps) {
  const { isLoading, profile, profileLoadError } = useAuth()

  if (isLoading) return <LoadingState label='Checking role permissions...' />

  if (!profile) return <Navigate to={profileLoadError ? '/profile-error' : '/profile-missing'} replace />

  if (profile.role !== role) {
    return <Navigate to={profile.role === 'school_admin' ? '/admin' : '/teacher'} replace />
  }

  return children
}
