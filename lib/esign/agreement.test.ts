import { describe, it, expect } from 'vitest'
import { buildAgreement, AGREEMENT_DEFAULTS, type AgreementInput } from './agreement'

// Flatten every piece of rendered text in the built agreement so we can assert
// on the resolved content (the whole point: what a signer actually reads).
function allText(input: AgreementInput): string {
  const a = buildAgreement(input)
  const parts: string[] = [a.title, a.referenceId, a.effectiveDate]
  for (const s of a.sections) {
    parts.push(s.number, s.title)
    for (const b of s.blocks) {
      if (b.kind === 'para') parts.push(b.text)
      else if (b.kind === 'termRow') parts.push(b.label, b.value)
      else if (b.kind === 'bullets') parts.push(...b.items)
    }
  }
  return parts.join('\n')
}

const base: AgreementInput = {
  contractId: 'c-123',
  terms: {
    title: 'Summer 2026 Endorsement',
    payAmount: 5000,
    payCurrency: 'GBP',
    payType: 'flat_fee',
    timelineStart: '2026-06-01',
    timelineEnd: '2026-08-31',
    deliverables: '3 Instagram posts',
    usageRights: 'Social only, 6 months',
    additionalTerms: 'No competitor endorsements during the term.',
  },
  parties: [
    { role: 'brand', displayName: 'Northwind Nutrition', legalName: 'Northwind Ltd' },
    { role: 'athlete', displayName: 'Maya Okafor', legalName: 'Maya A. Okafor' },
  ],
  signatures: [
    { role: 'brand', typedName: 'Alex Brandt', signedAt: '2026-09-07T10:00:00.000Z', ip: '1.2.3.4', signatureHash: 'aaa' },
    { role: 'athlete', typedName: 'Maya Okafor', signedAt: '2026-09-07T11:00:00.000Z', ip: '5.6.7.8', signatureHash: 'bbb' },
  ],
}

describe('buildAgreement — structure', () => {
  it('produces all twelve numbered sections in order', () => {
    const a = buildAgreement(base)
    const numbers = a.sections.map((s) => s.number)
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
  })

  it('NEVER leaves an unfilled [PLACEHOLDER] in any rendered text', () => {
    // The core safety invariant: a rendered contract with a literal [BRACKET]
    // placeholder is a broken legal document.
    const text = allText(base)
    const brackets = text.match(/\[[^\]]+\]/g)
    expect(brackets).toBeNull()
  })

  it('omits placeholders even when every optional field is absent', () => {
    const minimal: AgreementInput = {
      contractId: 'c2',
      terms: { title: 'Deal', payAmount: 100, payCurrency: 'GBP', payType: 'per_post' },
      parties: [
        { role: 'brand', displayName: 'B' },
        { role: 'athlete', displayName: 'A' },
      ],
      signatures: [],
    }
    const text = allText(minimal)
    expect(text.match(/\[[^\]]+\]/g)).toBeNull()
  })
})

describe('buildAgreement — the nine defaults', () => {
  it('governing law and jurisdiction come from the defaults', () => {
    expect(allText(base)).toContain(AGREEMENT_DEFAULTS.governingLaw)
    expect(AGREEMENT_DEFAULTS.governingLaw).toBe('England and Wales')
  })
  it('caps liability at the total Fee', () => {
    expect(allText(base).toLowerCase()).toContain('total fee')
  })
  it('uses the default termination notice and cure periods', () => {
    const text = allText(base)
    expect(text).toContain('14 days')
    expect(text).toContain('7 days')
  })
  it('grants a non-exclusive UK licence for the Term by default', () => {
    const text = allText(base).toLowerCase()
    expect(text).toContain('non-exclusive')
    expect(text).toContain('united kingdom')
  })
  it('does not auto-renew by default', () => {
    expect(allText(base).toLowerCase()).toContain('will not automatically renew')
  })
})

describe('buildAgreement — mapped commercial terms', () => {
  it('formats the fee as currency and maps the pay type to a structure', () => {
    const text = allText(base)
    expect(text).toContain('£5,000')
    expect(text.toLowerCase()).toContain('lump sum on completion') // flat_fee mapping
  })
  it('renders the parties by their legal name where available', () => {
    const text = allText(base)
    expect(text).toContain('Northwind Ltd')
    expect(text).toContain('Maya A. Okafor')
  })
  it('renders a party postal address in the Section 1 identity line when present', () => {
    const withAddr = buildAgreement({
      ...base,
      parties: [
        { role: 'brand', displayName: 'Northwind Nutrition', legalName: 'Northwind Ltd', address: '1 High Street, London EC1A 1AA' },
        { role: 'athlete', displayName: 'Maya Okafor', legalName: 'Maya A. Okafor' },
      ],
    })
    const s1 = withAddr.sections.find((s) => s.number === '1')!
    const text = s1.blocks.flatMap((b) => (b.kind === 'termRow' ? [b.label, b.value] : b.kind === 'para' ? [b.text] : b.items)).join('\n')
    expect(text).toContain('of 1 High Street, London EC1A 1AA')
    // and absent addresses never leave a placeholder
    expect(allText(base)).not.toContain(' of ,')
  })

  it('folds the deliverables and additional terms into scope', () => {
    const text = allText(base)
    expect(text).toContain('3 Instagram posts')
    expect(text).toContain('No competitor endorsements during the term.')
  })
})

describe('buildAgreement — payment wording matches the real platform model', () => {
  it('frames Podium as facilitator and the Sponsor as the payer, not Podium as payer', () => {
    const text = allText(base).toLowerCase()
    // The Sponsor pays the Fee; Podium facilitates. We must NOT promise that
    // Podium pays the athlete, because no payout flow exists in the platform.
    expect(text).toContain('the sponsor shall pay')
    expect(text).not.toContain('podium shall pay')
  })
})

describe('buildAgreement — direct P2P payment', () => {
  function section6Text(input: AgreementInput): string {
    const s6 = buildAgreement(input).sections.find((s) => s.number === '6')!
    return s6.blocks
      .flatMap((b) => (b.kind === 'para' ? [b.text] : b.kind === 'termRow' ? [b.label, b.value] : b.items))
      .join('\n')
  }

  it('says the Sponsor pays the Athlete directly and drops the "arranged through the platform" wording', () => {
    const text = section6Text(base)
    expect(text.toLowerCase()).toContain('pay the athlete directly')
    expect(text).not.toContain('arranged through the Podium platform')
    // Podium explicitly does not touch the money.
    expect(text.toLowerCase()).toContain('does not receive, hold, or disburse the fee')
  })

  it('renders the athlete payment details in Section 6 when provided', () => {
    const text = section6Text({
      ...base,
      paymentDetails: {
        accountHolderName: 'Maya A. Okafor',
        bankName: 'Barclays',
        accountNumber: '12345678',
        sortCode: '20-00-00',
        reference: 'Podium Summer 2026',
      },
    })
    expect(text).toContain('Maya A. Okafor')
    expect(text).toContain('12345678')
    expect(text).toContain('20-00-00')
    expect(text).toContain('Barclays')
    expect(text).toContain('Podium Summer 2026')
  })

  it('falls back to reference wording and no placeholder when no payment details are given', () => {
    const text = section6Text(base)
    expect(text.toLowerCase()).toContain('payment details')
    // no bank fields leaked, and the whole-agreement placeholder invariant holds
    expect(text).not.toContain('Account holder')
    expect(allText({ ...base, paymentDetails: null }).match(/\[[^\]]+\]/g)).toBeNull()
  })

  it('keeps the placeholder invariant with payment details present', () => {
    const text = allText({
      ...base,
      paymentDetails: { accountHolderName: 'Maya A. Okafor', accountNumber: '12345678' },
    })
    expect(text.match(/\[[^\]]+\]/g)).toBeNull()
  })
})

describe('buildAgreement — minor / guardian', () => {
  it('adds a guardian co-signature block only when the athlete is a minor', () => {
    const minor = buildAgreement({
      ...base,
      isMinor: true,
      guardian: { name: 'Jordan Okafor', relationship: 'Parent' },
    })
    const sig = minor.sections.find((s) => s.number === '12')!
    const text = sig.blocks.flatMap((b) => (b.kind === 'para' ? [b.text] : b.kind === 'bullets' ? b.items : [b.label, b.value])).join('\n')
    expect(text).toContain('Jordan Okafor')
    expect(text.toLowerCase()).toContain('guardian')

    const adult = buildAgreement(base)
    const adultSig = adult.sections.find((s) => s.number === '12')!
    const adultText = adultSig.blocks.flatMap((b) => (b.kind === 'para' ? [b.text] : b.kind === 'bullets' ? b.items : [b.label, b.value])).join('\n')
    expect(adultText.toLowerCase()).not.toContain('guardian')
  })
})

describe('buildAgreement — vetted static protections survive verbatim', () => {
  it('keeps the university playing-kit restriction (section 4)', () => {
    const s4 = buildAgreement(base).sections.find((s) => s.number === '4')!
    const text = s4.blocks.map((b) => (b.kind === 'para' ? b.text : '')).join('\n')
    expect(text.toLowerCase()).toContain('playing')
    expect(text.toLowerCase()).toContain('not permitted')
  })
})
