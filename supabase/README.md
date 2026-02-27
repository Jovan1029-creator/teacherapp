# Supabase Setup

This project now supports:

- `Sign in` for existing users
- `Sign up` for new school admins from the login page
- Automatic provisioning of `schools` + `users` profile rows via a trigger

## Run once

1. Open Supabase SQL Editor for your project.
2. Run `supabase/schema.sql`.
3. Optional: run `supabase/seed.sql` to add starter data.

## Auth settings

In `Authentication -> Providers -> Email`, enable Email auth.

- If email confirmation is enabled, users must confirm before first login.
- If email confirmation is disabled, users can sign in immediately.

## Local env

Set these in `.env.local`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Then restart dev server.
