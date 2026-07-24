import { html, raw } from './escape'
import { renderLayout, renderText, button } from './render'
import type { EmailEvent, RenderedEmail, TemplateData } from './types'

/**
 * One template per catalogue event. Each takes already-resolved data (the
 * caller does the DB work) and returns subject + HTML + text.
 *
 * SECURITY (B-8/SEC-1): every value below is user-influenced — display names,
 * proposal titles, a free-text connection message. They are interpolated ONLY
 * through the `html` tagged template, which escapes by default. The layout
 * ("raw(bodyHtml)") is the sole trusted insertion, and it is our own escaped
 * output. There is no path from user input to unescaped markup.
 *
 * Footer URLs (preferences, unsubscribe) are attached by the render layer, so
 * each template only needs to produce its body + subject + text lines.
 */

interface FooterUrls {
  preferencesUrl: string
  unsubscribeUrl?: string
}

type Renderer<E extends EmailEvent> = (data: TemplateData[E], footer: FooterUrls) => RenderedEmail

function compose(
  subject: string,
  preheader: string,
  bodyHtml: string,
  textLines: string[],
  footer: FooterUrls
): RenderedEmail {
  return {
    subject,
    html: renderLayout({ preheader, bodyHtml, ...footer }),
    text: renderText(textLines, footer),
  }
}

const templates: { [E in EmailEvent]: Renderer<E> } = {
  connection_request_received: (d, footer) =>
    compose(
      `${d.senderName} wants to connect on Podium`,
      `${d.senderName} sent you a connection request.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;"><strong>${d.senderName}</strong> sent you a connection request:</p>
        <blockquote style="margin:0 0 12px;padding:12px 16px;border-left:3px solid #E5E9F0;color:#434C5E;">${d.message}</blockquote>
        ${raw(button('Review request', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `${d.senderName} sent you a connection request:`,
        `"${d.message}"`,
        '',
        `Review it: ${d.url}`,
      ],
      footer
    ),

  connection_request_accepted: (d, footer) =>
    compose(
      `${d.otherName} accepted your connection request`,
      `You can now message ${d.otherName}.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;"><strong>${d.otherName}</strong> accepted your connection request. You can now message each other and start a deal.</p>
        ${raw(button('Open conversation', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `${d.otherName} accepted your connection request. You can now message each other.`,
        '',
        `Open the conversation: ${d.url}`,
      ],
      footer
    ),

  proposal_received: (d, footer) =>
    compose(
      `New proposal: ${d.proposalTitle}`,
      `${d.senderName} sent you a deal proposal.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;"><strong>${d.senderName}</strong> sent you a proposal: <strong>${d.proposalTitle}</strong>.</p>
        ${raw(button('View proposal', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `${d.senderName} sent you a proposal: "${d.proposalTitle}".`,
        '',
        `View it: ${d.url}`,
      ],
      footer
    ),

  proposal_accepted: (d, footer) =>
    compose(
      `Your proposal was accepted: ${d.proposalTitle}`,
      `Your proposal "${d.proposalTitle}" was accepted.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;">Your proposal <strong>${d.proposalTitle}</strong> was accepted. A contract has been created for you to review and sign.</p>
        ${raw(button('Review contract', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `Your proposal "${d.proposalTitle}" was accepted. A contract is ready to review and sign.`,
        '',
        `Review it: ${d.url}`,
      ],
      footer
    ),

  contract_fully_signed: (d, footer) =>
    compose(
      'Your contract is fully signed',
      `Your contract with ${d.counterpartyName} is now fully signed.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;">Your contract with <strong>${d.counterpartyName}</strong> is now fully signed and in effect. You can view the signed copy any time.</p>
        ${raw(button('View contract', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `Your contract with ${d.counterpartyName} is now fully signed and in effect.`,
        '',
        `View it: ${d.url}`,
      ],
      footer
    ),

  payment_received: (d, footer) =>
    compose(
      `You received a payment of ${d.amountFormatted}`,
      `${d.fromName} paid you ${d.amountFormatted}.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;">You received <strong>${d.amountFormatted}</strong> from <strong>${d.fromName}</strong>.</p>
        ${raw(button('View payment', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `You received ${d.amountFormatted} from ${d.fromName}.`,
        '',
        `View it: ${d.url}`,
      ],
      footer
    ),

  subscription_started: (d, footer) =>
    compose(
      `Your ${d.tierName} subscription is active`,
      `Your ${d.tierName} subscription is now active.`,
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;">Your <strong>${d.tierName}</strong> subscription is now active. Thanks for being on Podium.</p>
        ${raw(button('Manage subscription', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        `Your ${d.tierName} subscription is now active.`,
        '',
        `Manage it: ${d.url}`,
      ],
      footer
    ),

  subscription_payment_failed: (d, footer) =>
    compose(
      'Action needed: your subscription payment failed',
      'We could not take your latest subscription payment.',
      html`
        <p style="margin:0 0 12px;">Hi ${d.recipientName},</p>
        <p style="margin:0 0 12px;">We could not take your latest subscription payment. Please update your payment details to keep your access.</p>
        ${raw(button('Update payment', d.url))}
      `,
      [
        `Hi ${d.recipientName},`,
        '',
        'We could not take your latest subscription payment. Please update your payment details to keep your access.',
        '',
        `Update it: ${d.url}`,
      ],
      footer
    ),
}

/** Render a transactional email for an event with its data + footer URLs. */
export function renderEmail<E extends EmailEvent>(
  event: E,
  data: TemplateData[E],
  footer: FooterUrls
): RenderedEmail {
  return templates[event](data, footer)
}
