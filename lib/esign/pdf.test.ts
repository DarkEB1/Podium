import { describe, it, expect } from 'vitest'
import { renderContractPdf } from './pdf'

describe('renderContractPdf', () => {
  it('produces a non-empty PDF with the %PDF header', async () => {
    const buf = await renderContractPdf({
      contractId: 'c1',
      terms: {
        title: 'Summer 2026 Endorsement', payAmount: 5000, payCurrency: 'GBP',
        payType: 'flat_fee', timelineStart: '2026-06-01', timelineEnd: '2026-08-31',
        deliverables: '3 Instagram posts', usageRights: 'Social only, 6 months',
        additionalTerms: 'No competitor endorsements during the term.',
      },
      parties: [
        { role: 'brand', displayName: 'Northwind Nutrition', company: 'Northwind Ltd' },
        { role: 'athlete', displayName: 'Maya Okafor' },
      ],
      signatures: [
        { role: 'brand', typedName: 'A. Buyer', signedAt: '2026-09-07T10:00:00.000Z', ip: '1.2.3.4', signatureHash: 'aaa' },
        { role: 'athlete', typedName: 'Maya Okafor', signedAt: '2026-09-07T11:00:00.000Z', ip: '5.6.7.8', signatureHash: 'bbb' },
      ],
    })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('renders even when the optional term fields are absent', async () => {
    const buf = await renderContractPdf({
      contractId: 'c2',
      terms: { title: 'Deal', payAmount: 100, payCurrency: 'USD', payType: 'per_post' },
      parties: [
        { role: 'brand', displayName: 'B' },
        { role: 'athlete', displayName: 'A' },
      ],
      signatures: [],
    })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
