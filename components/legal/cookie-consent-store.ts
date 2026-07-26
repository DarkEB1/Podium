'use client'

/**
 * Module-level consent store + `useCookieConsent()` hook (M-7 / CL-2).
 *
 * Deliberately provider-free: the cookie banner, the "Cookie preferences"
 * button in the footer and any future consent-gated widget all subscribe to
 * this one store via useSyncExternalStore, so no shared React context (and
 * therefore no edit to app/layout.tsx) is required to keep them in sync.
 *
 * Persistence, in order:
 *   1. first-party cookie  — always, covers signed-out visitors
 *   2. users.cookie_prefs  — best effort, only when a session exists
 * The cookie is authoritative for gating; the DB copy is the durable record of
 * consent that survives cookie clearing and can be produced on request.
 */

import { useCallback, useSyncExternalStore } from 'react'
import {
  type CookieCategory,
  type CookiePreferences,
  acceptAllPreferences,
  customPreferences,
  isCategoryAllowed,
  isConsentCurrent,
  readConsentCookie,
  rejectNonEssentialPreferences,
  writeConsentCookie,
} from '@/lib/legal/cookie-consent'
import { createClient } from '@/lib/supabase/client'
import { saveCookiePrefsForCurrentUser } from '@/lib/supabase/settings'

interface ConsentState {
  preferences: CookiePreferences | null
  /** A valid, current choice exists — the banner should stay hidden. */
  hasChosen: boolean
  /** The granular preference panel is open. */
  panelOpen: boolean
  /** The cookie has been read at least once (avoids an SSR/hydration flash). */
  hydrated: boolean
}

let state: ConsentState = {
  preferences: null,
  hasChosen: false,
  panelOpen: false,
  hydrated: false,
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setState(patch: Partial<ConsentState>): void {
  state = { ...state, ...patch }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ConsentState {
  return state
}

/** Server snapshot: never render the banner during SSR, avoids hydration churn. */
const SERVER_STATE: ConsentState = {
  preferences: null,
  hasChosen: false,
  panelOpen: false,
  hydrated: false,
}

function getServerSnapshot(): ConsentState {
  return SERVER_STATE
}

/** Reads the cookie into the store. Safe to call repeatedly. */
export function hydrateConsent(): void {
  const preferences = readConsentCookie()
  setState({
    preferences,
    hasChosen: isConsentCurrent(preferences),
    hydrated: true,
  })
}

/**
 * Mirrors the choice to `users.cookie_prefs`. Never blocks or reverts the
 * local choice: consent is recorded client-side first so that the gate closes
 * immediately even if the network call fails.
 */
async function syncToAccount(prefs: CookiePreferences): Promise<void> {
  try {
    await saveCookiePrefsForCurrentUser(createClient(), prefs)
  } catch {
    // Signed out, offline, or misconfigured env — the cookie already holds the
    // authoritative choice, so this is a no-op by design.
  }
}

function commit(prefs: CookiePreferences): void {
  writeConsentCookie(prefs)
  setState({ preferences: prefs, hasChosen: true, panelOpen: false, hydrated: true })
  void syncToAccount(prefs)
}

export function acceptAllCookies(): void {
  commit(acceptAllPreferences())
}

export function rejectNonEssentialCookies(): void {
  commit(rejectNonEssentialPreferences())
}

export function saveCookieChoice(choice: {
  analytics: boolean
  marketing: boolean
}): void {
  commit(customPreferences(choice))
}

/** Opens the granular preference panel — used by the footer link. */
export function openCookiePreferences(): void {
  setState({ panelOpen: true })
}

export function closeCookiePreferences(): void {
  setState({ panelOpen: false })
}

/** Test-only reset. Not called from application code. */
export function resetCookieConsentStore(): void {
  state = { preferences: null, hasChosen: false, panelOpen: false, hydrated: false }
  emit()
}

export interface UseCookieConsent extends ConsentState {
  acceptAll: () => void
  rejectNonEssential: () => void
  save: (choice: { analytics: boolean; marketing: boolean }) => void
  openPreferences: () => void
  closePreferences: () => void
  /** The gate: `allows('analytics')` before loading anything non-essential. */
  allows: (category: CookieCategory) => boolean
  /** Banner should be visible: hydrated, and no current choice on record. */
  shouldShowBanner: boolean
}

export function useCookieConsent(): UseCookieConsent {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const allows = useCallback(
    (category: CookieCategory) =>
      isCategoryAllowed(category, snapshot.preferences),
    [snapshot.preferences]
  )

  return {
    ...snapshot,
    acceptAll: acceptAllCookies,
    rejectNonEssential: rejectNonEssentialCookies,
    save: saveCookieChoice,
    openPreferences: openCookiePreferences,
    closePreferences: closeCookiePreferences,
    allows,
    shouldShowBanner: snapshot.hydrated && !snapshot.hasChosen,
  }
}
