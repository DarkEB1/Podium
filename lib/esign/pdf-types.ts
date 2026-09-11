// Shared, framework-free types for the contract PDF pipeline. Kept out of
// pdf.tsx so the pure agreement builder (agreement.ts) and its tests do not
// pull in @react-pdf/renderer.

export interface ContractPdfParty {
  role: 'brand' | 'athlete' | 'agent'
  displayName: string
  company?: string | null
}

export interface ContractPdfTerms {
  title: string
  payAmount: number
  payCurrency: string
  payType: string
  timelineStart?: string | null
  timelineEnd?: string | null
  deliverables?: string | null
  usageRights?: string | null
  additionalTerms?: string | null
}

export interface ContractPdfSignature {
  role: string
  typedName: string
  signedAt: string
  ip: string | null
  signatureHash: string
  signatureImageDataUrl?: string | null
}
