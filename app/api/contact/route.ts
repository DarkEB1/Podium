import { NextRequest, NextResponse } from 'next/server'
import { sendViaProvider } from '@/lib/email/provider'
import { escapeHtml } from '@/lib/email/escape'
import { CONTROLLER } from '@/lib/legal/versions'
import { RATE_LIMITS, clientIpFrom, consumeAll, ipKey, tooManyRequests } from '@/lib/rate-limit'

/**
 * Public contact-form submission. Replaces the footer mailto link, which on a
 * device with no mail client configured just copied the address (or did
 * nothing) — reviewers read that as "contact us is broken".
 *
 * Unauthenticated and it sends real email, so it is deliberately hostile to
 * abuse: hard length caps on every field (a free-text relay with no caps gets
 * "rinsed" the day someone scripts it), an IP rate limit, and a honeypot field
 * that swallows naive bots without telling them anything went wrong.
 */

// Not exported: a Next.js route module may only export route fields, and the
// client form keeps its own mirror of these caps.
const FIELD_LIMITS = {
  name: 100,
  email: 254, // RFC 5321 maximum path length
  message: 2000,
} as const

const MIN_MESSAGE_CHARS = 10

function invalid(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: 'INVALID_SUBMISSION', message } },
    { status: 400 }
  )
}

/** Same shape the auth forms use — enough to catch typos, no RFC pedantry. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return invalid('Request body must be valid JSON')
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  // Honeypot: humans never see this field, so a value means a bot. Answer with
  // the success shape so the bot learns nothing.
  const website = typeof body.website === 'string' ? body.website.trim() : ''

  if (website) {
    return NextResponse.json({ message: 'Thanks, we will get back to you soon.' })
  }

  if (!name || !email || !message) {
    return invalid('Name, email and message are all required')
  }
  if (name.length > FIELD_LIMITS.name) {
    return invalid(`Name must be ${FIELD_LIMITS.name} characters or fewer`)
  }
  if (email.length > FIELD_LIMITS.email || !EMAIL_SHAPE.test(email)) {
    return invalid('Enter a valid email address')
  }
  if (message.length < MIN_MESSAGE_CHARS) {
    return invalid('Tell us a little more. Messages need at least 10 characters')
  }
  if (message.length > FIELD_LIMITS.message) {
    return invalid(`Message must be ${FIELD_LIMITS.message} characters or fewer`)
  }

  const limited = await consumeAll([
    { key: ipKey('contact', clientIpFrom(request.headers)), rule: RATE_LIMITS.contactByIp },
  ])
  if (!limited.allowed) {
    return tooManyRequests(limited.retryAfter)
  }

  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />')

  const result = await sendViaProvider({
    to: CONTROLLER.supportEmail,
    subject: `Contact form: ${name.slice(0, 80)}`,
    replyTo: email,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: `<p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p><p>${safeMessage}</p>`,
  })

  if (!result.ok) {
    console.error('[contact] send failed', result.error)
    return NextResponse.json(
      {
        error: {
          code: 'SEND_FAILED',
          message: `We could not send your message right now. Please email ${CONTROLLER.supportEmail} directly.`,
        },
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ message: 'Thanks, we will get back to you soon.' })
}
