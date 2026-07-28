import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { encryptSecret } from '@/lib/auth/secret-crypto'
import {
  PROVIDERS,
  clientId,
  clientSecret,
  providerConfigured,
  type SocialProvider,
} from './providers'

/**
 * Generic OAuth2 authorization-code flow for social connections (spec §6).
 * Fail-closed: nothing here runs for a provider without its credentials.
 */

export class SocialError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SocialError'
  }
}

export type SocialConnectionRow = Database['public']['Tables']['social_connections']['Row']

/** A random state value for CSRF protection (stored in a cookie, echoed by the provider). */
export function generateState(): string {
  return randomBytes(16).toString('base64url')
}

/** Build the provider's authorize URL for the code flow. */
export function buildAuthorizeUrl(provider: SocialProvider, state: string, redirectUri: string): string {
  const cfg = PROVIDERS[provider]
  const id = clientId(provider)
  if (!id) throw new SocialError('NOT_CONFIGURED', `${cfg.label} is not configured`)

  const params = new URLSearchParams({
    response_type: 'code',
    [cfg.clientIdParam]: id,
    redirect_uri: redirectUri,
    scope: cfg.scopes,
    state,
  })
  return `${cfg.authorizeUrl}?${params.toString()}`
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  scope?: string
  open_id?: string
  user_id?: string
}

/** Exchange an authorization code for tokens (standard form-encoded OAuth2). */
export async function exchangeCodeForToken(
  provider: SocialProvider,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const cfg = PROVIDERS[provider]
  const id = clientId(provider)
  const secret = clientSecret(provider)
  if (!id || !secret) throw new SocialError('NOT_CONFIGURED', `${cfg.label} is not configured`)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    [cfg.clientIdParam]: id,
    client_secret: secret,
  })

  let res: Response
  try {
    res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    })
  } catch (err) {
    throw new SocialError('TOKEN_REQUEST_FAILED', err instanceof Error ? err.message : 'network error')
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new SocialError('TOKEN_EXCHANGE_FAILED', `${provider} token exchange failed: ${detail.slice(0, 200)}`)
  }
  return (await res.json()) as TokenResponse
}

/** Persist a connection, encrypting the tokens at rest. Service-role client. */
export async function storeConnection(
  admin: SupabaseClient<Database>,
  userId: string,
  provider: SocialProvider,
  token: TokenResponse
): Promise<void> {
  await (admin as SupabaseClient).from('social_connections').upsert(
    {
      user_id: userId,
      provider,
      provider_account_id: token.open_id ?? token.user_id ?? null,
      access_token: encryptSecret(token.access_token),
      refresh_token: token.refresh_token ? encryptSecret(token.refresh_token) : null,
      scope: token.scope ?? null,
    },
    { onConflict: 'user_id,provider' }
  )
}

export async function listConnections(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<SocialConnectionRow[]> {
  const { data } = await (supabase as SupabaseClient)
    .from('social_connections')
    .select('*')
    .eq('user_id', userId)
  return (data as SocialConnectionRow[] | null) ?? []
}

export async function disconnect(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: SocialProvider
): Promise<void> {
  await (supabase as SupabaseClient)
    .from('social_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)
}

export { providerConfigured }
