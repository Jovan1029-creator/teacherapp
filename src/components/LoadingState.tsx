// src\components\LoadingState.tsx
import { Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading data...' }: { label?: string }) {
  return (
    <div className='flex min-h-[260px] items-center justify-center rounded-3xl border border-dashed bg-card/70 p-10'>
      <div className='flex items-center gap-3 text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' />
        <span className='text-sm'>{label}</span>
      </div>
    </div>
  )
}
