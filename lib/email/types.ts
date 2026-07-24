/**
 * The transactional email catalogue.
 *
 * Every email the product can send is one entry here. An event carries its
 * default channel preference (used when the user has set nothing in their
 * notification matrix) and a `category` that governs how it is gated:
 *
 *   - `transactional`  — a direct consequence of an action the user took or a
 *                        deal they are party to (request accepted, contract
 *                        signed, payment taken). Sent immediately. A user CAN
 *                        turn these off per-event in settings, but they are ON
 *                        by default and a global unsubscribe does not silence a
 *                        receipt they may need for tax. Legitimate under PECR
 *                        soft opt-in as service messages.
 *   - `marketing`      — promotional. OFF by default, requires an explicit
 *                        opt-in (`profile_settings.marketing_opt_in`), and a
 *                        one-click unsubscribe silences it absolutely.
 *
 * `defaultEmail` is the fallback when the notification matrix has no entry for
 * the event. Transactional deal/money events default ON; lower-signal ones OFF.
 */

export type EmailCategory = 'transactional' | 'marketing'

export interface EmailEventDef {
  readonly category: EmailCategory
  readonly defaultEmail: boolean
  /** Human label for the settings preferences screen. */
  readonly label: string
}

export const EMAIL_EVENTS = {
  connection_request_received: {
    category: 'transactional',
    defaultEmail: true,
    label: 'Someone sends you a connection request',
  },
  connection_request_accepted: {
    category: 'transactional',
    defaultEmail: true,
    label: 'Your connection request is accepted',
  },
  proposal_received: {
    category: 'transactional',
    defaultEmail: true,
    label: 'You receive a deal proposal',
  },
  proposal_accepted: {
    category: 'transactional',
    defaultEmail: true,
    label: 'Your proposal is accepted',
  },
  contract_fully_signed: {
    category: 'transactional',
    defaultEmail: true,
    label: 'A contract is fully signed',
  },
  payment_received: {
    category: 'transactional',
    defaultEmail: true,
    label: 'You receive a payment',
  },
  subscription_started: {
    category: 'transactional',
    defaultEmail: true,
    label: 'Your subscription starts or renews',
  },
  subscription_payment_failed: {
    category: 'transactional',
    defaultEmail: true,
    label: 'A subscription payment fails',
  },
} as const satisfies Record<string, EmailEventDef>

export type EmailEvent = keyof typeof EMAIL_EVENTS

export function isEmailEvent(value: string): value is EmailEvent {
  return Object.prototype.hasOwnProperty.call(EMAIL_EVENTS, value)
}

/**
 * The event's category, returned as the widened union. A direct
 * `EMAIL_EVENTS[e].category` read narrows to the literal of whatever categories
 * currently exist in the catalogue (all transactional today), which would make
 * the marketing branch look dead to the compiler; going through this typed
 * boundary keeps that branch live.
 */
export function categoryOf(event: EmailEvent): EmailCategory {
  return EMAIL_EVENTS[event].category
}

/**
 * The data each template needs. Kept as plain, already-resolved strings/numbers
 * so the template layer never touches the database — the caller resolves names,
 * amounts and URLs, the template only formats and escapes them.
 */
export interface TemplateData {
  connection_request_received: { recipientName: string; senderName: string; message: string; url: string }
  connection_request_accepted: { recipientName: string; otherName: string; url: string }
  proposal_received: { recipientName: string; senderName: string; proposalTitle: string; url: string }
  proposal_accepted: { recipientName: string; proposalTitle: string; url: string }
  contract_fully_signed: { recipientName: string; counterpartyName: string; url: string }
  payment_received: { recipientName: string; amountFormatted: string; fromName: string; url: string }
  subscription_started: { recipientName: string; tierName: string; url: string }
  subscription_payment_failed: { recipientName: string; url: string }
}

/** The rendered output of a template: a subject plus HTML and plain-text bodies. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
}
