import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import { buildAgreement, type AgreementInput, type AgreementSection } from './agreement'

// Re-export the shared types from their framework-free home so existing
// imports from './pdf' keep working.
export type { ContractPdfParty, ContractPdfTerms, ContractPdfSignature } from './pdf-types'

const INK = '#2E3440'
const ACCENT = '#456489'
const MUTED = '#6B7280'

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 56, fontFamily: 'Helvetica', color: INK, fontSize: 10.5, lineHeight: 1.5 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 2 },
  docType: { fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  meta: { fontSize: 8, color: MUTED, marginBottom: 2 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  para: { marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 120, color: MUTED },
  value: { flex: 1 },
  bulletRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 8 },
  bulletDot: { width: 12 },
  bulletText: { flex: 1 },
  rule: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 10 },
  auditTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  sigBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  sigName: { fontFamily: 'Helvetica-Bold' },
  sigMeta: { fontSize: 8, color: MUTED },
  hash: { fontFamily: 'Courier', fontSize: 7, color: MUTED },
  footer: { fontSize: 8, color: MUTED, marginTop: 16, fontStyle: 'italic' },
})

function SectionView({ section }: { section: AgreementSection }) {
  return (
    <View wrap>
      <Text style={styles.sectionTitle}>{section.number}. {section.title}</Text>
      {section.blocks.map((b, i) => {
        if (b.kind === 'para') return <Text key={i} style={styles.para}>{b.text}</Text>
        if (b.kind === 'termRow') {
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{b.label}</Text>
              <Text style={styles.value}>{b.value}</Text>
            </View>
          )
        }
        return (
          <View key={i}>
            {b.items.map((item, j) => (
              <View key={j} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

function ContractDoc(input: AgreementInput) {
  const agreement = buildAgreement(input)
  const { signatures } = agreement
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Podium</Text>
        <Text style={styles.docType}>Athlete Sponsorship Agreement</Text>
        <Text style={styles.h1}>{agreement.title}</Text>
        <Text style={styles.meta}>Agreement reference: {agreement.referenceId}</Text>
        <Text style={styles.meta}>Effective date: {agreement.effectiveDate}</Text>
        {agreement.sections.map((s) => (
          <SectionView key={s.number} section={s} />
        ))}
        <Text style={styles.footer}>
          This agreement is facilitated through Podium and is not legal advice. Both Parties should
          seek independent legal review before signing, particularly regarding sponsorship
          eligibility, minors, university guidelines, and applicable jurisdiction.
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.auditTitle}>Signature audit certificate</Text>
        <Text style={styles.sigMeta}>Contract ID: {agreement.referenceId}</Text>
        <View style={styles.rule} />
        {signatures.length === 0 ? (
          <Text style={styles.sigMeta}>Awaiting signatures.</Text>
        ) : (
          signatures.map((s) => (
            <View key={s.role} style={styles.sigBlock}>
              <Text style={styles.sigName}>{s.typedName} — {s.role}</Text>
              <Text style={styles.sigMeta}>Signed at (UTC): {s.signedAt}</Text>
              <Text style={styles.sigMeta}>IP: {s.ip ?? 'not recorded'}</Text>
              <Text style={styles.hash}>Audit hash: {s.signatureHash}</Text>
            </View>
          ))
        )}
        <View style={styles.rule} />
        <Text style={styles.sigMeta}>
          This certificate records simple electronic signatures (ESIGN/UETA/eIDAS).
          Each party confirmed intent to be legally bound at signing.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderContractPdf(input: AgreementInput): Promise<Buffer> {
  return renderToBuffer(<ContractDoc {...input} />)
}
