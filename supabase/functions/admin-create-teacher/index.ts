import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders })
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ error: 'Missing Supabase environment secrets' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    let body: {
      email?: string
      password?: string
      full_name?: string
      phone?: string | null
    }

    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim()
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null

    if (!isEmail(email)) return json({ error: 'Use a valid email address' }, 400)
    if (password.length < 8) return json({ error: 'Temporary password must be at least 8 characters' }, 400)
    if (fullName.length < 2) return json({ error: 'Full name is required' }, 400)

    const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user: requesterUser },
      error: requesterAuthError,
    } = await requesterClient.auth.getUser()

    if (requesterAuthError || !requesterUser) {
      return json({ error: 'Invalid JWT' }, 401)
    }

    const { data: requesterProfile, error: requesterProfileError } = await serviceClient
      .from('users')
      .select('*')
      .eq('id', requesterUser.id)
      .maybeSingle()

    if (requesterProfileError) {
      return json({ error: requesterProfileError.message }, 500)
    }

    if (!requesterProfile) {
      return json({ error: 'Requester profile not found' }, 403)
    }

    if (requesterProfile.role !== 'school_admin') {
      return json({ error: 'Only school admins can create teacher accounts' }, 403)
    }

    const { data: createdAuth, error: createAuthError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        provisioning_source: 'admin_create_teacher',
      },
      user_metadata: {
        role: 'teacher',
        school_id: requesterProfile.school_id,
        full_name: fullName,
        phone,
      },
    })

    if (createAuthError || !createdAuth.user) {
      return json({ error: createAuthError?.message || 'Failed to create auth user' }, 400)
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('users')
      .upsert(
        {
          id: createdAuth.user.id,
          school_id: requesterProfile.school_id,
          role: 'teacher',
          full_name: fullName,
          phone,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single()

    if (profileError) {
      return json(
        {
          error: 'Teacher auth account created but profile sync failed',
          message: profileError.message,
          auth_user_id: createdAuth.user.id,
          email: createdAuth.user.email ?? email,
        },
        500,
      )
    }

    return json({
      ok: true,
      auth_user_id: createdAuth.user.id,
      email: createdAuth.user.email ?? email,
      profile,
    })
  } catch (error) {
    console.error('admin-create-teacher error', error)
    return json(
      {
        error: 'Unhandled function error',
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})
