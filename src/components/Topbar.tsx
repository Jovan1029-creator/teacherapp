// src\components\Topbar.tsx
import { LogOut, User2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { roleLabel, routeTitleMap } from '@/lib/navigation'
import type { School } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Topbar({ school }: { school?: Pick<School, 'name' | 'logo_url'> | null }) {
  const { pathname } = useLocation()
  const { profile } = useAuth()

  const title = routeTitleMap[pathname] ?? 'Teacher Assistant'
  const workspaceRole = profile ? roleLabel(profile.role) : 'Workspace'
  const schoolName = school?.name?.trim() || 'Teacher Assistant System'
  const schoolLogoUrl = school?.logo_url?.trim() || null

  return (
    <header className='sticky top-0 z-30 px-3 pt-3 md:px-6 md:pt-4'>
      <div className='mx-auto max-w-[1560px]'>
        <div className='flex min-h-[4.5rem] items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 px-3 py-2 shadow-sm supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-sm md:px-4'>
          <div className='min-w-0 pl-12 md:pl-0'>
            <div className='mb-1 flex flex-wrap items-center gap-2'>
              <div className='hidden h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-background sm:flex'>
                {schoolLogoUrl ? (
                  <img src={schoolLogoUrl} alt={`${schoolName} logo`} className='h-full w-full object-cover' />
                ) : null}
              </div>
              <p className='text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground'>
                {schoolName}
              </p>
              <Badge
                variant='outline'
                className='rounded-full border-border/80 bg-muted/40 px-2 py-0 text-[10px] font-medium text-muted-foreground'
              >
                {workspaceRole}
              </Badge>
            </div>
            <h1 className='font-heading truncate text-lg font-semibold tracking-tight sm:text-xl'>{title}</h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' className='max-w-44 rounded-xl border-border/70 bg-card/70 shadow-sm'>
                <User2 className='mr-2 h-4 w-4' />
                <span className='max-w-28 truncate'>{profile?.full_name ?? 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-60 rounded-xl border-border/70'>
              <DropdownMenuLabel>
                <div className='flex flex-col'>
                  <span className='truncate'>{profile?.full_name ?? 'No profile'}</span>
                  <span className='text-xs font-normal text-muted-foreground'>
                    {profile ? roleLabel(profile.role) : 'Unknown role'}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut()
                }}
              >
                <LogOut className='mr-2 h-4 w-4' />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
