/**
 * The funnel event catalogue (M-6).
 *
 * Typed and centralised so an event name is never a free-form string at the
 * call site — a typo there produces a metric that silently never fires, which
 * is exactly the class of measurement bug that makes a launch unreadable.
 *
 * PROPERTY RULE: properties describe the STEP, never the PERSON. No email, no
 * display name, no message text, no free text at all — analytics payloads leave
 * the origin and are covered by the user's consent choice, not by our
 * intentions. `lib/analytics/index.ts` re-redacts anyway (defence in depth).
 */

export interface AnalyticsEventMap {
  /** Landing → signup: the form was opened. */
  signup_started: { role?: 'athlete' | 'brand' | 'team' | 'agent'; source?: string }
  /** The account exists. Fired once, after the API confirms creation. */
  signup_completed: { role: 'athlete' | 'brand' | 'team' | 'agent' }
  /** Role chosen on /role-select. */
  role_selected: { role: 'athlete' | 'brand' | 'team' | 'agent' }
  /** Onboarding step reached (1-based). */
  onboarding_step_viewed: { role: string; step: number }
  /** Profile published — the user is now discoverable. */
  profile_published: { role: string }
  /** A connection request was successfully sent. */
  connection_request_sent: { recipient_role: string; surface: string }
  /** The recipient opened their inbox — the step that was previously impossible. */
  connection_requests_viewed: { role: string; pending: number }
  /** The recipient accepted or declined. Acceptance is what creates a match. */
  connection_request_responded: { role: string; outcome: 'accepted' | 'declined' }
  /** A proposal was sent inside a match. */
  proposal_sent: { role: string }
  /** A proposal was accepted — the deal is on. */
  proposal_accepted: { role: string }
  /** Checkout started for a brand subscription. */
  subscription_checkout_started: { tier: number }
  /** A payment succeeded. Amounts only — never a card or customer identifier. */
  payment_succeeded: { currency: string; amount_minor: number }
}

export type AnalyticsEvent = keyof AnalyticsEventMap
export type AnalyticsProps<E extends AnalyticsEvent> = AnalyticsEventMap[E]

export const ANALYTICS_EVENTS = [
  'signup_started',
  'signup_completed',
  'role_selected',
  'onboarding_step_viewed',
  'profile_published',
  'connection_request_sent',
  'connection_requests_viewed',
  'connection_request_responded',
  'proposal_sent',
  'proposal_accepted',
  'subscription_checkout_started',
  'payment_succeeded',
] as const satisfies readonly AnalyticsEvent[]
