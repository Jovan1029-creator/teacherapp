// src\pages\shared\ProfileMissing.tsx
import { AlertTriangle } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'

export function ProfileMissing() {
  const { session, profile, profileLoadError, isLoading } = useAuth()

  if (isLoading) return null
  if (!session) return <Navigate to='/login' replace />
  if (profile) return <Navigate to={profile.role === 'school_admin' ? '/admin' : '/teacher'} replace />
  if (profileLoadError) return <Navigate to='/profile-error' replace />

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4'>
      <Card className='w-full max-w-xl rounded-3xl border-none shadow-lg'>
        <CardHeader>
          <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500'>
            <AlertTriangle className='h-6 w-6' />
          </div>
          <CardTitle className='font-heading text-2xl'>Profile missing</CardTitle>
          <CardDescription>
            Your auth account exists, but no public.users profile row was found. Ask your school admin to create
            your profile row first.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground'>
            For MVP: create a row in public.users with id = auth.uid(), valid school_id, and role
            (school_admin or teacher).
          </div>
          <Button
            variant='outline'
            className='rounded-xl'
            onClick={async () => {
              await signOut()
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
