// src\pages\shared\NotFound.tsx
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className='flex min-h-[70vh] items-center justify-center'>
      <div className='w-full max-w-lg rounded-3xl border bg-card p-10 text-center shadow-sm'>
        <p className='text-xs uppercase tracking-wider text-muted-foreground'>Error 404</p>
        <h1 className='mt-2 font-heading text-3xl font-semibold'>Page not found</h1>
        <p className='mt-3 text-sm text-muted-foreground'>
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild className='mt-6 rounded-xl'>
          <Link to='/login'>Back to login</Link>
        </Button>
      </div>
    </div>
  )
}
