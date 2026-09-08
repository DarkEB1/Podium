/**
 * `terms_snapshot` jsonb fields come back as either a plain string or
 * `{ text }`. This is the one shared implementation — deliberately free of
 * any server-only import (no node:crypto, no supabase, no './index' or
 * './podium') so a `"use client"` component can import it safely alongside
 * server code like `lib/esign/finalize.ts`.
 */
export function termsString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'object') {
    const t = (v as { text?: unknown }).text
    if (typeof t === 'string') return t.trim() || null
    return JSON.stringify(v)
  }
  return String(v)
}
