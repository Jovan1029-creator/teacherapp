import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'

export function ProfileLoadError() {
  const { session, profile, profileLoadError, isLoading, refreshProfile } = useAuth()

  if (isLoading) return null
  if (!session) return <Navigate to='/login' replace />
  if (profile) return <Navigate to={profile.role === 'school_admin' ? '/admin' : '/teacher'} replace />
  if (!profileLoadError) return <Navigate to='/profile-missing' replace />

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-amber-500/10 p-4'>
      <Card className='w-full max-w-xl rounded-3xl border-none shadow-lg'>
        <CardHeader>
          <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500'>
            <AlertTriangle className='h-6 w-6' />
          </div>
          <CardTitle className='font-heading text-2xl'>Profile could not be loaded</CardTitle>
          <CardDescription>
            Your sign-in is valid, but the app could not load your profile right now. This is often a temporary
            connection or Supabase issue.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground'>
            Error: {profileLoadError}
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              className='rounded-xl'
              onClick={async () => {
                await refreshProfile()
              }}
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Retry profile load
            </Button>
            <Button
              variant='outline'
              className='rounded-xl'
              onClick={async () => {
                await signOut()
              }}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
