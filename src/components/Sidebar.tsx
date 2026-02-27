// src\components\Sidebar.tsx
import { Menu } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { appIdentity, navItemsByRole } from '@/lib/navigation'
import type { School, UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SidebarProps {
  role: UserRole
  school?: Pick<School, 'name' | 'logo_url'> | null
}

function SidebarNav({
  role,
  school,
  onNavigate,
}: {
  role: UserRole
  school?: Pick<School, 'name' | 'logo_url'> | null
  onNavigate?: () => void
}) {
  const items = navItemsByRole(role)
  const Icon = appIdentity.icon
  const schoolName = school?.name?.trim() || appIdentity.name
  const schoolLogoUrl = school?.logo_url?.trim() || null

  return (
    <div className='flex h-full flex-col p-3'>
      <div className='mb-5 rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/15 bg-primary/10 p-1 text-primary'>
            {schoolLogoUrl ? (
              <img src={schoolLogoUrl} alt={`${schoolName} logo`} className='h-full w-full rounded-lg object-cover' />
            ) : (
              <Icon className='h-5 w-5' />
            )}
          </div>
          <div className='min-w-0'>
            <h2 className='font-heading truncate text-sm font-semibold text-foreground'>{schoolName}</h2>
            <p className='truncate text-xs text-muted-foreground'>{appIdentity.name}</p>
          </div>
        </div>
      </div>

      <div className='px-3 pb-2'>
        <p className='text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/90'>Workspace</p>
      </div>

      <nav className='space-y-1.5 px-1'>
        {items.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/admin' || item.href === '/teacher'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'border-primary/25 bg-primary/10 text-primary shadow-sm'
                  : 'border-transparent text-foreground/80 hover:border-border/70 hover:bg-background hover:text-foreground',
              )
            }
          >
            <item.icon className='h-4 w-4 shrink-0' />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className='mt-auto px-2 pt-4'>
        <div className='rounded-xl border border-border/70 bg-background/65 px-3 py-2 text-xs text-muted-foreground'>
          v0.1 MVP
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ role, school }: SidebarProps) {
  return (
    <>
      <aside className='hidden w-72 shrink-0 border-r border-border/60 bg-white/40 md:block'>
        <SidebarNav role={role} school={school} />
      </aside>

      <div className='fixed left-3 top-3 z-40 md:hidden'>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              className='h-10 w-10 rounded-xl border-border/70 bg-background shadow-sm hover:bg-background'
            >
              <Menu className='h-4 w-4' />
            </Button>
          </SheetTrigger>
          <SheetContent side='left' className='w-72 border-r border-border/70 bg-card p-0'>
            <SidebarNav role={role} school={school} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
