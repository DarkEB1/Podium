import { html, raw, hrefAttr } from './escape'

/**
 * The shared HTML shell for every transactional email, plus its plain-text
 * counterpart.
 *
 * Design constraints, all driven by "a mail client is not a browser":
 *   - Inline styles only. Gmail strips <style> blocks and <head>.
 *   - Table-based layout. Fl/ grid are unreliable across Outlook/older clients.
 *   - A visible-text preheader is avoided; a hidden one is included for the
 *     inbox preview line.
 *   - Every email carries the CL-4 footer: a manage-preferences link and, when
 *     provided, a one-click unsubscribe. That footer is not optional — it is
 *     the legal requirement, so it lives in the shell, not the templates.
 *
 * All dynamic values arrive here already escaped by the `html` helper or are
 * escaped on the way in. `bodyHtml` is trusted: it is the template's own output,
 * itself built with the escaping helpers.
 */

const BRAND = 'Podium'
const MUTED = '#434C5E' // matches --muted-foreground (A-3, ≥4.5:1)
const INK = '#2E3440'
const ACCENT = '#456489' // matches --primary (A-3)

export interface LayoutOptions {
  preheader: string
  bodyHtml: string
  /** Manage-notification-preferences URL (always present). */
  preferencesUrl: string
  /** One-click unsubscribe URL, when the event is unsubscribable. */
  unsubscribeUrl?: string
}

export function renderLayout(opts: LayoutOptions): string {
  const { preheader, bodyHtml, preferencesUrl, unsubscribeUrl } = opts

  const footerLinks = unsubscribeUrl
    ? html`<a href="${raw(hrefAttr(preferencesUrl))}" style="color:${raw(MUTED)};text-decoration:underline;">Manage email preferences</a>
        &nbsp;·&nbsp;
        <a href="${raw(hrefAttr(unsubscribeUrl))}" style="color:${raw(MUTED)};text-decoration:underline;">Unsubscribe</a>`
    : html`<a href="${raw(hrefAttr(preferencesUrl))}" style="color:${raw(MUTED)};text-decoration:underline;">Manage email preferences</a>`

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
              ${raw(footerLinks)}
              <br />
              You are receiving this because you have a ${raw(BRAND)} account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** A primary button, table-based so Outlook renders it. `label` and `url` escaped. */
export function button(label: string, url: string): string {
  return html`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="border-radius:8px;background:${raw(ACCENT)};">
        <a href="${raw(hrefAttr(url))}" style="display:inline-block;padding:11px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`
}

/**
 * Build the plain-text alternative. Every HTML email must ship a text/plain
 * part — it is what text-only clients show, and a missing text part measurably
 * raises spam scores. Templates hand us pre-joined lines.
 */
export function renderText(lines: string[], footerUrls: { preferencesUrl: string; unsubscribeUrl?: string }): string {
  const footer = [
    '',
    '—',
    `Manage email preferences: ${footerUrls.preferencesUrl}`,
    footerUrls.unsubscribeUrl ? `Unsubscribe: ${footerUrls.unsubscribeUrl}` : '',
    `You are receiving this because you have a ${BRAND} account.`,
  ].filter(Boolean)
  return [...lines, ...footer].join('\n')
}
