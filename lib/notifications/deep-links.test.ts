import { describe, it, expect } from 'vitest'
import {
  requestsInboxPath,
  messagesInboxPath,
  messageThreadPath,
  dealDetailPath,
  dealsListPath,
} from './deep-links'
import { ROUTES } from '@/lib/routes'

describe('notification deep-links (D20)', () => {
  it('routes a connection-request recipient to their own requests inbox', () => {
    expect(requestsInboxPath('brand')).toBe(ROUTES.brand.requests)
    expect(requestsInboxPath('athlete')).toBe(ROUTES.athlete.requests)
    expect(requestsInboxPath('team')).toBe(ROUTES.team.requests)
  })

  it('routes a conversation CTA to the recipient role messages inbox', () => {
    expect(messagesInboxPath('athlete')).toBe(ROUTES.athlete.messages)
    expect(messagesInboxPath('brand')).toBe(ROUTES.brand.messages)
    expect(messagesInboxPath('team')).toBe(ROUTES.team.messages)
  })

  it('builds a role-scoped message thread path from the match id', () => {
    expect(messageThreadPath('athlete', 'm1')).toBe('/athlete/messages/m1')
    expect(messageThreadPath('brand', 'm1')).toBe('/brand/messages/m1')
    expect(messageThreadPath(null, 'm1')).toBe(ROUTES.dashboard)
    expect(messageThreadPath('agent', 'm1')).toBe(ROUTES.dashboard)
  })

  it('builds a role-scoped deal detail path from the proposal id', () => {
    expect(dealDetailPath('athlete', 'p1')).toBe('/athlete/deals/p1')
    expect(dealDetailPath('brand', 'p1')).toBe('/brand/deals/p1')
    expect(dealDetailPath('team', 'p1')).toBe('/team/deals/p1')
    expect(dealsListPath('team')).toBe('/team/deals')
  })

  // Never emit a broken link: an unknown role, or a role without that surface
  // (an agent has no requests/messages/deals pages), falls back to /dashboard.
  it('falls back to /dashboard for a null or unsupported role', () => {
    expect(requestsInboxPath(null)).toBe(ROUTES.dashboard)
    expect(requestsInboxPath('agent')).toBe(ROUTES.dashboard)
    expect(messagesInboxPath('agent')).toBe(ROUTES.dashboard)
    expect(dealDetailPath('agent', 'p1')).toBe(ROUTES.dashboard)
    expect(dealDetailPath(null, 'p1')).toBe(ROUTES.dashboard)
    expect(dealsListPath(null)).toBe(ROUTES.dashboard)
  })
})
