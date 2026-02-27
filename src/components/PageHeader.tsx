// src\components\PageHeader.tsx
import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function PageHeader({ title, description, actionLabel, onAction }: PageHeaderProps) {
  return (
    <div className='mb-6 flex flex-wrap items-start justify-between gap-3'>
      <div>
        <h1 className='font-heading text-2xl font-semibold tracking-tight'>{title}</h1>
        {description ? <p className='mt-1 text-sm text-muted-foreground'>{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button className='rounded-xl' onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
