# Landing Page Redesign — Design Spec

**Date:** 2026-08-05
**Branch:** all work on `staging`
**Scope:** public landing page (`app/page.tsx` + `components/landing/*`) plus a global design-token update that the rest of the app inherits.

## Goal

Replace the current Nord-palette landing page with a soft-brutalist, horizontally-scrolling page built around the podium mark from the logo. The podium steps are the hero; a domino-fall animation drives the transition between panels.

## Aesthetic (locked with Nicholas, 2026-08-05)

### Colour

| Token | Value | Role | Contrast notes |
|---|---|---|---|
| Background | `#FAFBFB` | cold white page | n/a |
| Ink | `#17181A` | all text, wordmark, dark buttons | 15.8:1 on bg |
| Lime | `#C1EC2F` | brand fill ONLY: podium steps, rotating-word highlight, logo's tallest bar | 1.2:1 on bg — never used for text; ink on lime 13:1 |
| Electric blue | `#2742F0` | everything interactive: CTAs, links, focus rings | 6.5:1 on bg; white on blue 6.7:1 |
| Body grey | `#4A4B4E` | secondary text | 8.9:1 on bg |

Rules: lime is never a text colour and never sits behind body copy. One saturated lime element per panel. Blue means clickable, nothing else is blue.

### Type

- DM Sans everywhere (already loaded): 800 display, 500 UI/nav, 300 secondary text.
- Geist retired as heading font; Geist Mono kept for micro-labels (`SCROLL → 01 / 05`, panel numbering, small wayfinding), 10-11px, letter-spacing 0.15em, uppercase.
- Existing three-size scale + `text-display` tier stays (gl5-audit enforces it).

### Shape ("soft brutalist")

- Flat surfaces, no shadows, no gradients.
- Radii 10-12px on buttons/cards; rectangular buttons, not pills.
- The podium bar shape is the one expressive curve: big top-left corner. **Proportional rounding rule: a bar's top-left radius = 60% of its width, remaining corners 12%** so the nav logo mark and the full-size hero steps read as the same glyph at any scale. The mark ships as one SVG component (`components/brand/podium-mark.tsx`) scaled everywhere it appears, making this automatic for the logo; CSS-drawn bars derive radius from width with the same ratio.
- 1px hairline borders (`#E4E6E5`) where separation is needed on white.

## Copy

Hook headline: **"The podium has room for ___"** with the last word rotating through `athletes → teams → brands → you` every 2.5s. The word sits in a lime rounded block that stretches to fit each word. Subline: "Build a profile, get discovered, agree the deal and get paid. Athletes, teams and brands, all in one place." Primary CTA: **"Get on the podium"** (blue, to sign-up/role-select). Secondary: "How it works" (blue underlined link, jumps to panel 3).

## Page structure — five horizontal panels

The landing page is one horizontal track travelled left→right by normal vertical scroll input. DOM order = panel order = reading order.

1. **Hero** — hook left (mono label "SPONSORSHIP MARKETPLACE", headline, subline, CTAs), lime podium steps right, `SCROLL → 01 / 05` wayfinding bottom-left.
2. **The marketplace** — lead with the goods: marketplace preview card (profile cards, filters, deal counts) plus testimonial chips. Merges and compacts `marketplace-preview.tsx` + `social-proof.tsx`.
3. **What we do** — three flat lime slabs (echoing the fallen dominoes) carrying: Build your profile / Get discovered / Sign and get paid. Reworks `how-it-works.tsx` content. Secondary hero CTA "How it works" jumps here.
4. **Who's on the podium** — athlete, team, brand cards at podium-step heights. Reworks `role-panels.tsx` content.
5. **Build your profile** — closing ask: ink-field banner with "Build your profile" CTA, pricing link, footer links row. No FAQ section (decision 2026-08-05); `faq.tsx` and its FAQPage schema are removed from the landing page. Cookie banner overlays as today.

## Scroll model and the baseline

- **The anchorline is "the baseline":** a continuous 1.5px hairline ground line at a fixed ~72% of viewport height, running the entire length of the track. Every panel's key elements stand ON it: the hero podium steps, the falling dominoes, the marketplace selector, the "what we do" slabs, the role cards, and the closing ink banner. It is the court baseline the whole page travels along, and it is what makes five different panels read as one continuous world instead of five slides.
- Mono wayfinding ticks sit on the baseline like distance markers (`01`, `02` … at each panel boundary), replacing any dots/progress UI.
- **Scroll behaviour:** continuous scrub, not slide-jumping. Scroll position maps linearly to track position; the domino fall between panels 1→2 is scroll-linked (scrub forward and back replays it). When scrolling comes to rest within ~15% of a panel boundary, the track eases gently to alignment (soft snap); mid-panel resting positions are allowed everywhere else.
- Keyboard: PageDown/PageUp and left/right arrows move one panel; Tab focus pulls the track to the focused element.

## Motion

- **Load:** hero steps rise with staggered spring (~120ms stagger); rotating word flips vertically every 2.5s.
- **Scroll (desktop):** body height defines scroll length; a sticky viewport translates the track horizontally from scroll progress. Between panels 1→2 the podium steps tip like dominoes (scripted rotations around bottom-right corners, tallest last), the last bar visually "shoving" the track into the marketplace panel. Panels 2→5 slide with mild inner-content parallax. The slabs in panel 3 reuse the fallen-domino shape language, tying the story back to the transition.
- **Fallbacks:** `prefers-reduced-motion` and viewports < 1024px get a vertical page: same five sections stacked, dominoes replaced by a gentle in-view fade-rise, no scroll hijacking, no pinning.
- Library: `motion` (new dependency) — `useScroll` + transforms; no GSAP.

## Implementation

- `components/landing/horizontal-track.tsx` (client) owns scroll mapping and the domino choreography; panel content stays in server components.
- `components/brand/podium-mark.tsx` — the SVG mark (three bars, proportional rounding baked into the geometry).
- `app/globals.css` token update (global): `--background: #FAFBFB`, `--primary: #2742F0`, `--ring: #2742F0`, new `--lime: #C1EC2F`, `--foreground: #17181A`, `--font-heading: var(--font-dm-sans)`. Dashboards inherit the new palette; their layouts are untouched. Nord chart colours re-derived from the new palette (blues + lime).
- `app/layout.tsx`: drop the Geist (sans) import, keep DM Sans + Geist Mono.
- Rotating word: client component, respects reduced motion (crossfade instead of flip), `aria-live="off"` with the full word list available to screen readers as static text ("athletes, teams and brands").
- A11y/SEO: DOM order equals visual order; keyboard focus moves the track to the focused panel; skip link to main content; all five panels server-rendered, no content behind interaction.

## Error handling

Animation is progressive enhancement only: if JS fails or `motion` errors, the page renders as the vertical stacked fallback with full content and working links. No layout depends on scroll state being computed.

## Testing

- Update `components/ui/contrast.test.ts` expected values to the new palette; keep the WCAG assertions.
- Update `app/design-tokens.test.ts` / `gl5-audit.test.ts` for the new token values (type scale unchanged).
- New Playwright spec `e2e/landing.spec.ts`: five panels present in DOM order, horizontal traversal on desktop viewport, vertical layout at mobile viewport, reduced-motion renders vertical, CTAs navigate.
- `npm run check` green before any merge talk; visual confirmation on the staging preview URL.

## Out of scope

- Restyling dashboard/app screens beyond what global tokens inherit.
- Logo asset redraw (the existing logo image stays wherever it's used outside the site header).
- Live Stripe/pricing changes; pricing page content.
- Any FAQ presence on the landing page (removed by decision; a standalone FAQ page can be considered later).
