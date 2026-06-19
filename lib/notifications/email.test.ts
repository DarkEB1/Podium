import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    },
  })),
}))

import {
  sendProposalReceivedEmail,
  sendProposalRespondedEmail,
  sendContractFullySignedEmail,
} from './email'

describe('sendProposalReceivedEmail', () => {
  it('resolves without throwing when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com'
    await expect(
      sendProposalReceivedEmail('athlete@example.com', 'Summer Campaign', 'Nike')
    ).resolves.not.toThrow()
  })

  it('resolves without throwing when RESEND_API_KEY is not set (graceful no-op)', async () => {
    delete process.env.RESEND_API_KEY
    await expect(
      sendProposalReceivedEmail('athlete@example.com', 'Summer Campaign', 'Nike')
    ).resolves.not.toThrow()
  })
})

describe('sendProposalRespondedEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com'
  })

  it('resolves for accepted action', async () => {
    await expect(
      sendProposalRespondedEmail('brand@example.com', 'Summer Campaign', 'accepted', 'LeBron')
    ).resolves.not.toThrow()
  })

  it('resolves for declined action', async () => {
    await expect(
      sendProposalRespondedEmail('brand@example.com', 'Summer Campaign', 'declined', 'LeBron')
    ).resolves.not.toThrow()
  })

  it('resolves for countered action', async () => {
    await expect(
      sendProposalRespondedEmail('brand@example.com', 'Summer Campaign', 'countered', 'LeBron')
    ).resolves.not.toThrow()
  })
})

describe('sendContractFullySignedEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com'
  })

  it('resolves without throwing', async () => {
    await expect(
      sendContractFullySignedEmail('brand@example.com', 'Summer Campaign')
    ).resolves.not.toThrow()
  })
})
