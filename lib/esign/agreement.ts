// Builds the Podium Athlete Sponsorship Agreement (the professionally vetted
// base contract) as a structured, testable representation. `pdf.tsx` lays this
// out; keeping the content here means the legal text, the mapped deal values,
// and the tunable defaults are all unit-testable without rendering a PDF.
//
// Rules this module holds itself to:
//  - The vetted clause wording is reproduced faithfully; only the blanks are
//    filled from deal data or from AGREEMENT_DEFAULTS.
//  - No unfilled "[PLACEHOLDER]" may ever survive into the output (a bracketed
//    blank in a signed contract is a broken document). Optional details are
//    omitted entirely when their data is absent.
//  - Payment wording stays facilitator-neutral: the Sponsor is the payer and
//    Podium facilitates. The platform has no athlete-payout, escrow, milestone
//    or refund mechanism today, so the contract must not promise one.

import type { ContractPdfTerms, ContractPdfSignature } from './pdf-types'

export interface AgreementParty {
  role: 'brand' | 'athlete' | 'agent'
  displayName: string
  legalName?: string | null
  company?: string | null
  email?: string | null
  /** Postal / registered address. Omitted from the identity line when absent. */
  address?: string | null
  /** e.g. sport / team / institution for an athlete. Omitted when absent. */
  descriptor?: string | null
  /** Signatory acting for an entity, e.g. a team's commercial controller. */
  representativeName?: string | null
  representativeTitle?: string | null
}

export interface AgreementGuardian {
  name: string
  relationship?: string | null
}

export interface AgreementInput {
  contractId: string
  terms: ContractPdfTerms
  parties: AgreementParty[]
  signatures: ContractPdfSignature[]
  isMinor?: boolean
  guardian?: AgreementGuardian | null
  /** Per-call override of the baked defaults. Rarely needed. */
  defaults?: Partial<AgreementDefaults>
}

/**
 * The nine platform-wide values that fill the agreement's non-deal-specific
 * blanks. These carry legal meaning and are pending sign-off by the
 * professionals who vetted the template (see the mapping proposal doc). Change
 * a reviewer decision here in one place.
 */
export interface AgreementDefaults {
  governingLaw: string
  jurisdiction: string
  liabilityCap: string
  terminationNoticeDays: number
  curePeriodDays: number
  refundClause: string
  licenceExclusivity: string
  licenceTerritory: string
  licenceUsagePeriod: string
  autoRenew: boolean
  paymentTimingDays: number
  expensesPayable: boolean
  latePayment: string
}

export const AGREEMENT_DEFAULTS: AgreementDefaults = {
  governingLaw: 'England and Wales',
  jurisdiction: 'the courts of England and Wales',
  liabilityCap: 'the total Fee payable under this Agreement',
  terminationNoticeDays: 14,
  curePeriodDays: 7,
  refundClause:
    'the Athlete shall refund to the Sponsor any advance paid for Services not yet delivered as at the termination date.',
  licenceExclusivity: 'non-exclusive',
  licenceTerritory: 'the United Kingdom',
  licenceUsagePeriod: 'the Term',
  autoRenew: false,
  paymentTimingDays: 14,
  expensesPayable: false,
  latePayment: 'the statutory rate',
}

export type AgreementBlock =
  | { kind: 'para'; text: string }
  | { kind: 'termRow'; label: string; value: string }
  | { kind: 'bullets'; items: string[] }

export interface AgreementSection {
  number: string
  title: string
  blocks: AgreementBlock[]
}

export interface BuiltAgreement {
  title: string
  referenceId: string
  effectiveDate: string
  sections: AgreementSection[]
  parties: AgreementParty[]
  signatures: ContractPdfSignature[]
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10)
}

function payStructure(payType: string): string {
  return (
    {
      flat_fee: 'a lump sum on completion of the Services',
      monthly_retainer: 'a monthly retainer for the duration of the Term',
      per_post: 'a per-deliverable basis',
      revenue_share: 'a revenue-share basis',
    } as Record<string, string>
  )[payType] ?? 'the basis agreed between the Parties'
}

function partyName(p: AgreementParty | undefined): string {
  if (!p) return 'the Party'
  return p.legalName || p.company || p.displayName
}

/** Compose a party's identifying line for Section 1, omitting absent details. */
function partyIdentity(p: AgreementParty | undefined): string {
  if (!p) return 'the Party'
  const bits: string[] = [partyName(p)]
  if (p.address) bits.push(`of ${p.address}`)
  if (p.descriptor) bits.push(p.descriptor)
  if (p.representativeName) {
    bits.push(
      p.representativeTitle
        ? `represented by ${p.representativeName}, ${p.representativeTitle}`
        : `represented by ${p.representativeName}`
    )
  }
  return bits.join(', ')
}

export function buildAgreement(input: AgreementInput): BuiltAgreement {
  const d: AgreementDefaults = { ...AGREEMENT_DEFAULTS, ...(input.defaults ?? {}) }
  const { terms, parties, signatures } = input
  const brand = parties.find((p) => p.role === 'brand')
  const athlete = parties.find((p) => p.role === 'athlete')
  const agent = parties.find((p) => p.role === 'agent')

  const lastSignedAt = signatures
    .map((s) => s.signedAt)
    .filter(Boolean)
    .sort()
    .at(-1)
  const effectiveDate = fmtDate(lastSignedAt) ?? 'the date of the last signature below'

  const start = fmtDate(terms.timelineStart)
  const end = fmtDate(terms.timelineEnd)
  const termEnd = end ?? 'the completion of the Services'

  const sections: AgreementSection[] = []

  // 1. Parties & Effective Date
  const partiesBlocks: AgreementBlock[] = [
    {
      kind: 'para',
      text: `This Athlete Sponsorship Agreement (the "Agreement") is made on ${effectiveDate} (the "Effective Date") between the following Parties, and is introduced and administered through Podium (the "Platform"), which is not itself a party to the commercial terms below except as expressly stated.`,
    },
    { kind: 'termRow', label: 'Athlete', value: partyIdentity(athlete) },
    { kind: 'termRow', label: 'Sponsor', value: partyIdentity(brand) },
  ]
  if (agent) partiesBlocks.push({ kind: 'termRow', label: 'Agent', value: partyIdentity(agent) })
  partiesBlocks.push({
    kind: 'para',
    text: 'The Athlete and the Sponsor are each a "Party" and together the "Parties."',
  })
  if (input.isMinor && input.guardian?.name) {
    const rel = input.guardian.relationship ? ` (${input.guardian.relationship})` : ''
    partiesBlocks.push({
      kind: 'para',
      text: `The Athlete is under 18. This Agreement is co-signed by ${input.guardian.name}${rel} as parent or legal guardian, who agrees to be bound by its terms.`,
    })
  }
  sections.push({ number: '1', title: 'Parties & Effective Date', blocks: partiesBlocks })

  // 2. Sponsorship Scope & Deliverables
  const scope: AgreementBlock[] = [
    {
      kind: 'para',
      text: 'In exchange for the sponsorship provided under this Agreement, the Athlete agrees to provide the following promotional services and deliverables (the "Services"):',
    },
    { kind: 'termRow', label: 'Engagement', value: terms.title },
  ]
  if (terms.deliverables) scope.push({ kind: 'termRow', label: 'Deliverables', value: terms.deliverables })
  if (start || end) {
    scope.push({ kind: 'termRow', label: 'Schedule', value: `${start ?? 'the Effective Date'} to ${termEnd}` })
  }
  scope.push({
    kind: 'para',
    text: 'The Athlete shall perform the Services with reasonable skill and care and in a professional manner consistent with their public standing.',
  })
  sections.push({ number: '2', title: 'Sponsorship Scope & Deliverables', blocks: scope })

  // 3. Additional Sponsor Needs & Wants
  const additional: AgreementBlock[] = [
    {
      kind: 'para',
      text: 'This section captures any additional requests, preferences, or bespoke requirements of the Sponsor that fall outside the core deliverables in Section 2. The Athlete shall use reasonable efforts to accommodate these:',
    },
    {
      kind: 'para',
      text: terms.additionalTerms && terms.additionalTerms.trim()
        ? terms.additionalTerms
        : 'No additional needs or wants were specified for this engagement.',
    },
    {
      kind: 'para',
      text: '3.1. The Athlete shall comply with the reasonable additional needs and wants set out above, and with reasonable further requests made by the Sponsor during the Term, except where doing so would breach the rules, policies, or guidelines of the Athlete’s university, institution, conference, or governing body.',
    },
    {
      kind: 'para',
      text: '3.2. Where any deliverable in Section 2 or any request would conflict with the Athlete’s university or governing-body guidelines, the Athlete must clearly communicate this to the Sponsor in writing before this Agreement is signed.',
    },
  ]
  sections.push({ number: '3', title: 'Additional Sponsor Needs & Wants', blocks: additional })

  // 4. University & Governing-Body Restrictions (vetted protection, verbatim)
  sections.push({
    number: '4',
    title: 'University & Governing-Body Restrictions',
    blocks: [
      {
        kind: 'para',
        text: '4.1. Playing kit restriction. The Parties acknowledge that individual sponsors are not permitted on university-issued playing shirts or official team kit. No Service or request under this Agreement may require the Sponsor’s name, logo, or branding to appear on university team shirts or kit. Branded wear is limited to the Athlete’s own personal apparel, training wear, or other items expressly permitted by the Athlete’s institution.',
      },
      {
        kind: 'para',
        text: '4.2. The Athlete’s participation must comply with all applicable rules and the policies of their institution, conference, and governing body. Each Party is responsible for confirming its own eligibility and disclosure obligations. If a guideline change during the Term makes any deliverable non-compliant, the Athlete shall notify the Sponsor promptly and the Parties will agree a compliant substitute in good faith.',
      },
    ],
  })

  // 5. Term
  sections.push({
    number: '5',
    title: 'Term',
    blocks: [
      {
        kind: 'para',
        text: `This Agreement begins on the Effective Date and continues until ${termEnd}, unless terminated earlier under Section 9 (the "Term").`,
      },
      {
        kind: 'para',
        text: d.autoRenew
          ? 'The Term will automatically renew unless either Party gives written notice before the then-current Term ends.'
          : 'This Agreement will not automatically renew. Any extension must be agreed in writing by both Parties.',
      },
    ],
  })

  // 6. Fee & Payment (facilitator-neutral: Sponsor pays, Podium facilitates)
  const expenses = d.expensesPayable
    ? 'Pre-approved, reasonable expenses are reimbursable.'
    : 'Expenses are not payable unless agreed in writing in advance.'
  sections.push({
    number: '6',
    title: 'Sponsorship Fee & Payment',
    blocks: [
      {
        kind: 'para',
        text: `In consideration for the Services, the Sponsor shall pay the Athlete a total sponsorship fee of ${money(terms.payAmount, terms.payCurrency)} (the "Fee").`,
      },
      { kind: 'para', text: `The Fee is payable as ${payStructure(terms.payType)}.` },
      {
        kind: 'para',
        text: `The Sponsor shall pay the Athlete within ${d.paymentTimingDays} days of the Athlete delivering the agreed Services, or of milestone approval where applicable. Payment is arranged through the Podium platform; Podium facilitates the Agreement and is not the payer of the Fee.`,
      },
      { kind: 'para', text: expenses },
      {
        kind: 'para',
        text: 'The Parties acknowledge Podium may charge a platform or service fee as disclosed on the Platform.',
      },
      {
        kind: 'para',
        text: `Undisputed sums unpaid after the due date accrue interest at ${d.latePayment}. Each Party is responsible for its own taxes. The Athlete is an independent contractor, not an employee of the Sponsor or Podium.`,
      },
    ],
  })

  // 7. Licence & Usage Rights
  const licenceBlocks: AgreementBlock[] = [
    {
      kind: 'para',
      text: `The Athlete grants the Sponsor a ${d.licenceExclusivity} licence, for ${d.licenceTerritory}, to use their name, image, likeness, voice, and approved content solely for the purposes described in Sections 2 and 3, for ${d.licenceUsagePeriod}.`,
    },
  ]
  if (terms.usageRights) licenceBlocks.push({ kind: 'termRow', label: 'Agreed usage', value: terms.usageRights })
  licenceBlocks.push({
    kind: 'para',
    text: 'The Athlete retains ownership of their underlying likeness; the Sponsor owns the specific campaign creative it commissions, subject to the licence terms above.',
  })
  sections.push({ number: '7', title: 'Licence & Usage Rights', blocks: licenceBlocks })

  // 8. Obligations of the Parties (vetted, verbatim)
  sections.push({
    number: '8',
    title: 'Obligations of the Parties',
    blocks: [
      { kind: 'para', text: '8.1. Athlete obligations:' },
      {
        kind: 'bullets',
        items: [
          'Deliver the Services on time and to the agreed specification;',
          'Comply with reasonable Sponsor requests, subject to university and governing-body guidelines;',
          'Obtain the Sponsor’s written approval where required before publishing;',
          'Keep published content live for the agreed minimum period;',
          'Not disparage the Sponsor and act consistently with good faith and fair dealing.',
        ],
      },
      { kind: 'para', text: '8.2. Sponsor obligations:' },
      {
        kind: 'bullets',
        items: [
          'Pay the Fee in full and on time under Section 6;',
          'Provide any assets, briefs, products, or access the Athlete needs, on time;',
          'Respect university and governing-body restrictions communicated by the Athlete;',
          'Use the Athlete’s likeness only as licensed and not in a misleading or damaging way;',
          'Not disparage the Athlete and act consistently with good faith and fair dealing.',
        ],
      },
    ],
  })

  // 9. Termination
  sections.push({
    number: '9',
    title: 'Termination',
    blocks: [
      {
        kind: 'para',
        text: `9.1. Termination for convenience. Either Party may terminate on ${d.terminationNoticeDays} days’ written notice. On such termination the Athlete is paid for Services properly performed up to the termination date.`,
      },
      {
        kind: 'para',
        text: `9.2. Termination for cause by the Sponsor. The Sponsor may terminate immediately on written notice if the Athlete materially breaches this Agreement and does not remedy it within the cure period, fails to deliver the agreed deliverables, or engages in conduct that materially and demonstrably harms the Sponsor’s reputation.`,
      },
      {
        kind: 'para',
        text: '9.3. Termination for cause by the Athlete. The Athlete may terminate immediately on written notice if the Sponsor fails to pay undisputed sums when due, materially breaches and does not remedy within the cure period, uses the Athlete’s likeness outside the licensed scope, or requires the Athlete to breach university or governing-body guidelines.',
      },
      {
        kind: 'para',
        text: `9.4. Cure period. Except where stated as immediate, a Party in breach has ${d.curePeriodDays} days from written notice to remedy the breach before termination takes effect.`,
      },
      {
        kind: 'para',
        text: `9.5. Effect of termination. On termination, outstanding undisputed Fees for completed work become due; the usage licence for content not yet paid for ends; and ${d.refundClause} The confidentiality, ownership, and governing-law provisions survive termination.`,
      },
    ],
  })

  // 10. Good Faith & Fair Dealing (verbatim)
  sections.push({
    number: '10',
    title: 'Good Faith & Fair Dealing',
    blocks: [
      {
        kind: 'para',
        text: 'Each Party agrees to act honestly, in good faith, and to deal fairly with the other in performing this Agreement. Neither Party will act to frustrate the purpose of the Agreement or unreasonably withhold any approval, consent, or cooperation the other reasonably needs to perform. The Parties will first attempt to resolve any dispute amicably and in good faith before pursuing formal remedies.',
      },
    ],
  })

  // 11. General Provisions
  const notices = [brand?.email, athlete?.email].filter(Boolean).length > 0
    ? `Notices must be in writing and sent via the Platform${
        athlete?.email ? `, or to the Athlete at ${athlete.email}` : ''
      }${brand?.email ? `, or to the Sponsor at ${brand.email}` : ''}.`
    : 'Notices must be in writing and sent via the Platform.'
  sections.push({
    number: '11',
    title: 'General Provisions',
    blocks: [
      {
        kind: 'para',
        text: '11.1. Confidentiality. Each Party will keep the other’s non-public information and the commercial terms of this Agreement confidential, except as required by law or governing-body disclosure rules.',
      },
      {
        kind: 'para',
        text: '11.2. Indemnity. Each Party indemnifies the other against losses arising from its own breach of this Agreement, negligence, or misuse of the other’s rights.',
      },
      {
        kind: 'para',
        text: `11.3. Limitation of liability. Neither Party is liable for indirect or consequential loss. Each Party’s total liability under this Agreement is capped at ${d.liabilityCap}, except for liability that cannot be excluded by law.`,
      },
      {
        kind: 'para',
        text: '11.4. Independent contractor. Nothing here creates an employment, partnership, agency, or joint-venture relationship between the Parties or with Podium.',
      },
      {
        kind: 'para',
        text: '11.5. Assignment. Neither Party may assign this Agreement without the other’s written consent. 11.6. This Agreement is the entire agreement between the Parties and supersedes prior discussions; amendments must be in writing and signed by both Parties, and an approved electronic amendment via the Platform satisfies this.',
      },
      { kind: 'para', text: `11.7. ${notices}` },
      {
        kind: 'para',
        text: `11.8. Governing law & jurisdiction. This Agreement is governed by the laws of ${d.governingLaw}, and the Parties submit to the exclusive jurisdiction of ${d.jurisdiction}.`,
      },
      {
        kind: 'para',
        text: '11.9. Severability. If any provision is held unenforceable, the rest of the Agreement remains in effect. 11.10. The Parties agree that electronic signatures executed via the Podium Platform are valid and binding.',
      },
    ],
  })

  // 12. Signatures
  const sigBlocks: AgreementBlock[] = [
    {
      kind: 'para',
      text: 'By signing below, each Party confirms it has read, understood, and agrees to be bound by this Agreement.',
    },
  ]
  const roleLabel: Record<string, string> = { brand: 'Sponsor', athlete: 'Athlete', agent: 'Agent' }
  for (const s of signatures) {
    const when = fmtDate(s.signedAt) ?? s.signedAt
    sigBlocks.push({
      kind: 'para',
      text: `${roleLabel[s.role] ?? s.role}: ${s.typedName}, signed ${when}.`,
    })
  }
  if (signatures.length === 0) {
    sigBlocks.push({ kind: 'para', text: 'Awaiting signatures.' })
  }
  if (input.isMinor && input.guardian?.name) {
    const rel = input.guardian.relationship ? ` (${input.guardian.relationship})` : ''
    sigBlocks.push({
      kind: 'para',
      text: `Parent / Guardian: ${input.guardian.name}${rel}, co-signing on behalf of the minor Athlete.`,
    })
  }
  sections.push({ number: '12', title: 'Signatures', blocks: sigBlocks })

  return {
    title: terms.title,
    referenceId: input.contractId,
    effectiveDate,
    sections,
    parties,
    signatures,
  }
}
