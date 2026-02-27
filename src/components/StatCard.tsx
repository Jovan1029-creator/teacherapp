// src\components\StatCard.tsx
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string | number
  description?: string
  icon: LucideIcon
}

export function StatCard({ label, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card className='rounded-3xl border-none shadow-sm'>
      <CardContent className='p-6'>
        <div className='flex items-start justify-between'>
          <div>
            <p className='text-sm text-muted-foreground'>{label}</p>
            <p className='mt-2 text-3xl font-semibold tracking-tight'>{value}</p>
          </div>
          <div className='rounded-2xl bg-primary/10 p-3 text-primary'>
            <Icon className='h-5 w-5' />
          </div>
        </div>
        {description ? <p className='mt-3 text-xs text-muted-foreground'>{description}</p> : null}
      </CardContent>
    </Card>
  )
}
