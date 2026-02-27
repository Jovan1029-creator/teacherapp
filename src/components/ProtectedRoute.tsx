// src\components\ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingState } from '@/components/LoadingState'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute() {
  const { session, profile, profileLoadError, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState label='Checking authentication...' />

  if (!session) {
    return <Navigate to='/login' state={{ from: location }} replace />
  }

  if (session && profileLoadError && !profile && location.pathname !== '/profile-error') {
    return <Navigate to='/profile-error' replace />
  }

  if (session && !profile && location.pathname !== '/profile-missing') {
    return <Navigate to='/profile-missing' replace />
  }

  return <Outlet />
}
