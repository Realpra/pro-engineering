import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatINR(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n.toLocaleString('en-IN')}`
}

export function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().split('T')[0]
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
