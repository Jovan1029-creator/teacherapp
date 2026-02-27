// src\components\AppShell.tsx
import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router-dom'

import { getSchool } from '@/api/schools'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import type { UserRole } from '@/lib/types'

interface AppShellProps {
  role: UserRole
}

export function AppShell({ role }: AppShellProps) {
  const schoolQuery = useQuery({
    queryKey: ['school'],
    queryFn: getSchool,
    staleTime: 60_000,
  })

  return (
    <div className='relative min-h-screen bg-transparent'>
      <div className='pointer-events-none absolute inset-0 opacity-70'>
        <div className='absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white/55 to-transparent' />
        <div className='absolute left-10 top-20 h-56 w-56 rounded-full bg-primary/8 blur-3xl' />
        <div className='absolute bottom-0 right-6 h-64 w-64 rounded-full bg-chart-4/10 blur-3xl' />
      </div>

      <div className='relative flex min-h-screen'>
        <Sidebar role={role} school={schoolQuery.data ?? null} />
        <div className='flex min-h-screen flex-1 flex-col'>
          <Topbar school={schoolQuery.data ?? null} />
          <main className='flex-1 px-3 pb-6 pt-3 md:px-6 md:pb-8 md:pt-4'>
            <div className='mx-auto w-full max-w-[1560px]'>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
