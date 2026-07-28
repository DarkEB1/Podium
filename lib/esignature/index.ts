/**
 * E-signature provider selection (spec §deals).
 *
 * Podium ships an in-house click-to-sign signer (lib/supabase/deals.ts
 * signContract): the two parties click, we stamp brand_signed_at /
 * athlete_signed_at, and the contract row is the legal record. That is the
 * default and needs no third party.
 *
 * This module makes the choice a config switch so a DocuSign or HelloSign
 * integration can be dropped in later without touching call sites: set
 * ESIGNATURE_PROVIDER and provide that provider's credentials. Until an external
 * provider is both selected AND configured, the in-house signer is used. The
 * external adapters are intentionally not implemented yet; selecting one without
 * its credentials fails closed with a clear error rather than silently falling
 * back, so a misconfiguration is visible.
 */

export type EsignatureProvider = 'inhouse' | 'docusign' | 'hellosign'

const PROVIDER_ENV: Record<Exclude<EsignatureProvider, 'inhouse'>, string[]> = {
  docusign: ['DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_SECRET_KEY'],
  hellosign: ['HELLOSIGN_API_KEY'],
}

export class EsignatureError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'EsignatureError'
  }
}

/** The provider named by env, defaulting to the in-house signer. */
export function selectedProvider(): EsignatureProvider {
  const raw = (process.env.ESIGNATURE_PROVIDER ?? 'inhouse').trim().toLowerCase()
  if (raw === 'docusign' || raw === 'hellosign') return raw
  return 'inhouse'
}

/** Whether an external provider is selected and fully configured. */
export function isExternalSigningConfigured(): boolean {
  const provider = selectedProvider()
  if (provider === 'inhouse') return false
  return PROVIDER_ENV[provider].every((k) => !!process.env[k])
}

/**
 * The provider signing should actually use right now. Returns 'inhouse' unless
 * an external provider is both selected and configured. Throws if an external
 * provider is selected but missing credentials, so the misconfiguration surfaces
 * instead of silently signing in-house under a DocuSign label.
 */
export function activeProvider(): EsignatureProvider {
  const provider = selectedProvider()
  if (provider === 'inhouse') return 'inhouse'
  if (!isExternalSigningConfigured()) {
    const missing = PROVIDER_ENV[provider].filter((k) => !process.env[k])
    throw new EsignatureError(
      'PROVIDER_NOT_CONFIGURED',
      `ESIGNATURE_PROVIDER is "${provider}" but it is not configured (missing ${missing.join(', ')}). ` +
        'Set the credentials or use the in-house signer.'
    )
  }
  // External provider selected and configured. The adapter is not implemented
  // yet; when it is, dispatch here. For now signing still flows through the
  // in-house path, and this branch is unreachable in a real deployment because
  // no credentials exist until the adapter ships.
  throw new EsignatureError(
    'PROVIDER_NOT_IMPLEMENTED',
    `The ${provider} adapter is not implemented yet. Keep ESIGNATURE_PROVIDER unset to use the in-house signer.`
  )
}
