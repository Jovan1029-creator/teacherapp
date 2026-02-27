// src\lib\rbac.ts
import type { UserProfile, UserRole } from '@/lib/types'

export function isAdmin(role?: UserRole | null) {
  return role === 'school_admin'
}

export function isTeacher(role?: UserRole | null) {
  return role === 'teacher'
}

export function requireRole(profile: UserProfile | null, role: UserRole) {
  return profile?.role === role
}
