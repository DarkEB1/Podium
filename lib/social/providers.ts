/**
 * Social OAuth provider registry (spec §6). Each provider is a standard OAuth2
 * authorization-code app. Credentials come from env and each provider is
 * fail-closed: without its client id + secret the connect flow is unavailable.
 *
 * Provider-specific token/profile quirks (PKCE for X, long-lived-token exchange
 * for Meta, etc.) are noted per provider; the generic code-exchange covers the
 * common shape and is the place to special-case as apps are registered.
 */

export type SocialProvider = 'meta' | 'tiktok' | 'x' | 'youtube' | 'linkedin'

export interface ProviderConfig {
  label: string
  authorizeUrl: string
  tokenUrl: string
  scopes: string
  clientIdEnv: string
  clientSecretEnv: string
  /** TikTok names the client id param `client_key`; everyone else uses `client_id`. */
  clientIdParam: string
}

export const PROVIDERS: Record<SocialProvider, ProviderConfig> = {
  meta: {
    label: 'Instagram / Meta',
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: 'instagram_basic,pages_show_list',
    clientIdEnv: 'META_CLIENT_ID',
    clientSecretEnv: 'META_CLIENT_SECRET',
    clientIdParam: 'client_id',
  },
  tiktok: {
    label: 'TikTok',
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: 'user.info.basic',
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    clientIdParam: 'client_key',
  },
  x: {
    label: 'X',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: 'users.read tweet.read',
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    clientIdParam: 'client_id',
  },
  youtube: {
    label: 'YouTube',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.readonly',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    clientIdParam: 'client_id',
  },
  linkedin: {
    label: 'LinkedIn',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'r_liteprofile',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    clientIdParam: 'client_id',
  },
}

export function isSocialProvider(value: string): value is SocialProvider {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value)
}

export function providerConfigured(provider: SocialProvider): boolean {
  const c = PROVIDERS[provider]
  return !!process.env[c.clientIdEnv] && !!process.env[c.clientSecretEnv]
}

export function clientId(provider: SocialProvider): string | undefined {
  return process.env[PROVIDERS[provider].clientIdEnv]
}

export function clientSecret(provider: SocialProvider): string | undefined {
  return process.env[PROVIDERS[provider].clientSecretEnv]
}
