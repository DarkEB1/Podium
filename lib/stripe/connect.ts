import type Stripe from 'stripe'
import { stripeClient } from './index'

/**
 * Stripe Connect (Express) for athlete/team payouts (spec §payments).
 *
 * Requires Stripe Connect to be enabled on the platform account. Until it is,
 * the Stripe API rejects account creation and these calls surface a clear error
 * rather than moving money in a half-set-up state. Pure status mapping is kept
 * separate so it is unit-testable without Stripe.
 */

export class ConnectError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ConnectError'
  }
}

export interface ConnectStatus {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

/** Map a Stripe account object to the readiness flags we persist. */
export function accountStatus(account: Pick<Stripe.Account, 'charges_enabled' | 'payouts_enabled' | 'details_submitted'>): ConnectStatus {
  return {
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    detailsSubmitted: !!account.details_submitted,
  }
}

/** Create an Express Connect account able to receive transfers. */
export async function createConnectAccount(email: string | null): Promise<string> {
  try {
    const account = await stripeClient().accounts.create({
      type: 'express',
      ...(email ? { email } : {}),
      capabilities: { transfers: { requested: true } },
    })
    return account.id
  } catch (err) {
    throw new ConnectError('ACCOUNT_CREATE_FAILED', stripeMessage(err))
  }
}

/** A one-time hosted onboarding link for an account. */
export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  try {
    const link = await stripeClient().accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    })
    return link.url
  } catch (err) {
    throw new ConnectError('LINK_FAILED', stripeMessage(err))
  }
}

/** Retrieve current readiness for an account (used by the webhook and status checks). */
export async function retrieveStatus(accountId: string): Promise<ConnectStatus> {
  try {
    const account = await stripeClient().accounts.retrieve(accountId)
    return accountStatus(account)
  } catch (err) {
    throw new ConnectError('RETRIEVE_FAILED', stripeMessage(err))
  }
}

/**
 * Pay out to a connected account (a Stripe transfer, amount in minor units).
 * Only usable once the platform holds a balance from the corresponding charge;
 * the caller decides when a deal is complete enough to release funds.
 */
export async function createPayout(
  accountId: string,
  amountMinor: number,
  currency: string,
  metadata: Record<string, string> = {}
): Promise<string> {
  try {
    const transfer = await stripeClient().transfers.create({
      amount: amountMinor,
      currency: currency.toLowerCase(),
      destination: accountId,
      metadata,
    })
    return transfer.id
  } catch (err) {
    throw new ConnectError('PAYOUT_FAILED', stripeMessage(err))
  }
}

function stripeMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Stripe request failed'
  // A very common cause here is Connect not being enabled on the account.
  if (/connect/i.test(message) && /enabl|activat|sign up/i.test(message)) {
    return 'Stripe Connect is not enabled on this account yet. Enable Connect in the Stripe dashboard.'
  }
  return message
}
