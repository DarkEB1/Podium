/**
 * Email transport — Resend, over its REST API, with zero new dependencies.
 *
 * Resend's send endpoint is a single authenticated POST, so a `fetch` call is
 * the whole integration. This follows the same provider-optional pattern as
 * lib/observability and lib/analytics: when `RESEND_API_KEY` is unset the
 * transport is a no-op that reports `skipped_no_provider`, so the app runs, the
 * delivery ledger still records the attempt, and nothing throws in local dev or
 * CI. Set the key in production and the same code path delivers.
 *
 * No Resend SDK is added: it would pull a dependency for one HTTP call, and the
 * REST contract is stable and tiny.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface SendParams {
  to: string
  subject: string
  html: string
  text: string
  /** RFC 8058 one-click unsubscribe, when the message is unsubscribable. */
  listUnsubscribeUrl?: string
}

export type ProviderResult =
  | { ok: true; providerId: string }
  | { ok: false; retriable: boolean; error: string }
  | { ok: false; skipped: true; error: string }

function fromAddress(): string {
  // e.g. "Podium <notifications@mail.podium.app>". Documented in .env.local.example.
  return process.env.EMAIL_FROM || 'Podium <onboarding@resend.dev>'
}

function replyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO || undefined
}

/**
 * Deliver one message. Never throws — every failure is a typed result so the
 * caller (lib/email) can decide whether to retry and what to record. A 4xx from
 * the provider is non-retriable (a bad address or payload will fail again); a
 * 429/5xx or a network error is retriable.
 */
export async function sendViaProvider(params: SendParams): Promise<ProviderResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  const body: Record<string, unknown> = {
    from: fromAddress(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  }
  const rt = replyTo()
  if (rt) body.reply_to = rt

  // RFC 8058: List-Unsubscribe + List-Unsubscribe-Post lets Gmail/Apple render
  // a native one-click unsubscribe and is a deliverability signal.
  if (params.listUnsubscribeUrl) {
    body.headers = {
      'List-Unsubscribe': `<${params.listUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }

  let res: Response
  try {
    res = await fetch(RESEND_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch (err) {
    // Network-level failure — transient by nature.
    return { ok: false, retriable: true, error: err instanceof Error ? err.message : 'network error' }
  }

  if (res.ok) {
    const json = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, providerId: json.id ?? 'unknown' }
  }

  const detail = await res.text().catch(() => '')
  const retriable = res.status === 429 || res.status >= 500
  return { ok: false, retriable, error: `provider ${res.status}: ${detail.slice(0, 300)}` }
}
