import { html, raw, escapeHtml } from './escape'
import { button } from './render'
import { sendViaProvider } from './provider'

/**
 * Guardian email (punch-list 2.3).
 *
 * These messages go to a parent or guardian who is NOT a Podium user, so they
 * deliberately bypass lib/email's user-preference / suppression / delivery-ledger
 * machinery (all keyed on a userId) and render their own guardian-appropriate
 * shell. A consent request is a legal necessity and must not be silenceable by
 * the athlete's notification settings.
 *
 * Like the rest of the email stack, these never throw: a mail failure must not
 * roll back the action that triggered it. The transport no-ops when
 * RESEND_API_KEY is unset.
 */

const INK = '#2E3440'
const MUTED = '#434C5E'
const BRAND = 'Podium'

export interface GuardianSendResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

function guardianLayout(preheader: string, bodyHtml: string): string {
  return html`<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6FA;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FA;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${raw(INK)};">${raw(BRAND)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;color:${raw(INK)};font-size:15px;line-height:1.55;">
              ${raw(bodyHtml)}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #E5E9F0;color:${raw(MUTED)};font-size:12px;line-height:1.6;">
              You received this because you were listed as a parent or guardian on ${raw(BRAND)}. If this was not expected, you can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function deliver(params: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<GuardianSendResult> {
  try {
    const result = await sendViaProvider(params)
    if (result.ok) return { ok: true }
    if ('skipped' in result) return { ok: false, skipped: true, error: result.error }
    return { ok: false, error: result.error }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'guardian email error' }
  }
}

export interface ConsentRequestEmail {
  to: string
  guardianName: string | null
  athleteName: string
  consentUrl: string
  ttlDays?: number
}

/** The emailed link a guardian follows to grant one-time blanket consent. */
export async function sendGuardianConsentRequestEmail(
  params: ConsentRequestEmail
): Promise<GuardianSendResult> {
  const { to, guardianName, athleteName, consentUrl } = params
  const ttlDays = params.ttlDays ?? 7
  const greeting = guardianName?.trim() ? guardianName.trim() : 'there'

  const body = html`<p style="margin:0 0 14px 0;">Hello ${greeting},</p>
<p style="margin:0 0 14px 0;">${athleteName} is under 18 and has set up a ${raw(BRAND)} account to find sponsorship and brand deals. Before they can sign any agreement or receive any payment, we need your consent as their parent or guardian.</p>
<p style="margin:0 0 6px 0;">Please review and confirm using the button below. This link expires in ${String(ttlDays)} days.</p>
${raw(button('Review and give consent', consentUrl))}
<p style="margin:14px 0 0 0;color:${raw(MUTED)};font-size:13px;">If the button does not work, paste this link into your browser:<br />${consentUrl}</p>`

  const text = [
    `Hello ${greeting},`,
    '',
    `${athleteName} is under 18 and has set up a ${BRAND} account to find sponsorship and brand deals. Before they can sign any agreement or receive any payment, we need your consent as their parent or guardian.`,
    '',
    `Review and give consent: ${consentUrl}`,
    '',
    `This link expires in ${ttlDays} days. If this was not expected, you can ignore this email.`,
  ].join('\n')

  return deliver({
    to,
    subject: `Consent needed for ${athleteName} on ${BRAND}`,
    html: guardianLayout(`Consent needed for ${escapeHtml(athleteName)}`, body),
    text,
  })
}

export interface DealNoticeEmail {
  to: string
  guardianName: string | null
  athleteName: string
  brandName: string
  dealTitle: string
  amountFormatted: string
}

/** Informational notice to the guardian when their under-18 athlete signs a deal. */
export async function sendGuardianDealNoticeEmail(
  params: DealNoticeEmail
): Promise<GuardianSendResult> {
  const { to, guardianName, athleteName, brandName, dealTitle, amountFormatted } = params
  const greeting = guardianName?.trim() ? guardianName.trim() : 'there'

  const body = html`<p style="margin:0 0 14px 0;">Hello ${greeting},</p>
<p style="margin:0 0 14px 0;">${athleteName} has just signed a deal on ${raw(BRAND)}. As their parent or guardian, here are the details for your records.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;font-size:14px;color:${raw(INK)};">
  <tr><td style="padding:2px 12px 2px 0;color:${raw(MUTED)};">Brand</td><td style="padding:2px 0;">${brandName}</td></tr>
  <tr><td style="padding:2px 12px 2px 0;color:${raw(MUTED)};">Deal</td><td style="padding:2px 0;">${dealTitle}</td></tr>
  <tr><td style="padding:2px 12px 2px 0;color:${raw(MUTED)};">Value</td><td style="padding:2px 0;">${amountFormatted}</td></tr>
</table>
<p style="margin:0;">No action is needed. You are receiving this as a notice.</p>`

  const text = [
    `Hello ${greeting},`,
    '',
    `${athleteName} has just signed a deal on ${BRAND}. As their parent or guardian, here are the details for your records.`,
    '',
    `Brand: ${brandName}`,
    `Deal: ${dealTitle}`,
    `Value: ${amountFormatted}`,
    '',
    'No action is needed. You are receiving this as a notice.',
  ].join('\n')

  return deliver({
    to,
    subject: `${athleteName} signed a deal on ${BRAND}`,
    html: guardianLayout(`${escapeHtml(athleteName)} signed a deal`, body),
    text,
  })
}
