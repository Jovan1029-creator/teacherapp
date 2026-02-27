// src\api\schools.ts
import type { School } from '@/lib/types'
import { supabase } from '@/lib/supabaseClient'

import { getCurrentSchoolId } from './helpers'

const SCHOOL_ASSETS_BUCKET = 'school-assets'

export async function getSchool() {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .single<School>()

  if (error) throw new Error(error.message)
  return data
}

export async function updateSchool(payload: Pick<School, 'name' | 'logo_url' | 'region' | 'district' | 'phone'>) {
  const schoolId = await getCurrentSchoolId()
  const { data, error } = await supabase
    .from('schools')
    .update(payload)
    .eq('id', schoolId)
    .select('*')
    .single<School>()

  if (error) throw new Error(error.message)
  return data
}

export async function uploadSchoolLogo(file: File) {
  const schoolId = await getCurrentSchoolId()

  if (!file.type.startsWith('image/')) {
    throw new Error('Upload an image file (PNG, JPG, WEBP, or SVG).')
  }

  const maxSizeBytes = 1024 * 1024
  if (file.size > maxSizeBytes) {
    throw new Error('Logo must be 1MB or smaller.')
  }

  const objectPath = `${schoolId}/logo`
  const { error: uploadError } = await supabase.storage.from(SCHOOL_ASSETS_BUCKET).upload(objectPath, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  })

  if (uploadError) throw new Error(uploadError.message)

  const { data } = supabase.storage.from(SCHOOL_ASSETS_BUCKET).getPublicUrl(objectPath)
  return `${data.publicUrl}?v=${Date.now()}`
}
