// src\pages\Login.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BookOpenCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { signIn, signUp } from '@/lib/auth'

const signInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signUpSchema = z
  .object({
    full_name: z.string().min(2, 'Full name is required'),
    school_name: z.string().min(2, 'School name is required'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm_password: z.string().min(6, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type SignInValues = z.infer<typeof signInSchema>
type SignUpValues = z.infer<typeof signUpSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, refreshProfile } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      full_name: '',
      school_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  })

  if (session) {
    return <Navigate to={profile ? (profile.role === 'school_admin' ? '/admin' : '/teacher') : '/profile-missing'} replace />
  }

  const onSignIn = signInForm.handleSubmit(async (values) => {
    try {
      await signIn(values.email, values.password)
      await refreshProfile()
      toast.success('Signed in successfully')

      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      if (from) navigate(from, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to login')
    }
  })

  const onSignUp = signUpForm.handleSubmit(async (values) => {
    try {
      const result = await signUp({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        school_name: values.school_name,
      })

      if (result.session) {
        await refreshProfile()
        toast.success('Account created successfully')
      } else {
        setMode('signin')
        signInForm.setValue('email', values.email)
        signInForm.setValue('password', '')
        toast.success('Account created. Check your email to confirm, then sign in.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account')
    }
  })

  return (
    <div className='min-h-screen bg-[radial-gradient(circle_at_top,#12b8a61a,transparent_45%),linear-gradient(180deg,#ffffff_0%,#f5faf9_100%)] p-4'>
      <div className='mx-auto flex min-h-screen max-w-5xl items-center justify-center'>
        <Card className='w-full max-w-md rounded-3xl border-none shadow-xl'>
          <CardHeader>
            <div className='mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary'>
              <BookOpenCheck className='h-6 w-6' />
            </div>
            <CardTitle className='font-heading text-3xl'>
              {mode === 'signin' ? 'Welcome back' : 'Create school account'}
            </CardTitle>
            <CardDescription>
              {mode === 'signin'
                ? 'Sign in to continue to your Teacher Assistant dashboard.'
                : 'Create a school admin account and bootstrap your school workspace.'}
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-5'>
            <div className='grid grid-cols-2 gap-2 rounded-xl bg-muted p-1'>
              <Button
                type='button'
                variant={mode === 'signin' ? 'default' : 'ghost'}
                className='rounded-lg'
                onClick={() => setMode('signin')}
              >
                Sign in
              </Button>
              <Button
                type='button'
                variant={mode === 'signup' ? 'default' : 'ghost'}
                className='rounded-lg'
                onClick={() => setMode('signup')}
              >
                Sign up
              </Button>
            </div>

            {mode === 'signin' ? (
              <form className='space-y-5' onSubmit={onSignIn}>
                <div className='space-y-2'>
                  <Label htmlFor='signin-email'>Email</Label>
                  <Input
                    id='signin-email'
                    type='email'
                    placeholder='you@school.tz'
                    {...signInForm.register('email')}
                  />
                  {signInForm.formState.errors.email ? (
                    <p className='text-xs text-destructive'>{signInForm.formState.errors.email.message}</p>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signin-password'>Password</Label>
                  <Input
                    id='signin-password'
                    type='password'
                    placeholder='********'
                    {...signInForm.register('password')}
                  />
                  {signInForm.formState.errors.password ? (
                    <p className='text-xs text-destructive'>{signInForm.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <Button type='submit' className='w-full rounded-xl' disabled={signInForm.formState.isSubmitting}>
                  {signInForm.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            ) : (
              <form className='space-y-4' onSubmit={onSignUp}>
                <div className='space-y-2'>
                  <Label htmlFor='signup-full-name'>Full Name</Label>
                  <Input
                    id='signup-full-name'
                    placeholder='Amina Juma'
                    {...signUpForm.register('full_name')}
                  />
                  {signUpForm.formState.errors.full_name ? (
                    <p className='text-xs text-destructive'>{signUpForm.formState.errors.full_name.message}</p>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-school'>School Name</Label>
                  <Input
                    id='signup-school'
                    placeholder='Wazo Secondary School'
                    {...signUpForm.register('school_name')}
                  />
                  {signUpForm.formState.errors.school_name ? (
                    <p className='text-xs text-destructive'>{signUpForm.formState.errors.school_name.message}</p>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-email'>Email</Label>
                  <Input
                    id='signup-email'
                    type='email'
                    placeholder='admin@school.tz'
                    {...signUpForm.register('email')}
                  />
                  {signUpForm.formState.errors.email ? (
                    <p className='text-xs text-destructive'>{signUpForm.formState.errors.email.message}</p>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-password'>Password</Label>
                  <Input
                    id='signup-password'
                    type='password'
                    placeholder='********'
                    {...signUpForm.register('password')}
                  />
                  {signUpForm.formState.errors.password ? (
                    <p className='text-xs text-destructive'>{signUpForm.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-confirm-password'>Confirm Password</Label>
                  <Input
                    id='signup-confirm-password'
                    type='password'
                    placeholder='********'
                    {...signUpForm.register('confirm_password')}
                  />
                  {signUpForm.formState.errors.confirm_password ? (
                    <p className='text-xs text-destructive'>{signUpForm.formState.errors.confirm_password.message}</p>
                  ) : null}
                </div>

                <Button type='submit' className='w-full rounded-xl' disabled={signUpForm.formState.isSubmitting}>
                  {signUpForm.formState.isSubmitting ? 'Creating account...' : 'Create account'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
