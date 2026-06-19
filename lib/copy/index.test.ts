import { describe, expect, it } from 'vitest'
import { copy } from '@/lib/copy'

describe('copy microcopy module', () => {
  it('exposes the locked toast strings', () => {
    expect(copy.toasts.profileLive).toBe("You're on the radar — profile is live!")
    expect(copy.toasts.proposalSent).toBe('Proposal sent. Game on.')
    expect(copy.toasts.saved).toBe('Saved to your shortlist.')
  })

  it('exposes the locked empty-state copy', () => {
    expect(copy.emptyStates.noMatches).toEqual({
      title: "No matches yet — let's fix that",
      body: "Brands can't pick you if they can't see you. Round out your profile and you'll start showing up in their search.",
      cta: 'Finish my profile',
    })
    expect(copy.emptyStates.noResults).toEqual({
      title: 'Nothing here yet',
      body: "Widen your filters and dig in — there's talent waiting.",
      cta: 'Clear filters',
    })
    expect(copy.emptyStates.noDeals).toEqual({
      title: 'No deals yet',
      body: 'Send a proposal and get the ball rolling.',
      cta: 'Browse opportunities',
    })
    expect(copy.emptyStates.emptyInbox).toEqual({
      title: 'Your inbox is quiet',
      body: 'Once a match starts talking, it shows up here.',
      cta: null,
    })
  })

  it('exposes the locked CTA and prompt strings', () => {
    expect(copy.cta.sendProposal).toBe('Send proposal · make your move')
    expect(copy.cta.finishProfile).toBe('Finish my profile')
    expect(copy.prompts.addPhoto).toBe(
      'Add a photo so brands can put a face to the talent',
    )
  })

  it('is a readonly (frozen-at-type) const object — runtime shape is stable', () => {
    // `as const` makes the literal types readonly; assert the runtime values
    // match so consumers can rely on the exact shape.
    const keys = Object.keys(copy).sort()
    expect(keys).toEqual(['cta', 'emptyStates', 'prompts', 'toasts'])
  })
})
