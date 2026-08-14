# UX Audit — Animation Opportunities (find-animation-opportunities lens)

Read-only audit. Every item below is a **proposal**, not a change. The posture is
restraint-first (Emil Kowalski, "You Don't Need Animations"): most candidates were
rejected on purpose. A short high-conviction list beats a wishlist.

Date: 2026-08-14 · Scope: whole app UI (route groups `(admin) (agent) (athlete) (brand) (team)` + shared `components/`). The `(public)` marketing/landing motion is out of scope and left untouched.

---

## Executive summary

The functional app is **already close to right**. The shared primitives that carry
most of the product's motion — Base UI `Dialog`, `Sheet`, `Accordion`, `Select`,
`DropdownMenu`, and sonner toasts — all animate correctly (fade + `zoom-in-95` +
`--transform-origin`, reduced-motion gated). Press/lift feedback exists globally
(`.pressable` / `.liftable` in `globals.css`). The wizard's step changes ride the
existing `page-transition.tsx`, and its progress bar already has `transition-all`.

So there is **no shortage of motion** here — there are a handful of specific seams
where motion is genuinely missing and its absence is felt. The single highest-leverage
gap is the **swipe/discovery flow**: cards are dragged with real physics on the way
*in* but teleport on the way *out*, which breaks the one place in the product where
motion is doing perceptual work rather than decoration.

Five opportunities survived the gate. The rest of the interface should be left alone.

---

## High-conviction opportunities (ranked)

| # | Location | Today | Purpose | Frequency | Suggested motion |
| --- | --- | --- | --- | --- | --- |
| 1 | `components/ui/swipe-card.tsx:75` (`commit`) + `:236` (`SwipeDeck`) | Below-threshold release snaps back via linear `transition-transform duration-200`; a **committed** swipe just calls `setDrag(0)` + `onSwipe` — the accepted/rejected card vanishes and the peeked next card teleports to full size | Feedback + Spatial consistency | Occasional–frequent (core browse) | On **pointer/button** commit only, fling the card out in the swiped direction before firing `onSwipe`: `translateX(±120%) rotate(±18deg)`, `opacity 1→0`, **260ms `cubic-bezier(0.32,0.72,0,1)`**. Replace the snap-back with a spring `{ type:"spring", duration:0.5, bounce:0.2 }`. Promote the `SwipeDeck` peek card (`scale-95 opacity-60`) to `scale-100 opacity-100` over the same beat. **Keyboard (←/→) commit stays instant** (100+/day, disqualified). Reduced-motion: skip the fling, fire `onSwipe` immediately |
| 2 | `components/discovery/listings-grid.tsx:388` · `components/brand/athletes-grid.tsx:254` · `teams-grid` | When `loading` flips false the whole card grid appears in one frame | Preventing a jarring change (group entrance) | Occasional | **First mount only**: fade+rise each card `opacity 0→1`, `translateY(8px)→0`, **240ms `--ease-out` (cubic-bezier(0.23,1,0.32,1))**, **40ms stagger capped at ~8 cards**. Must not block interaction. **Must not re-fire on filter/sort re-render** — gate on an initial-mount ref, not on the `filtered` array. Reduced-motion: opacity only, no translate, no stagger |
| 3 | `components/discovery/listings-grid.tsx:170` (`FilterChip` popup `<ul>`) | The bespoke portalled filter listbox appears **instantly** — the one popover in the app that pops in flat, inconsistent with every Base UI menu | Spatial consistency (connect popup to its chip) | Occasional | Match the app's existing popover vocabulary: `data-open:animate-in fade-in-0 zoom-in-95`, `origin-top`, **~120ms**. Since this is a hand-rolled portal (not Base UI), drive it off an `open` class with `@starting-style`/tw-animate-css rather than `--transform-origin`. Reduced-motion: `fade-in` only, no zoom |
| 4 | `components/ui/empty-state.tsx:58` | The disc + title + body + CTA render statically | Delight (rare/first-time tier) | Rare | On mount: disc `scale(0.9)→1 + opacity`, then title/description/action fade+rise with **60ms stagger**, total **< 380ms**, `--ease-out`. **Scope to terminal / first-run empties** (`emptyInbox`, empty dashboards) — do **not** apply to the `listings-grid` no-results state, which flickers in and out during filtering. Reduced-motion: opacity fade only |
| 5 | `components/ui/swipe-card.tsx:205` & `:213` (round Pass / Interested buttons) | `transition-colors` only — no press response on the two primary touch targets of the swipe flow | Feedback | Frequent (subtle only) | Add `:active { transform: scale(0.94) }`, `transition: transform 140ms ease-out`. These are 48px touch targets doing a committing action; a tactile press dip is warranted where a hover tint is not. Reduced-motion: no transform |

### Notes on the top item

Opportunity #1 is the whole reason this audit isn't "nothing to do." The `SwipeCard`
already tracks a live `translateX + rotate` under the finger and shows a Pass/Interested
intent stamp — it commits to being a physical object — then breaks that contract at the
most important instant by teleporting on release. That is the exact "gesture seam" the
lens exists to catch. It is also the correct place to spend a spring: the interaction is
rare enough per session and emotional enough (choosing an athlete/campaign) to earn it,
and the motion *is* the feedback, not a coat of paint on top. The keyboard-path carve-out
is non-negotiable — arrow-key swiping is a 100+/day action and must stay instant.

---

## Rejected candidates (deliberate)

- `components/ui/sonner.tsx` — toast enter/exit. **Rejected: sonner ships its own enter/exit + swipe-to-dismiss. Don't duplicate existing motion.**
- `components/ui/dialog.tsx`, `sheet.tsx`, `accordion.tsx`, `select.tsx`, `dropdown-menu.tsx` — **Rejected: already animate (fade + `zoom-in-95` / slide + `--transform-origin`), reduced-motion gated. Nothing to add.**
- `components/ui/tabs.tsx:72` (`TabsContent` panel swap) — **Rejected: tab switching is tens/day and keyboard-reachable; a content transition would make a frequent action feel sluggish. The active-underline already transitions.**
- `components/athlete/profile-wizard.tsx:824` (step swap) — **Rejected: each step is its own route (`router.push`), so the change is already carried by `page-transition.tsx`. The progress bar already has `transition-all`.**
- `components/athlete/profile-stat-strip.tsx` / `layout/stat-strip` (count-up on follower/engagement numbers) — **Rejected: functional data the user is reading; number motion is decoration that hinders (Gate 4).**
- `components/messaging/chat-window.tsx:194` (incoming `MessageBubble` on realtime INSERT) — **Rejected: chat is a high-frequency surface; animating every message arrival adds cumulative drag. The typing indicator already animates and the view auto-scrolls smoothly.**
- Status-badge crossfade after `respond()` / `handleSign()` (`proposal-respond-buttons.tsx`, `contract-sign-button.tsx`) — **Rejected: state flips via a full `router.refresh()` server re-render (once per deal); animating across that is high plumbing cost for a rare event, and `toast.success` already confirms it.**
- Success flourish (confetti / checkmark burst) on profile publish, contract signed, proposal accepted — **Rejected: `toast.success` already carries the confirmation and its spatial story. A dedicated celebration is gold-plating, not a perceptual gap.**
- `components/discovery/listings-grid.tsx:392` grid **re-order** on filter/sort — **Rejected: layout-critical + frequent; layout animation on a list the user is actively scanning hinders (never animate layout-critical elements).**
- `components/ui/browse-mode-toggle.tsx` (grid ↔ swipe switch) — **Rejected: frequent toggle; a transition here reads as latency.**
- Button label swaps ("Sending…", "Request sent", "Publishing…") across the mutation buttons — **Rejected: the text change already communicates state; motion adds nothing.**

---

## Verdict

This interface does **not** need more motion — it needs motion in one place it forgot.
The shared component layer is already well-animated and correctly restrained, and most
of what looked like an opportunity is either already handled or is functional/high-frequency
UI that should stay still. The delight budget and the perceptual work both point at the
same surface: the **swipe/discovery flow**. Ship opportunity #1 (the swipe commit exit +
deck promotion) and the interface's motion story is complete; #2–#5 are polish, worth
doing but strictly secondary.

Handoff: `improve-animations plan <row>` turns any row above into a self-contained
implementation plan. Start with row 1.
