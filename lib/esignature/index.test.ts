import { describe, it, expect, afterEach } from 'vitest'
import { selectedProvider, isExternalSigningConfigured, activeProvider, EsignatureError } from './index'

const KEYS = ['ESIGNATURE_PROVIDER', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_SECRET_KEY', 'HELLOSIGN_API_KEY']

afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

describe('e-signature provider selection', () => {
  it('defaults to the in-house signer', () => {
    expect(selectedProvider()).toBe('inhouse')
    expect(isExternalSigningConfigured()).toBe(false)
    expect(activeProvider()).toBe('inhouse')
  })

  it('ignores an unknown provider value and stays in-house', () => {
    process.env.ESIGNATURE_PROVIDER = 'carrier-pigeon'
    expect(selectedProvider()).toBe('inhouse')
  })

  it('throws when an external provider is selected without credentials', () => {
    process.env.ESIGNATURE_PROVIDER = 'docusign'
    expect(selectedProvider()).toBe('docusign')
    expect(isExternalSigningConfigured()).toBe(false)
    expect(() => activeProvider()).toThrow(EsignatureError)
    try {
      activeProvider()
    } catch (e) {
      expect((e as EsignatureError).code).toBe('PROVIDER_NOT_CONFIGURED')
    }
  })

  it('reports configured (but not-yet-implemented) when all creds are present', () => {
    process.env.ESIGNATURE_PROVIDER = 'docusign'
    process.env.DOCUSIGN_ACCOUNT_ID = 'a'
    process.env.DOCUSIGN_INTEGRATION_KEY = 'b'
    process.env.DOCUSIGN_SECRET_KEY = 'c'
    expect(isExternalSigningConfigured()).toBe(true)
    try {
      activeProvider()
    } catch (e) {
      expect((e as EsignatureError).code).toBe('PROVIDER_NOT_IMPLEMENTED')
    }
  })
})
