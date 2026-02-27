// src\components\EmptyState.tsx
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div className='rounded-3xl border border-dashed bg-card/80 p-10 text-center shadow-sm'>
      <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
        <Icon className='h-5 w-5' />
      </div>
      <h3 className='text-lg font-semibold'>{title}</h3>
      <p className='mx-auto mt-2 max-w-md text-sm text-muted-foreground'>{description}</p>
      {actionLabel && onAction ? (
        <Button className='mt-5' onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
