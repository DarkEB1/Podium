/**
 * Podium microcopy — the single source of truth for user-facing strings used by
 * toasts, empty states, CTAs and inline prompts.
 *
 * Voice: energetic & sporty, second-person, momentum-forward — never cheesy,
 * never at the expense of clarity. See `docs/brand/voice.md`.
 *
 * `as const` freezes the literal types so consumers get exact string unions and
 * cannot accidentally mutate shared copy.
 */
export const copy = {
  toasts: {
    profileLive: "You're on the radar, profile is live!",
    proposalSent: 'Proposal sent. Game on.',
    saved: 'Saved to your shortlist.',
  },
  emptyStates: {
    noMatches: {
      title: "No matches yet, let's fix that",
      body: "Brands can't pick you if they can't see you. Round out your profile and you'll start showing up in their search.",
      cta: 'Finish my profile',
    },
    noResults: {
      title: 'Nothing here yet',
      body: "Widen your filters and dig in, there's talent waiting.",
      cta: 'Clear filters',
    },
    noDeals: {
      title: 'No deals yet',
      body: 'Send a proposal and get the ball rolling.',
      cta: 'Browse opportunities',
    },
    emptyInbox: {
      title: 'Your inbox is quiet',
      body: 'Once a match starts talking, it shows up here.',
      cta: null,
    },
  },
  cta: {
    sendProposal: 'Send proposal · make your move',
    finishProfile: 'Finish my profile',
  },
  prompts: {
    addPhoto: 'Add a photo so brands can put a face to the talent',
  },
} as const
