// src\lib\utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeText(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  return String(value).trim()
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function chunk<T>(items: T[], size: number) {
  const safeSize = Math.max(1, Math.floor(size))
  const result: T[][] = []

  for (let index = 0; index < items.length; index += safeSize) {
    result.push(items.slice(index, index + safeSize))
  }

  return result
}
