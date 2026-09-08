import React from 'react'
import {
  Document, Page, Text, View, Image, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

const INK = '#2E3440'
const ACCENT = '#456489'
const MUTED = '#6B7280'

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

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 56, fontFamily: 'Helvetica', color: INK, fontSize: 11, lineHeight: 1.5 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 2 },
  docType: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
  h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 130, color: MUTED },
  value: { flex: 1 },
  rule: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 10 },
  sigBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  sigName: { fontFamily: 'Helvetica-Bold' },
  sigMeta: { fontSize: 8, color: MUTED },
  sigImg: { height: 40, marginBottom: 4 },
  auditTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  hash: { fontFamily: 'Courier', fontSize: 7, color: MUTED },
})

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
function payTypeLabel(v: string): string {
  return ({ flat_fee: 'Flat fee', monthly_retainer: 'Monthly retainer', per_post: 'Per post', revenue_share: 'Revenue share' } as Record<string, string>)[v] ?? v
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10)
}

function TermRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

function ContractDoc(input: {
  contractId: string
  terms: ContractPdfTerms
  parties: ContractPdfParty[]
  signatures: ContractPdfSignature[]
}) {
  const { terms, parties, signatures } = input
  const timeline =
    terms.timelineStart || terms.timelineEnd
      ? `${terms.timelineStart ?? '—'} to ${terms.timelineEnd ?? '—'}`
      : 'Not specified'
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Podium</Text>
        <Text style={styles.docType}>Sponsorship Agreement</Text>
        <Text style={styles.h1}>{terms.title}</Text>

        <Text style={styles.sectionTitle}>Parties</Text>
        {parties.map((p) => (
          <TermRow
            key={p.role}
            label={p.role === 'brand' ? 'Brand' : p.role === 'agent' ? 'Agent' : 'Athlete / Team'}
            value={p.company ? `${p.displayName} (${p.company})` : p.displayName}
          />
        ))}

        <Text style={styles.sectionTitle}>Commercial terms</Text>
        <TermRow label="Fee" value={money(terms.payAmount, terms.payCurrency)} />
        <TermRow label="Pay type" value={payTypeLabel(terms.payType)} />
        <TermRow label="Timeline" value={timeline} />
        {terms.deliverables ? <TermRow label="Deliverables" value={terms.deliverables} /> : null}
        {terms.usageRights ? <TermRow label="Usage rights" value={terms.usageRights} /> : null}

        {terms.additionalTerms ? (
          <>
            <Text style={styles.sectionTitle}>Additional terms</Text>
            <Text>{terms.additionalTerms}</Text>
          </>
        ) : null}

        <View style={styles.rule} />
        <Text style={styles.sectionTitle}>Signatures</Text>
        {signatures.length === 0 ? (
          <Text style={styles.sigMeta}>Awaiting signatures.</Text>
        ) : (
          signatures.map((s) => (
            <View key={s.role} style={styles.sigBlock}>
              {s.signatureImageDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
                <Image style={styles.sigImg} src={s.signatureImageDataUrl} />
              ) : null}
              <Text style={styles.sigName}>{s.typedName}</Text>
              <Text style={styles.sigMeta}>
                {s.role} · signed {fmtDate(s.signedAt)}{s.ip ? ` · IP ${s.ip}` : ''}
              </Text>
            </View>
          ))
        )}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.auditTitle}>Signature audit certificate</Text>
        <Text style={styles.sigMeta}>Contract ID: {input.contractId}</Text>
        <View style={styles.rule} />
        {signatures.map((s) => (
          <View key={s.role} style={styles.sigBlock}>
            <Text style={styles.sigName}>{s.typedName} — {s.role}</Text>
            <Text style={styles.sigMeta}>Signed at (UTC): {s.signedAt}</Text>
            <Text style={styles.sigMeta}>IP: {s.ip ?? 'not recorded'}</Text>
            <Text style={styles.hash}>Audit hash: {s.signatureHash}</Text>
          </View>
        ))}
        <View style={styles.rule} />
        <Text style={styles.sigMeta}>
          This certificate records simple electronic signatures (ESIGN/UETA/eIDAS).
          Each party confirmed intent to be legally bound at signing.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderContractPdf(input: {
  contractId: string
  terms: ContractPdfTerms
  parties: ContractPdfParty[]
  signatures: ContractPdfSignature[]
}): Promise<Buffer> {
  return renderToBuffer(<ContractDoc {...input} />)
}
