# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public landing page as a soft-brutalist horizontal five-panel track with domino-fall transitions, two switchable marketplace mechanics (skyline + rally game), and a global token swap to the new palette.

**Architecture:** Global design tokens change in `app/globals.css` (light + dark blocks) and the whole app inherits them. The landing page becomes five server-rendered panels laid on a horizontal track driven by a client component that maps vertical scroll to horizontal travel; all animation logic lives in pure, unit-tested modules (`track-math`, `rally-engine`) consumed by thin client components. Marketplace renders one of two variants from the `?market` search param.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind 4, Vitest + Testing Library (co-located tests), Playwright (`e2e/`), `motion` (new dependency) for springs/scroll.

**Spec:** `docs/superpowers/specs/2026-08-05-landing-redesign-design.md` — read it first.

**Design plugin guidance (MANDATORY for Tasks 8-12):** before writing any JSX/styles, read both:
1. `C:\Users\nicho\.claude\plugins\cache\claude-plugins-official\frontend-design\unknown\skills\frontend-design\SKILL.md` — apply its two-pass process (token plan → critique against genericness → build). Our locked palette/type/shape system IS the token plan; do not invent new colours or faces. Its warning about numbered markers is satisfied here: our `01/02/03` mono labels encode real sequence (process steps, panel positions on a track), keep them.
2. `C:\Users\nicho\.claude\plugins\cache\design-plugins\design-and-refine\1.1.0\skills\design-lab\DESIGN_PRINCIPLES.md` — apply the usability heuristics to interactive pieces (skyline filters, rally game affordance: the court must LOOK clickable — cursor, hover cue, and the aria-label instruction).
The signature element (per frontend-design's "signature" concept) is the baseline + domino system; polish effort concentrates there.

## Global Constraints

- Branch: ALL work on `staging`. Never push to `main`; never `vercel deploy --prod`.
- Palette (light): background `#FAFBFB`, foreground/ink `#17181A`, lime `#C1EC2F` (fills only, NEVER text), electric blue `#2742F0` (interactive only), body grey `#4A4B4E`. Lime tints for supporting fills: `#DDF0A8`, `#E9F5C4`.
- Lime never renders text and never sits behind body copy; one full-saturation lime element per panel; blue = clickable, nothing else is blue.
- Type: DM Sans 800 display / 500 UI / 300 secondary; Geist Mono micro-labels 10-11px, `letter-spacing: .15em`, uppercase. Geist (sans) is removed.
- Bar shape rounding: top-left radius = 60% of bar width, other corners 12% (`ROUND_RATIO = 0.6`, `ROUND_MINOR = 0.12`).
- Copy: hook "The podium has room for ___" rotating `athletes → teams → brands → you` every 2500ms; primary CTA "Get on the podium" → `/role-select`; secondary "How it works" → panel 3.
- Marketplace variants switch on `?market=skyline|rally`, default `skyline`.
- No FAQ anywhere on the landing page.
- No Supabase/Stripe calls anywhere in this work (fixture data only). Components in `components/` must not import from `lib/supabase` or `lib/stripe`.
- No `<Button asChild>` (Base UI, unsupported). Use `<Link className={buttonVariants(...)}>` or plain styled `Link`.
- Every task ends with its tests passing and a commit. Final gate: `npm run check` green.

---

### Task 1: Global design tokens (light + dark)

**Files:**
- Modify: `app/design-tokens.test.ts`
- Modify: `app/globals.css` (`:root`, `.dark`, `@theme inline` blocks)

**Interfaces:**
- Produces: CSS vars `--lime`, `--lime-tint-1: #DDF0A8`, `--lime-tint-2: #E9F5C4`, `--baseline: #C9CBCA` and Tailwind utilities `bg-lime`, `bg-lime-tint-1`, `bg-lime-tint-2`, `border-baseline` (via `@theme inline` `--color-lime` etc.). All later tasks style with these.

- [ ] **Step 1: Rewrite token expectations to fail first**

In `app/design-tokens.test.ts` replace the assertions that pin old values (keep file structure and the type-scale/motion assertions unchanged):

```ts
// REPLACE the 'maps the heading typeface…' test body with:
    expect(css).toMatch(/--font-heading:\s*var\(--font-dm-sans\)/)
    expect(css).toMatch(/--font-sans:\s*var\(--font-dm-sans\)/)

// REPLACE the 'page background is near-white…' test body with:
    expect(css).toMatch(/--background:\s*#FAFBFB/)
    expect(css).toMatch(/--card:\s*#FFFFFF/)

// REPLACE the 'uses the Nord snow-storm hairline border token' test body with:
    expect(css).toMatch(/--border:\s*#E4E6E5/)

// REPLACE the 'uses an accessible frost-blue primary…' test body with:
    expect(css).toMatch(/--primary:\s*#2742F0/)
    expect(css).toMatch(/--accent:\s*#EEF0EE/)

// ADD inside the tokens describe block:
  it('defines the lime brand fill tokens and exposes them as utilities', () => {
    expect(css).toMatch(/--lime:\s*#C1EC2F/)
    expect(css).toMatch(/--lime-tint-1:\s*#DDF0A8/)
    expect(css).toMatch(/--lime-tint-2:\s*#E9F5C4/)
    expect(css).toMatch(/--baseline:\s*#C9CBCA/)
    expect(css).toMatch(/--color-lime:\s*var\(--lime\)/)
    expect(css).toMatch(/--color-baseline:\s*var\(--baseline\)/)
  })
```

In the `T1 typefaces (layout.tsx)` describe block, replace the Geist test bodies:

```ts
// 'wires Geist and DM Sans via next/font/google' becomes:
    expect(layout).toMatch(/from ['"]next\/font\/google['"]/)
    expect(layout).toMatch(/DM_Sans/)
    expect(layout).toMatch(/Geist_Mono/)
    expect(layout).not.toMatch(/\bGeist\b(?!_Mono)/)

// 'binds the font CSS variables expected by the tokens' becomes:
    expect(layout).toMatch(/--font-dm-sans/)
    expect(layout).toMatch(/--font-geist-mono/)
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run app/design-tokens.test.ts`
Expected: FAIL on the replaced/added assertions (old hexes still in CSS).

- [ ] **Step 3: Update `app/globals.css`**

In `:root`, replace the colour tokens (keep the type-scale, radius, shadow, sidebar structure — only values below change; leave `--text-*`, `--radius`, `--shadow-*` untouched):

```css
  /* Colour — Podium soft-brutalist palette (spec 2026-08-05), light */
  --background: #FAFBFB;   /* cold white page */
  --foreground: #17181A;   /* ink; 15.8:1 on page */
  --card: #FFFFFF;
  --card-foreground: #17181A;
  --popover: #FFFFFF;
  --popover-foreground: #17181A;
  --primary: #2742F0;      /* electric blue; 6.5:1 on page, white-on-primary 6.7:1 */
  --primary-foreground: #FFFFFF;
  --secondary: #F0F1F0;
  --secondary-foreground: #17181A;
  --muted: #F0F1F0;
  --muted-foreground: #4A4B4E; /* body grey; 8.9:1 on page */
  --accent: #EEF0EE;
  --accent-foreground: #17181A;
  --success: #2F6446;
  --warning: #835A10;
  --destructive: #963B43;
  --border: #E4E6E5;
  --border-ink: var(--border);
  --input: #7B7C7F;
  --ring: #2742F0;
  --chart-1: #2742F0;
  --chart-2: #16249B;
  --chart-3: #C1EC2F;
  --chart-4: #7C8DF7;
  --chart-5: #4A4B4E;
  /* Brand fills — lime is NEVER a text colour (1.2:1 on page) */
  --lime: #C1EC2F;
  --lime-tint-1: #DDF0A8;
  --lime-tint-2: #E9F5C4;
  --baseline: #C9CBCA;     /* the anchorline hairline */
```

In `.dark`, replace colour tokens (same-hue lifted variants; contrast.test.ts recomputes every pair, values below all clear 4.5:1 text / 3:1 UI):

```css
  --background: #131417;
  --foreground: #F2F3F1;
  --card: #1C1D21;
  --card-foreground: #F2F3F1;
  --popover: #1C1D21;
  --popover-foreground: #F2F3F1;
  --primary: #A7B4FB;          /* lifted electric blue */
  --primary-foreground: #131417;
  --secondary: #26272C;
  --secondary-foreground: #F2F3F1;
  --muted: #26272C;
  --muted-foreground: #C6C7CB;
  --accent: #2B2C31;
  --accent-foreground: #F2F3F1;
  --success: #8FD3A8;
  --warning: #F0C05A;
  --destructive: #F2A2A9;
  --border: #34353A;
  --border-ink: var(--border);
  --input: #77787D;
  --ring: #A7B4FB;
  --chart-1: #A7B4FB;
  --chart-2: #7C8DF7;
  --chart-3: #C1EC2F;
  --chart-4: #DDF0A8;
  --chart-5: #C6C7CB;
  --lime: #C1EC2F;
  --lime-tint-1: #46521B;      /* tints darken in dark mode so panels stay quiet */
  --lime-tint-2: #2E360F;
  --baseline: #46474C;
```

In `@theme inline`, change the heading binding and add the new utilities:

```css
  --font-heading: var(--font-dm-sans);
  /* Brand fill + baseline utilities (bg-lime, bg-lime-tint-1/2, border-baseline) */
  --color-lime: var(--lime);
  --color-lime-tint-1: var(--lime-tint-1);
  --color-lime-tint-2: var(--lime-tint-2);
  --color-baseline: var(--baseline);
```

Also update `--shadow-focus` in `:root` to `0 0 0 3px rgba(39, 66, 240, 0.35)` and in `.dark` to `0 0 0 3px rgba(167, 180, 251, 0.45)`, and the `--sidebar-*` tokens: light `--sidebar-primary/--sidebar-ring: #2742F0`, `--sidebar-accent/--sidebar-border: #EEF0EE`, dark `--sidebar-primary/--sidebar-ring: #A7B4FB`, `--sidebar-accent: #2B2C31`, `--sidebar-border: #34353A`.

- [ ] **Step 4: Run token + contrast suites**

Run: `npx vitest run app/design-tokens.test.ts components/ui/contrast.test.ts`
Expected: PASS. If any contrast pair fails, darken/lift the reported foreground until it passes and record the final hex in the test output — do NOT weaken thresholds.

- [ ] **Step 5: Run the full unit suite to surface snapshot fallout**

Run: `npm run test`
Expected: PASS, except possibly `app/layout.test.tsx` (font wiring — fixed in Task 2). Anything else that fails on colour assertions: update the expected hex to the new token value in that test (the semantic assertion stays).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/design-tokens.test.ts
git commit -m "feat(tokens): Podium soft-brutalist palette, light+dark"
```

---

### Task 2: Fonts — DM Sans everywhere, retire Geist sans

**Files:**
- Modify: `app/layout.tsx:1-12`
- Modify: `app/layout.test.tsx` (font assertions only, if present)

**Interfaces:**
- Produces: CSS vars `--font-dm-sans`, `--font-geist-mono` on `<body>`; `--font-geist` no longer exists. `font-heading` utility now renders DM Sans.

- [ ] **Step 1: Update the imports and font constants in `app/layout.tsx`**

```tsx
import { DM_Sans, Geist_Mono } from 'next/font/google'

// Type system: DM Sans everywhere (800 display / 500 UI / 300 secondary);
// Geist Mono only for micro-labels.
const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '500', '700', '800'],
  display: 'swap',
})
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
```

And the body className becomes:

```tsx
      <body className={`${dmSans.variable} ${geistMono.variable} antialiased`}>
```

- [ ] **Step 2: Run the layout + token tests**

Run: `npx vitest run app/design-tokens.test.ts app/layout.test.tsx`
Expected: design-tokens PASS. If `app/layout.test.tsx` fails on `geist.variable`/`--font-geist` expectations, update those assertions to expect `dmSans.variable` and `geistMono.variable` only (mirror the Step 1 constants); re-run until PASS.

- [ ] **Step 3: Visual smoke**

Run: `npm run dev` briefly, load `http://localhost:3000`, confirm headings render DM Sans (rounder P/o than Geist). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/layout.test.tsx
git commit -m "feat(type): DM Sans site-wide, retire Geist sans"
```

---

### Task 3: PodiumMark SVG component

**Files:**
- Create: `components/brand/podium-mark.tsx`
- Test: `components/brand/podium-mark.test.tsx`

**Interfaces:**
- Produces: `PodiumMark({ height?: number; limeTop?: boolean; className?: string })` — inline SVG of the three-bar mark. Bar geometry constants exported for reuse: `BAR_RATIOS = [0.38, 0.64, 1]`, `ROUND_RATIO = 0.6`, `ROUND_MINOR = 0.12`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/brand/podium-mark.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PodiumMark, { BAR_RATIOS, ROUND_RATIO, ROUND_MINOR } from './podium-mark'

describe('PodiumMark', () => {
  it('renders three bars with heights in the 38/64/100 ratio', () => {
    const { container } = render(<PodiumMark height={100} />)
    const rects = container.querySelectorAll('path')
    expect(rects).toHaveLength(3)
    expect(BAR_RATIOS).toEqual([0.38, 0.64, 1])
  })

  it('rounds the top-left corner at 60% of bar width, minor corners at 12%', () => {
    expect(ROUND_RATIO).toBe(0.6)
    expect(ROUND_MINOR).toBe(0.12)
    const { container } = render(<PodiumMark height={100} />)
    // Bar width in the 100-high mark is 30 units → major radius 18, minor 3.6
    const d = container.querySelectorAll('path')[0]!.getAttribute('d')!
    expect(d).toContain('18')
  })

  it('paints the tallest bar lime when limeTop is set, ink otherwise', () => {
    const { container } = render(<PodiumMark height={40} limeTop />)
    const fills = Array.from(container.querySelectorAll('path')).map((p) => p.getAttribute('fill'))
    expect(fills[0]).toBe('currentColor')
    expect(fills[2]).toBe('var(--lime)')
  })

  it('is decorative by default (aria-hidden)', () => {
    const { container } = render(<PodiumMark />)
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/brand/podium-mark.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/brand/podium-mark.tsx
// The logo mark as geometry: three bars on a shared baseline, ascending left to
// right. One rounding rule at every scale — top-left radius = 60% of bar width,
// minor corners 12% — which is what keeps the nav mark and the hero steps
// reading as the same glyph (spec: Shape).
export const BAR_RATIOS = [0.38, 0.64, 1] as const
export const ROUND_RATIO = 0.6
export const ROUND_MINOR = 0.12

const BAR_W = 30 // viewBox units per bar at height 100
const GAP = 8

function barPath(x: number, h: number, totalH: number): string {
  const rMaj = BAR_W * ROUND_RATIO
  const rMin = BAR_W * ROUND_MINOR
  const top = totalH - h
  return [
    `M ${x} ${totalH - rMin}`,
    `L ${x} ${top + rMaj}`,
    `Q ${x} ${top} ${x + rMaj} ${top}`,
    `L ${x + BAR_W - rMin} ${top}`,
    `Q ${x + BAR_W} ${top} ${x + BAR_W} ${top + rMin}`,
    `L ${x + BAR_W} ${totalH - rMin}`,
    `Q ${x + BAR_W} ${totalH} ${x + BAR_W - rMin} ${totalH}`,
    `L ${x + rMin} ${totalH}`,
    `Q ${x} ${totalH} ${x} ${totalH - rMin}`,
    'Z',
  ].join(' ')
}

export default function PodiumMark({
  height = 24,
  limeTop = false,
  className,
}: {
  height?: number
  limeTop?: boolean
  className?: string
}) {
  const totalH = 100
  const totalW = BAR_W * 3 + GAP * 2
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${totalW} ${totalH}`}
      height={height}
      width={(height * totalW) / totalH}
      className={className}
    >
      {BAR_RATIOS.map((ratio, i) => (
        <path
          key={i}
          d={barPath(i * (BAR_W + GAP), ratio * totalH, totalH)}
          fill={limeTop && i === 2 ? 'var(--lime)' : 'currentColor'}
        />
      ))}
    </svg>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/brand/podium-mark.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/brand/podium-mark.tsx components/brand/podium-mark.test.tsx
git commit -m "feat(brand): PodiumMark SVG with proportional rounding"
```

---

### Task 4: Marketplace fixtures

**Files:**
- Create: `lib/landing/market-fixtures.ts`
- Test: `lib/landing/market-fixtures.test.ts`

**Interfaces:**
- Produces:
  - `type MarketProfile = { id: string; name: string; initials: string; sport: string; tier: 'U18' | 'U21' | 'Senior'; kind: 'athlete' | 'team'; deals: number; seeking: string }`
  - `MARKET_PROFILES: MarketProfile[]` (12 entries)
  - `type RallyPair = { athlete: MarketProfile; brand: string; category: string; baseOffer: number }`
  - `RALLY_PAIRS: RallyPair[]` (4 entries)
  - `SKYLINE_FILTERS: string[]` = `['All', 'Tennis', 'Football', 'Athletics', 'Teams']`

- [ ] **Step 1: Write the failing test**

```ts
// lib/landing/market-fixtures.test.ts
import { describe, it, expect } from 'vitest'
import { MARKET_PROFILES, RALLY_PAIRS, SKYLINE_FILTERS } from './market-fixtures'

describe('market fixtures', () => {
  it('ships 12 demo profiles with unique ids and positive deal counts', () => {
    expect(MARKET_PROFILES).toHaveLength(12)
    expect(new Set(MARKET_PROFILES.map((p) => p.id)).size).toBe(12)
    for (const p of MARKET_PROFILES) expect(p.deals).toBeGreaterThan(0)
  })

  it('covers every skyline filter with at least two profiles', () => {
    for (const f of SKYLINE_FILTERS.filter((f) => f !== 'All')) {
      const match = MARKET_PROFILES.filter((p) =>
        f === 'Teams' ? p.kind === 'team' : p.sport === f
      )
      expect(match.length, `filter ${f}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('ships 4 rally pairs with positive base offers', () => {
    expect(RALLY_PAIRS).toHaveLength(4)
    for (const r of RALLY_PAIRS) expect(r.baseOffer).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/landing/market-fixtures.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/landing/market-fixtures.ts
// Demo data for the landing marketplace panel. Deliberately static: the landing
// page never reads the DB (spec: Implementation). Names are fictional.
export type MarketProfile = {
  id: string
  name: string
  initials: string
  sport: string
  tier: 'U18' | 'U21' | 'Senior'
  kind: 'athlete' | 'team'
  deals: number
  seeking: string
}

export const SKYLINE_FILTERS = ['All', 'Tennis', 'Football', 'Athletics', 'Teams'] as const

export const MARKET_PROFILES: MarketProfile[] = [
  { id: 'p1', name: 'Rita Silva', initials: 'RS', sport: 'Tennis', tier: 'U21', kind: 'athlete', deals: 22, seeking: 'Kit deal' },
  { id: 'p2', name: 'Joe Okafor', initials: 'JO', sport: 'Athletics', tier: 'Senior', kind: 'athlete', deals: 31, seeking: 'Season sponsor' },
  { id: 'p3', name: 'Mia Bakker', initials: 'MB', sport: 'Tennis', tier: 'U18', kind: 'athlete', deals: 12, seeking: 'Travel support' },
  { id: 'p4', name: 'Lena Tan', initials: 'LT', sport: 'Athletics', tier: 'U21', kind: 'athlete', deals: 8, seeking: 'Equipment' },
  { id: 'p5', name: 'Ferndale FC', initials: 'FF', sport: 'Football', tier: 'Senior', kind: 'team', deals: 17, seeking: 'Shirt sponsor' },
  { id: 'p6', name: 'Ana Novak', initials: 'AN', sport: 'Tennis', tier: 'Senior', kind: 'athlete', deals: 26, seeking: 'Racket partner' },
  { id: 'p7', name: 'Tom Forster', initials: 'TF', sport: 'Athletics', tier: 'U18', kind: 'athlete', deals: 5, seeking: 'First sponsor' },
  { id: 'p8', name: 'Harbour Rowing', initials: 'HR', sport: 'Rowing', tier: 'Senior', kind: 'team', deals: 9, seeking: 'Boat naming' },
  { id: 'p9', name: 'Kai Mercer', initials: 'KM', sport: 'Football', tier: 'U21', kind: 'athlete', deals: 14, seeking: 'Boot deal' },
  { id: 'p10', name: 'Priya Shah', initials: 'PS', sport: 'Tennis', tier: 'U21', kind: 'athlete', deals: 19, seeking: 'Apparel' },
  { id: 'p11', name: 'Oak Park Netball', initials: 'ON', sport: 'Netball', tier: 'Senior', kind: 'team', deals: 11, seeking: 'Court sponsor' },
  { id: 'p12', name: 'Leo Costa', initials: 'LC', sport: 'Football', tier: 'U18', kind: 'athlete', deals: 7, seeking: 'Academy backer' },
]

export type RallyPair = {
  athlete: MarketProfile
  brand: string
  category: string
  baseOffer: number
}

export const RALLY_PAIRS: RallyPair[] = [
  { athlete: MARKET_PROFILES[0]!, brand: 'Vantage Gear', category: 'Apparel', baseOffer: 400 },
  { athlete: MARKET_PROFILES[1]!, brand: 'Northline Energy', category: 'Nutrition', baseOffer: 650 },
  { athlete: MARKET_PROFILES[4]!, brand: 'Hexa Insurance', category: 'Local sponsor', baseOffer: 900 },
  { athlete: MARKET_PROFILES[5]!, brand: 'CourtOne', category: 'Equipment', baseOffer: 550 },
]
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/landing/market-fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/landing/market-fixtures.ts lib/landing/market-fixtures.test.ts
git commit -m "feat(landing): static marketplace fixture data"
```

---

### Task 5: RotatingWord component

**Files:**
- Create: `components/landing/rotating-word.tsx`
- Test: `components/landing/rotating-word.test.tsx`

**Interfaces:**
- Produces: `RotatingWord({ words: string[]; intervalMs?: number })` client component. Renders current word inside a lime block (`bg-lime` span, ink text via `text-foreground`), cycles every `intervalMs` (default 2500). Screen readers get a static full list via visually-hidden text; the animated span is `aria-hidden`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/landing/rotating-word.test.tsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RotatingWord from './rotating-word'

const WORDS = ['athletes', 'teams', 'brands', 'you']

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('RotatingWord', () => {
  it('renders the first word initially', () => {
    render(<RotatingWord words={WORDS} />)
    expect(screen.getByText('athletes')).toBeInTheDocument()
  })

  it('advances to the next word after the interval and wraps around', () => {
    render(<RotatingWord words={WORDS} intervalMs={2500} />)
    act(() => vi.advanceTimersByTime(2500))
    expect(screen.getByText('teams')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2500 * 3))
    expect(screen.getByText('athletes')).toBeInTheDocument()
  })

  it('hides the animated word from screen readers and provides a static list', () => {
    const { container } = render(<RotatingWord words={WORDS} />)
    expect(container.querySelector('[aria-hidden="true"]')!.textContent).toContain('athletes')
    expect(screen.getByText('athletes, teams, brands and you')).toHaveClass('sr-only')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/landing/rotating-word.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/landing/rotating-word.tsx
'use client'

import { useEffect, useState } from 'react'

// The hero's fill-in-the-blank word. The lime block is the page's one
// full-saturation lime element (spec: colour rules); ink text on lime is 13:1.
export default function RotatingWord({
  words,
  intervalMs = 2500,
}: {
  words: string[]
  intervalMs?: number
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs)
    return () => clearInterval(id)
  }, [words.length, intervalMs])

  const list =
    words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0]

  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block rounded-xl bg-lime px-3 text-foreground transition-all duration-300 motion-reduce:transition-none"
      >
        {words[index]}
      </span>
      <span className="sr-only">{list}</span>
    </>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/landing/rotating-word.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/rotating-word.tsx components/landing/rotating-word.test.tsx
git commit -m "feat(landing): rotating hook word with sr-safe fallback"
```

---

### Task 6: Rally engine (pure game logic)

**Files:**
- Create: `lib/landing/rally-engine.ts`
- Test: `lib/landing/rally-engine.test.ts`

**Interfaces:**
- Consumes: `RALLY_PAIRS` from `lib/landing/market-fixtures` (Task 4).
- Produces:
  - `RETURNS_TO_SIGN = 5`
  - `type RallyState = { pairIndex: number; returns: number; signed: boolean }`
  - `newRally(pairIndex: number): RallyState`
  - `registerReturn(s: RallyState): RallyState` — increments `returns`, sets `signed` when it reaches `RETURNS_TO_SIGN`; no-op once signed
  - `nextRally(s: RallyState, pairCount: number): RallyState` — fresh rally on the next pair, wrapping
  - `tickerLine(s: RallyState, pairs: typeof RALLY_PAIRS): string` — e.g. `RALLY 3 · OFFER £900 · KIT DEAL` or `SIGNED · £1,400 · KIT DEAL`; offer = `baseOffer + returns * 250`

- [ ] **Step 1: Write the failing test**

```ts
// lib/landing/rally-engine.test.ts
import { describe, it, expect } from 'vitest'
import { newRally, registerReturn, nextRally, tickerLine, RETURNS_TO_SIGN } from './rally-engine'
import { RALLY_PAIRS } from './market-fixtures'

describe('rally engine', () => {
  it('starts unsigned with zero returns', () => {
    expect(newRally(0)).toEqual({ pairIndex: 0, returns: 0, signed: false })
  })

  it('signs after exactly RETURNS_TO_SIGN returns and then freezes', () => {
    let s = newRally(0)
    for (let i = 0; i < RETURNS_TO_SIGN - 1; i++) s = registerReturn(s)
    expect(s.signed).toBe(false)
    s = registerReturn(s)
    expect(s.signed).toBe(true)
    expect(registerReturn(s)).toEqual(s)
  })

  it('advances to the next pair and wraps at the end', () => {
    expect(nextRally(newRally(3), 4).pairIndex).toBe(0)
    expect(nextRally(newRally(1), 4)).toEqual({ pairIndex: 2, returns: 0, signed: false })
  })

  it('escalates the offer by £250 per return in the ticker', () => {
    let s = newRally(0)
    expect(tickerLine(s, RALLY_PAIRS)).toBe('RALLY 0 · OFFER £400 · KIT DEAL')
    s = registerReturn(s)
    s = registerReturn(s)
    expect(tickerLine(s, RALLY_PAIRS)).toBe('RALLY 2 · OFFER £900 · KIT DEAL')
  })

  it('stamps SIGNED with the final thousands-separated offer', () => {
    let s = newRally(0)
    for (let i = 0; i < RETURNS_TO_SIGN; i++) s = registerReturn(s)
    expect(tickerLine(s, RALLY_PAIRS)).toBe('SIGNED · £1,650 · KIT DEAL')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/landing/rally-engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/landing/rally-engine.ts
// Pure state machine for the marketplace rally game. All animation-frame and
// pointer concerns live in the component; this module is the testable core.
import type { RALLY_PAIRS as PairsType } from './market-fixtures'

export const RETURNS_TO_SIGN = 5

export type RallyState = {
  pairIndex: number
  returns: number
  signed: boolean
}

export function newRally(pairIndex: number): RallyState {
  return { pairIndex, returns: 0, signed: false }
}

export function registerReturn(s: RallyState): RallyState {
  if (s.signed) return s
  const returns = s.returns + 1
  return { ...s, returns, signed: returns >= RETURNS_TO_SIGN }
}

export function nextRally(s: RallyState, pairCount: number): RallyState {
  return newRally((s.pairIndex + 1) % pairCount)
}

export function tickerLine(s: RallyState, pairs: typeof PairsType): string {
  const pair = pairs[s.pairIndex]!
  const offer = pair.baseOffer + s.returns * 250
  const amount = `£${offer.toLocaleString('en-GB')}`
  const label = pair.athlete.seeking.toUpperCase()
  return s.signed ? `SIGNED · ${amount} · ${label}` : `RALLY ${s.returns} · OFFER ${amount} · ${label}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/landing/rally-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/landing/rally-engine.ts lib/landing/rally-engine.test.ts
git commit -m "feat(landing): pure rally game state machine"
```

---

### Task 7: Track math (pure scroll/domino/snap logic)

**Files:**
- Create: `lib/landing/track-math.ts`
- Test: `lib/landing/track-math.test.ts`

**Interfaces:**
- Produces:
  - `PANEL_COUNT = 5`
  - `trackX(scrollY: number, scrollRange: number, trackWidth: number, viewportWidth: number): number` — linear map of scroll to negative translateX, clamped to `[-(trackWidth - viewportWidth), 0]`
  - `snapTarget(x: number, viewportWidth: number, threshold = 0.15): number | null` — nearest panel-aligned x if within `threshold * viewportWidth`, else null
  - `dominoAngle(progress: number, barIndex: 0 | 1 | 2): number` — staged 0→90° rotations: bar 0 tips over progress 0–0.4, bar 1 over 0.2–0.7, bar 2 over 0.45–1

- [ ] **Step 1: Write the failing test**

```ts
// lib/landing/track-math.test.ts
import { describe, it, expect } from 'vitest'
import { trackX, snapTarget, dominoAngle, PANEL_COUNT } from './track-math'

describe('trackX', () => {
  it('maps scroll linearly onto horizontal travel', () => {
    // 5 panels of 1000px, viewport 1000 → track 5000, travel 4000, range 4000
    expect(trackX(0, 4000, 5000, 1000)).toBe(0)
    expect(trackX(2000, 4000, 5000, 1000)).toBe(-2000)
    expect(trackX(4000, 4000, 5000, 1000)).toBe(-4000)
  })
  it('clamps beyond either end', () => {
    expect(trackX(-50, 4000, 5000, 1000)).toBe(0)
    expect(trackX(9999, 4000, 5000, 1000)).toBe(-4000)
  })
})

describe('snapTarget', () => {
  it('snaps when resting within 15% of a panel boundary', () => {
    expect(snapTarget(-1100, 1000)).toBe(-1000)
    expect(snapTarget(-1860, 1000)).toBe(-2000)
  })
  it('returns null mid-panel', () => {
    expect(snapTarget(-1500, 1000)).toBeNull()
  })
})

describe('dominoAngle', () => {
  it('all bars upright at 0 and flat at 1', () => {
    for (const i of [0, 1, 2] as const) {
      expect(dominoAngle(0, i)).toBe(0)
      expect(dominoAngle(1, i)).toBe(90)
    }
  })
  it('staggers: bar 0 finishes before bar 2 starts moving much', () => {
    expect(dominoAngle(0.45, 0)).toBe(90)
    expect(dominoAngle(0.45, 2)).toBe(0)
  })
  it('exposes the panel count', () => {
    expect(PANEL_COUNT).toBe(5)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/landing/track-math.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/landing/track-math.ts
// Pure geometry for the horizontal landing track. The client component feeds
// live numbers in; everything testable lives here.
export const PANEL_COUNT = 5

export function trackX(
  scrollY: number,
  scrollRange: number,
  trackWidth: number,
  viewportWidth: number
): number {
  const maxTravel = trackWidth - viewportWidth
  const progress = scrollRange <= 0 ? 0 : Math.min(Math.max(scrollY / scrollRange, 0), 1)
  return -progress * maxTravel
}

export function snapTarget(x: number, viewportWidth: number, threshold = 0.15): number | null {
  const nearest = Math.round(x / viewportWidth) * viewportWidth
  return Math.abs(x - nearest) <= viewportWidth * threshold ? nearest : null
}

// Staged domino windows: [start, end] of the transition progress in which each
// bar rotates from 0° to 90° about its bottom-right corner (tallest last).
const WINDOWS: [number, number][] = [
  [0, 0.4],
  [0.2, 0.7],
  [0.45, 1],
]

export function dominoAngle(progress: number, barIndex: 0 | 1 | 2): number {
  const [start, end] = WINDOWS[barIndex]!
  const local = (progress - start) / (end - start)
  return 90 * Math.min(Math.max(local, 0), 1)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/landing/track-math.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/landing/track-math.ts lib/landing/track-math.test.ts
git commit -m "feat(landing): pure track/snap/domino geometry"
```

---

### Task 8: Skyline marketplace variant

**Files:**
- Create: `components/landing/market-skyline.tsx`
- Test: `components/landing/market-skyline.test.tsx`

**Interfaces:**
- Consumes: `MARKET_PROFILES`, `SKYLINE_FILTERS`, `MarketProfile` (Task 4).
- Produces: `MarketSkyline()` client component — filter chips + one bar per profile on the baseline; focused bar expands to a card. Bar height px = `64 + deals * 4`. Focused bar is `bg-lime`; others `bg-lime-tint-1`. The expanded card shows name, `SPORT · TIER · N DEALS` mono line, and a "View" button (`bg-primary`, links to `/role-select`).

- [ ] **Step 1: Write the failing test**

```tsx
// components/landing/market-skyline.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import MarketSkyline from './market-skyline'
import { MARKET_PROFILES } from '@/lib/landing/market-fixtures'

describe('MarketSkyline', () => {
  it('renders one bar per profile', () => {
    render(<MarketSkyline />)
    expect(screen.getAllByRole('listitem')).toHaveLength(MARKET_PROFILES.length)
  })

  it('expands the focused profile into a card with its mono stat line', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: /Rita Silva/ }))
    expect(screen.getByText('TENNIS · U21 · 22 DEALS')).toBeInTheDocument()
  })

  it('filters the skyline by sport chips', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Tennis' }))
    const tennis = MARKET_PROFILES.filter((p) => p.sport === 'Tennis')
    expect(screen.getAllByRole('listitem')).toHaveLength(tennis.length)
  })

  it('filters teams as a kind, not a sport', async () => {
    render(<MarketSkyline />)
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
    const teams = MARKET_PROFILES.filter((p) => p.kind === 'team')
    expect(screen.getAllByRole('listitem')).toHaveLength(teams.length)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/landing/market-skyline.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/landing/market-skyline.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MARKET_PROFILES, SKYLINE_FILTERS } from '@/lib/landing/market-fixtures'

// Marketplace variant A: every profile is a bar of the podium, standing on the
// baseline. Focused bar = the panel's one full-saturation lime element; the
// rest are tints (spec: colour rules). Heights encode momentum.
export default function MarketSkyline() {
  const [filter, setFilter] = useState<(typeof SKYLINE_FILTERS)[number]>('All')
  const [focusId, setFocusId] = useState(MARKET_PROFILES[0]!.id)

  const profiles = MARKET_PROFILES.filter((p) =>
    filter === 'All' ? true : filter === 'Teams' ? p.kind === 'team' : p.sport === filter
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter profiles">
        {SKYLINE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-[10px] px-4 py-2 text-small font-bold transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="flex items-end gap-2" aria-label="Profiles on the podium">
        {profiles.map((p) => {
          const focused = p.id === focusId
          const height = 64 + p.deals * 4
          return (
            <li key={p.id} className={focused ? 'flex-[3] min-w-44' : 'flex-1'}>
              <button
                type="button"
                onClick={() => setFocusId(p.id)}
                aria-expanded={focused}
                style={{
                  height,
                  borderRadius: focused
                    ? '18px 4px 0 0'
                    : 'calc(100% * 0.6 / 3) 4px 0 0', // proportional top-left rounding
                }}
                className={`block w-full overflow-hidden p-3 text-left align-bottom transition-all duration-300 motion-reduce:transition-none ${
                  focused ? 'bg-lime' : 'bg-lime-tint-1 hover:bg-lime-tint-2'
                }`}
              >
                {focused ? (
                  <span className="flex h-full flex-col justify-between text-foreground">
                    <span>
                      <span className="block font-heading text-medium font-extrabold">{p.name}</span>
                      <span className="mt-1 block font-mono text-small uppercase tracking-[.15em]">
                        {`${p.sport} · ${p.tier} · ${p.deals} DEALS`.toUpperCase()}
                      </span>
                    </span>
                    <Link
                      href="/role-select"
                      className="w-fit rounded-[10px] bg-primary px-4 py-2 text-small font-bold text-primary-foreground"
                    >
                      View
                    </Link>
                  </span>
                ) : (
                  <span className="sr-only">{p.name}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/landing/market-skyline.test.tsx`
Expected: PASS. Note: the focused-card test clicks by accessible name — the collapsed bars expose their name via `sr-only`, the focused one via the visible heading; if the first-profile default makes `Rita Silva` already focused the test still passes (`aria-expanded` toggling is not asserted).

- [ ] **Step 5: Commit**

```bash
git add components/landing/market-skyline.tsx components/landing/market-skyline.test.tsx
git commit -m "feat(landing): skyline marketplace variant"
```

---

### Task 9: Rally marketplace variant (interactive game)

**Files:**
- Create: `components/landing/market-rally.tsx`
- Test: `components/landing/market-rally.test.tsx`

**Interfaces:**
- Consumes: `RALLY_PAIRS` (Task 4); `newRally`, `registerReturn`, `nextRally`, `tickerLine`, `RETURNS_TO_SIGN` (Task 6).
- Produces: `MarketRally()` client component. Renders athlete card (left), brand card (right), ball, racket line, and the mono ticker. Pointer movement positions the racket; a returned ball advances the engine. Under `prefers-reduced-motion` (or non-fine pointers without rAF) renders the static three-frame storyboard using the same `tickerLine` copy. The playing surface is `role="img"` with an `aria-label` describing the current deal state; the game is skippable non-content (all real content lives in the cards + ticker text).

- [ ] **Step 1: Write the failing test**

Testing note: jsdom has no rAF loop worth simulating; the component must expose its game-advance handler on the DOM (`data-testid="rally-court"` with click = successful return in test mode). Ball physics stay untested here — the engine (Task 6) carries the logic guarantees.

```tsx
// components/landing/market-rally.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import MarketRally from './market-rally'
import { RETURNS_TO_SIGN } from '@/lib/landing/rally-engine'

afterEach(() => vi.unstubAllGlobals())

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? matches : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('MarketRally', () => {
  it('renders the first pair and an unsigned ticker', () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    expect(screen.getByText('Rita Silva')).toBeInTheDocument()
    expect(screen.getByText('Vantage Gear')).toBeInTheDocument()
    expect(screen.getByText(/RALLY 0 · OFFER £400/)).toBeInTheDocument()
  })

  it('advances the ticker per return and stamps SIGNED after five', async () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    const court = screen.getByTestId('rally-court')
    for (let i = 0; i < RETURNS_TO_SIGN; i++) await userEvent.click(court)
    expect(screen.getByText(/SIGNED · £1,650/)).toBeInTheDocument()
  })

  it('serves the next pair after a signed rally is clicked again', async () => {
    stubReducedMotion(false)
    render(<MarketRally />)
    const court = screen.getByTestId('rally-court')
    for (let i = 0; i < RETURNS_TO_SIGN + 1; i++) await userEvent.click(court)
    expect(screen.getByText('Joe Okafor')).toBeInTheDocument()
    expect(screen.getByText(/RALLY 0 · OFFER £650/)).toBeInTheDocument()
  })

  it('renders the static storyboard under reduced motion', () => {
    stubReducedMotion(true)
    render(<MarketRally />)
    expect(screen.getByTestId('rally-storyboard')).toBeInTheDocument()
    expect(screen.queryByTestId('rally-court')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/landing/market-rally.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/landing/market-rally.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { RALLY_PAIRS } from '@/lib/landing/market-fixtures'
import {
  newRally,
  registerReturn,
  nextRally,
  tickerLine,
  type RallyState,
} from '@/lib/landing/rally-engine'

// Marketplace variant B: the two-sided market as a playable rally. The visitor
// returns the ball; every return escalates the deal ticker until SIGNED.
// Content (cards + ticker) is plain DOM text; the ball is decoration.

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function PairCard({ title, subtitle, side }: { title: string; subtitle: string; side: 'left' | 'right' }) {
  return (
    <div
      className={`w-40 rounded-xl border-[1.5px] bg-card p-3 ${
        side === 'left' ? 'border-foreground' : 'border-primary'
      }`}
    >
      <span className="block font-heading text-medium font-extrabold text-foreground">{title}</span>
      <span className="mt-1 block font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
        {subtitle}
      </span>
    </div>
  )
}

export default function MarketRally() {
  const reduced = useReducedMotion()
  const [state, setState] = useState<RallyState>(() => newRally(0))
  const [ballT, setBallT] = useState(0) // 0..1 position along the arc, athlete→brand
  const raf = useRef<number | null>(null)
  const dir = useRef(1)

  // Decorative ball flight: bounce t between 0 and 1. Each completed
  // athlete-side contact is triggered by the player (click / pointer hit).
  useEffect(() => {
    if (reduced) return
    const step = () => {
      setBallT((t) => {
        let next = t + dir.current * 0.012
        if (next >= 1) { next = 1; dir.current = -1 }
        if (next <= 0) { next = 0; dir.current = 1 }
        return next
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [reduced])

  const pair = RALLY_PAIRS[state.pairIndex]!
  const ticker = tickerLine(state, RALLY_PAIRS)

  const onReturn = () => {
    setState((s) => (s.signed ? nextRally(s, RALLY_PAIRS.length) : registerReturn(s)))
    dir.current = 1
  }

  const cards = (
    <div className="flex items-end justify-between gap-6">
      <PairCard title={pair.athlete.name} subtitle={`${pair.athlete.sport} · ${pair.athlete.tier}`} side="left" />
      <PairCard title={pair.brand} subtitle={`BRAND · ${pair.category}`} side="right" />
    </div>
  )

  if (reduced) {
    // Static three-frame storyboard with the same deal copy — same information,
    // zero motion (spec: fallbacks).
    const frames = [newRally(state.pairIndex), { ...state, returns: 2, signed: false }, { ...newRally(state.pairIndex), returns: 5, signed: true }]
    return (
      <div data-testid="rally-storyboard">
        {cards}
        <ol className="mt-4 space-y-1">
          {frames.map((f, i) => (
            <li key={i} className="font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
              {tickerLine(f, RALLY_PAIRS)}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        data-testid="rally-court"
        onClick={onReturn}
        aria-label={`Tennis rally game. ${ticker}. Click or tap to return the ball.`}
        className="relative block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        {cards}
        {/* ball on a dashed arc over the baseline */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-4 w-4 rounded-full border-2 border-foreground bg-lime"
          style={{
            left: `calc(${10 + ballT * 80}% - 8px)`,
            bottom: `${30 + Math.sin(ballT * Math.PI) * 55}%`,
          }}
        />
      </button>
      <p aria-live="polite" className="mt-4 font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
        {ticker}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/landing/market-rally.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/market-rally.tsx components/landing/market-rally.test.tsx
git commit -m "feat(landing): playable rally marketplace variant"
```

---

### Task 10: Install motion + HorizontalTrack with baseline and domino steps

**Files:**
- Create: `components/landing/horizontal-track.tsx`
- Create: `components/landing/domino-steps.tsx`
- Test: `components/landing/horizontal-track.test.tsx`
- Modify: `package.json` (add `motion`)

**Interfaces:**
- Consumes: `trackX`, `snapTarget`, `dominoAngle`, `PANEL_COUNT` (Task 7).
- Produces:
  - `HorizontalTrack({ children })` client component: expects exactly `PANEL_COUNT` children (the panels, in DOM order). Desktop (`min-width: 1024px`, motion allowed): sticky viewport + horizontal translate + continuous baseline + mono panel ticks. Otherwise: vertical stack, panels in the same order.
  - `DominoSteps()` client component: the hero's three lime bars; reads transition progress from `TrackContext` and applies `dominoAngle` rotations (origin bottom-right). Exported `TrackContext: React.Context<{ progress: number }>` (progress of the 1→2 transition, 0 outside it).

- [ ] **Step 1: Install motion**

Run: `npm install motion`
Expected: added to dependencies without peer warnings (React 19 is supported).

- [ ] **Step 2: Write the failing test**

jsdom cannot do sticky/scroll layout — assert the structural contract: all five panels render in DOM order in both modes, the vertical fallback applies when matchMedia says small/reduced, and the baseline + ticks exist in track mode.

```tsx
// components/landing/horizontal-track.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import HorizontalTrack from './horizontal-track'

afterEach(() => vi.unstubAllGlobals())

function stubMedia({ wide, reduced }: { wide: boolean; reduced: boolean }) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('min-width') ? wide : q.includes('prefers-reduced-motion') ? reduced : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const PANELS = ['P1', 'P2', 'P3', 'P4', 'P5'].map((t) => <section key={t}>{t}</section>)

describe('HorizontalTrack', () => {
  it('renders all five panels in DOM order (track mode)', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    const text = screen.getByTestId('landing-track').textContent!
    expect(text.indexOf('P1')).toBeLessThan(text.indexOf('P5'))
  })

  it('draws the continuous baseline and panel ticks in track mode', () => {
    stubMedia({ wide: true, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.getByTestId('baseline')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('falls back to a vertical stack under reduced motion', () => {
    stubMedia({ wide: true, reduced: true })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.queryByTestId('landing-track')).not.toBeInTheDocument()
    expect(screen.getByTestId('landing-stack')).toBeInTheDocument()
    expect(screen.getByText('P5')).toBeInTheDocument()
  })

  it('falls back to a vertical stack on narrow viewports', () => {
    stubMedia({ wide: false, reduced: false })
    render(<HorizontalTrack>{PANELS}</HorizontalTrack>)
    expect(screen.getByTestId('landing-stack')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run components/landing/horizontal-track.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `horizontal-track.tsx`**

```tsx
// components/landing/horizontal-track.tsx
'use client'

import {
  Children,
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { animate } from 'motion'
import { trackX, snapTarget, PANEL_COUNT } from '@/lib/landing/track-math'

// Progress of the hero→marketplace domino transition (0 outside it).
export const TrackContext = createContext<{ progress: number }>({ progress: 0 })

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

const TICKS = ['01', '02', '03', '04', '05']

export default function HorizontalTrack({ children }: { children: ReactNode }) {
  const panels = Children.toArray(children)
  const wide = useMedia('(min-width: 1024px)')
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [progress, setProgress] = useState(0)
  const snapAnim = useRef<ReturnType<typeof animate> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onScroll = useCallback(() => {
    const vw = window.innerWidth
    const trackW = vw * PANEL_COUNT
    const range = document.body.scrollHeight - window.innerHeight
    const nextX = trackX(window.scrollY, range, trackW, vw)
    snapAnim.current?.stop()
    setX(nextX)
    // Domino transition occupies the first inter-panel gap: x in [0, -vw].
    setProgress(Math.min(Math.max(-nextX / vw, 0), 1))
    // Soft snap once scrolling rests near a boundary (spec: scroll model).
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const target = snapTarget(nextX, vw)
      if (target !== null && target !== nextX) {
        const targetScroll = (-target / (trackW - vw)) * range
        snapAnim.current = animate(window.scrollY, targetScroll, {
          duration: 0.35,
          ease: 'easeOut',
          onUpdate: (v) => window.scrollTo(0, v),
        })
      }
    }, 140)
  }, [])

  useEffect(() => {
    if (!wide || reduced) return
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      snapAnim.current?.stop()
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [wide, reduced, onScroll])

  // Keyboard: arrows/PageDown move one panel (spec: scroll model).
  useEffect(() => {
    if (!wide || reduced) return
    const onKey = (e: KeyboardEvent) => {
      const step = window.innerHeight * ((document.body.scrollHeight - window.innerHeight) /
        (window.innerWidth * (PANEL_COUNT - 1))) // scroll distance per panel
      if (['ArrowRight', 'PageDown'].includes(e.key)) window.scrollBy({ top: step, behavior: 'smooth' })
      if (['ArrowLeft', 'PageUp'].includes(e.key)) window.scrollBy({ top: -step, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wide, reduced])

  if (!wide || reduced) {
    return (
      <div data-testid="landing-stack">
        <TrackContext.Provider value={{ progress: 0 }}>{panels}</TrackContext.Provider>
      </div>
    )
  }

  return (
    // Body height provides the scroll length; the sticky viewport shows the track.
    <div style={{ height: `${PANEL_COUNT * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <TrackContext.Provider value={{ progress }}>
          <div
            data-testid="landing-track"
            className="flex h-full"
            style={{ width: `${PANEL_COUNT * 100}vw`, transform: `translateX(${x}px)` }}
          >
            {panels.map((panel, i) => (
              <div key={i} className="relative h-full w-screen shrink-0">
                {panel}
                <span className="absolute bottom-[calc(28%-1.75rem)] left-6 font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
                  {TICKS[i]}
                </span>
              </div>
            ))}
            {/* The baseline: one continuous hairline the whole page stands on. */}
            <div
              data-testid="baseline"
              aria-hidden="true"
              className="absolute inset-x-0 border-t-[1.5px] border-baseline"
              style={{ top: '72%' }}
            />
          </div>
        </TrackContext.Provider>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement `domino-steps.tsx`**

```tsx
// components/landing/domino-steps.tsx
'use client'

import { useContext } from 'react'
import { TrackContext } from './horizontal-track'
import { dominoAngle } from '@/lib/landing/track-math'
import { BAR_RATIOS } from '@/components/brand/podium-mark'

// The hero's podium steps, standing on the baseline. During the panel 1→2
// transition they tip like dominoes about their bottom-right corners.
const WIDTH_PX = 110

export default function DominoSteps() {
  const { progress } = useContext(TrackContext)
  return (
    <div aria-hidden="true" className="flex items-end gap-3" style={{ height: 320 }}>
      {BAR_RATIOS.map((ratio, i) => (
        <div
          key={i}
          className="bg-lime"
          style={{
            width: WIDTH_PX,
            height: ratio * 320,
            // Proportional rounding: 60% / 12% of bar width (spec: shape).
            borderRadius: `${WIDTH_PX * 0.6}px ${WIDTH_PX * 0.12}px ${WIDTH_PX * 0.12}px ${WIDTH_PX * 0.12}px`,
            transform: `rotate(${dominoAngle(progress, i as 0 | 1 | 2)}deg)`,
            transformOrigin: 'bottom right',
            transition: 'transform 0.05s linear',
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run components/landing/horizontal-track.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/landing/horizontal-track.tsx components/landing/domino-steps.tsx components/landing/horizontal-track.test.tsx
git commit -m "feat(landing): horizontal track with baseline, snap and domino steps"
```

---

### Task 11: The five panels

**Files:**
- Create: `components/landing/panels/hero-panel.tsx`
- Create: `components/landing/panels/market-panel.tsx`
- Create: `components/landing/panels/what-we-do-panel.tsx`
- Create: `components/landing/panels/roles-panel.tsx`
- Create: `components/landing/panels/build-panel.tsx`
- Test: `components/landing/panels/panels.test.tsx`

**Interfaces:**
- Consumes: `RotatingWord` (Task 5), `DominoSteps` (Task 10), `MarketSkyline` (Task 8), `MarketRally` (Task 9), `PodiumMark` (Task 3).
- Produces: five default-export server components, no props except `MarketPanel({ variant }: { variant: 'skyline' | 'rally' })`. Every panel roots at `<section aria-labelledby={…}>` and positions its key content on the baseline (bottom-aligned at 72% via `justify-end pb-[28%]`-style layout utilities — visually tuned during implementation, structure below is binding).

- [ ] **Step 1: Write the failing test**

```tsx
// components/landing/panels/panels.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HeroPanel from './hero-panel'
import MarketPanel from './market-panel'
import WhatWeDoPanel from './what-we-do-panel'
import RolesPanel from './roles-panel'
import BuildPanel from './build-panel'

describe('landing panels', () => {
  it('hero carries the hook, CTAs and mono label', () => {
    render(<HeroPanel />)
    expect(screen.getByText(/The podium/)).toBeInTheDocument()
    expect(screen.getByText('SPONSORSHIP MARKETPLACE')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get on the podium' })).toHaveAttribute('href', '/role-select')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#what-we-do')
  })

  it('market panel renders the chosen variant', () => {
    render(<MarketPanel variant="skyline" />)
    expect(screen.getByRole('group', { name: 'Filter profiles' })).toBeInTheDocument()
  })

  it('what-we-do carries the three slabs in order', () => {
    render(<WhatWeDoPanel />)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items[0]).toContain('Build your profile')
    expect(items[1]).toContain('Get discovered')
    expect(items[2]).toContain('Sign and get paid')
  })

  it('roles panel names all three audiences', () => {
    render(<RolesPanel />)
    for (const name of ['Athletes', 'Teams & clubs', 'Brands']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('build panel closes with the profile CTA and footer links, no FAQ', () => {
    render(<BuildPanel />)
    expect(screen.getByRole('link', { name: 'Build your profile' })).toHaveAttribute('href', '/role-select')
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument()
    expect(screen.queryByText(/FAQ/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/landing/panels/panels.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the panels**

```tsx
// components/landing/panels/hero-panel.tsx
import Link from 'next/link'
import RotatingWord from '@/components/landing/rotating-word'
import DominoSteps from '@/components/landing/domino-steps'

export default function HeroPanel() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="flex h-full items-end justify-between gap-14 px-6 pb-[30vh] pt-24 md:px-16"
    >
      <div className="max-w-xl">
        <p className="mb-4 font-mono text-small uppercase tracking-[.15em] text-primary">
          SPONSORSHIP MARKETPLACE
        </p>
        <h1 id="hero-heading" className="font-heading text-display font-extrabold tracking-tight text-foreground">
          The podium has room for <RotatingWord words={['athletes', 'teams', 'brands', 'you']} />
        </h1>
        <p className="mt-4 max-w-md text-medium font-light text-muted-foreground">
          Build a profile, get discovered, agree the deal and get paid. Athletes, teams and brands,
          all in one place.
        </p>
        <div className="mt-7 flex items-center gap-3">
          <Link
            href="/role-select"
            className="rounded-xl bg-primary px-7 py-3.5 text-medium font-bold text-primary-foreground"
          >
            Get on the podium
          </Link>
          <Link href="#what-we-do" className="px-3 py-3.5 text-medium font-medium text-primary underline underline-offset-4">
            How it works
          </Link>
        </div>
      </div>
      <div className="hidden md:block">
        <DominoSteps />
      </div>
    </section>
  )
}
```

```tsx
// components/landing/panels/market-panel.tsx
import MarketSkyline from '@/components/landing/market-skyline'
import MarketRally from '@/components/landing/market-rally'

export default function MarketPanel({ variant }: { variant: 'skyline' | 'rally' }) {
  return (
    <section aria-labelledby="market-heading" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      <h2 id="market-heading" className="mb-6 font-heading text-large font-extrabold text-foreground">
        The marketplace, live
      </h2>
      {variant === 'rally' ? <MarketRally /> : <MarketSkyline />}
      <ul className="mt-6 flex flex-wrap gap-2" aria-label="What members say">
        <li className="rounded-full border border-border bg-card px-4 py-2 text-small font-medium text-foreground">
          &ldquo;Signed my first sponsor in 3 weeks&rdquo; — athlete
        </li>
        <li className="rounded-full border border-border bg-card px-4 py-2 text-small font-medium text-foreground">
          &ldquo;Found 4 grassroots partners&rdquo; — brand
        </li>
      </ul>
    </section>
  )
}
```

```tsx
// components/landing/panels/what-we-do-panel.tsx
const STEPS = [
  { n: '01', title: 'Build your profile', copy: 'Stats, story, goals — five minutes, free forever.' },
  { n: '02', title: 'Get discovered', copy: 'Brands search by sport, region and audience.' },
  { n: '03', title: 'Sign and get paid', copy: 'Agree terms and get paid through Podium, protected.' },
]

export default function WhatWeDoPanel() {
  return (
    <section aria-labelledby="wwd-heading" id="what-we-do" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      <h2 id="wwd-heading" className="mb-8 font-heading text-large font-extrabold text-foreground">
        Three steps up
      </h2>
      <ol className="max-w-2xl space-y-4">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            // Fallen-domino slabs: widths step up like the podium on its side.
            className="flex items-center gap-5 rounded-[4px_4px_4px_16px] bg-lime-tint-1 px-6 py-4 last:bg-lime"
            style={{ width: `${70 + i * 15}%` }}
          >
            <span className="font-mono text-small uppercase tracking-[.15em] text-foreground">{s.n}</span>
            <span>
              <span className="block text-medium font-bold text-foreground">{s.title}</span>
              <span className="block text-small font-light text-muted-foreground">{s.copy}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

```tsx
// components/landing/panels/roles-panel.tsx
const ROLES = [
  { name: 'Athletes', copy: 'Free forever. Get discovered and get backed.', height: 'h-72', lime: true },
  { name: 'Teams & clubs', copy: 'Fund the season, from grassroots up.', height: 'h-56', lime: false },
  { name: 'Brands', copy: 'Find the right partners, agree terms, pay safely.', height: 'h-44', lime: false },
]

export default function RolesPanel() {
  return (
    <section aria-labelledby="roles-heading" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      <h2 id="roles-heading" className="mb-8 font-heading text-large font-extrabold text-foreground">
        Who&rsquo;s on the podium
      </h2>
      <div className="flex max-w-3xl items-end gap-4">
        {ROLES.map((r) => (
          <div
            key={r.name}
            className={`flex-1 rounded-xl border border-border bg-card p-5 ${r.height} ${
              r.lime ? 'border-t-4 border-t-lime' : ''
            }`}
          >
            <span className="block font-heading text-medium font-extrabold text-foreground">{r.name}</span>
            <span className="mt-2 block text-small font-light text-muted-foreground">{r.copy}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

```tsx
// components/landing/panels/build-panel.tsx
import Link from 'next/link'
import PodiumMark from '@/components/brand/podium-mark'

const FOOTER_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Cookies', href: '/cookies' },
]

export default function BuildPanel() {
  return (
    <section aria-labelledby="build-heading" className="flex h-full flex-col justify-end px-6 pb-[18vh] pt-24 md:px-16">
      <div className="max-w-2xl rounded-2xl bg-foreground p-10 text-background">
        <PodiumMark height={28} limeTop className="text-background" />
        <h2 id="build-heading" className="mt-5 font-heading text-large font-extrabold">
          Your spot is open.
        </h2>
        <Link
          href="/role-select"
          className="mt-6 inline-block rounded-xl bg-primary px-7 py-3.5 text-medium font-bold text-primary-foreground"
        >
          Build your profile
        </Link>
      </div>
      <nav aria-label="Footer" className="mt-8 flex flex-wrap items-center gap-6">
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-small font-medium text-muted-foreground underline-offset-4 hover:underline">
            {l.label}
          </Link>
        ))}
        <span className="font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
          © 2026 PODIUM
        </span>
      </nav>
    </section>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/landing/panels/panels.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/panels/
git commit -m "feat(landing): five panel components on the baseline"
```

---

### Task 12: Assemble the page, delete the old landing

**Files:**
- Modify: `app/page.tsx`
- Delete: `components/landing/hero.tsx`, `components/landing/how-it-works.tsx`, `components/landing/marketplace-preview.tsx`, `components/landing/role-panels.tsx`, `components/landing/social-proof.tsx`, `components/landing/faq.tsx`, `components/landing/faq.test.tsx`
- Test: `app/page.test.tsx` (create)

**Interfaces:**
- Consumes: everything above. `searchParams` is a Promise in Next 15 — `const { market } = await searchParams`.

- [ ] **Step 1: Check the old components have no other importers**

Run: `npx grep -r "components/landing/\(hero\|how-it-works\|marketplace-preview\|role-panels\|social-proof\|faq\)" --include="*.tsx" --include="*.ts" app components lib` (or use ripgrep). Expected: only `app/page.tsx` matches. If anything else imports them, STOP and report before deleting.

- [ ] **Step 2: Write the failing page test**

```tsx
// app/page.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Home from './page'

vi.stubGlobal('matchMedia', (q: string) => ({
  matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {},
}))

async function renderHome(market?: string) {
  const ui = await Home({ searchParams: Promise.resolve(market ? { market } : {}) })
  render(ui)
}

describe('landing page', () => {
  it('renders all five panels in order', async () => {
    await renderHome()
    const headings = screen.getAllByRole('heading').map((h) => h.textContent)
    expect(headings[0]).toContain('The podium has room for')
    expect(headings[1]).toContain('The marketplace, live')
    expect(headings[2]).toContain('Three steps up')
    expect(headings[3]).toContain('Who’s on the podium')
    expect(headings[4]).toContain('Your spot is open.')
  })

  it('defaults to the skyline market variant', async () => {
    await renderHome()
    expect(screen.getByRole('group', { name: 'Filter profiles' })).toBeInTheDocument()
  })

  it('serves the rally variant on ?market=rally', async () => {
    await renderHome('rally')
    expect(screen.getByText('Vantage Gear')).toBeInTheDocument()
  })

  it('has no FAQ content', async () => {
    await renderHome()
    expect(screen.queryByText(/frequently asked/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL (old page shape).

- [ ] **Step 4: Rewrite `app/page.tsx`**

Keep the existing `metadata` export exactly as-is. Replace the imports and component:

```tsx
import HorizontalTrack from '@/components/landing/horizontal-track'
import HeroPanel from '@/components/landing/panels/hero-panel'
import MarketPanel from '@/components/landing/panels/market-panel'
import WhatWeDoPanel from '@/components/landing/panels/what-we-do-panel'
import RolesPanel from '@/components/landing/panels/roles-panel'
import BuildPanel from '@/components/landing/panels/build-panel'
import { siteUrl } from './sitemap'

// … existing metadata export unchanged …

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>
}) {
  // Two marketplace variants ship to staging; the winner is chosen in
  // implementation review and the loser deleted (spec: page structure).
  const { market } = await searchParams
  const variant = market === 'rally' ? 'rally' : 'skyline'
  return (
    <main>
      <HorizontalTrack>
        <HeroPanel />
        <MarketPanel variant={variant} />
        <WhatWeDoPanel />
        <RolesPanel />
        <BuildPanel />
      </HorizontalTrack>
    </main>
  )
}
```

- [ ] **Step 5: Delete the old components and run everything**

```bash
git rm components/landing/hero.tsx components/landing/how-it-works.tsx components/landing/marketplace-preview.tsx components/landing/role-panels.tsx components/landing/social-proof.tsx components/landing/faq.tsx components/landing/faq.test.tsx
```

Run: `npm run check`
Expected: type-check, lint and all unit tests PASS. Fix any straggler imports the grep in Step 1 missed.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat(landing): assemble horizontal landing page, remove old sections"
```

---

### Task 13: Playwright e2e + staging verification

**Files:**
- Create: `e2e/landing.spec.ts`

**Interfaces:**
- Consumes: the running app (existing `playwright.config.ts` — check its `baseURL`/`webServer` before writing; follow whatever the other specs in `e2e/` do to boot the app).

- [ ] **Step 1: Write the spec**

Mirror the structure of an existing spec in `e2e/` for setup. Content:

```ts
// e2e/landing.spec.ts
import { test, expect } from '@playwright/test'

test.describe('landing page', () => {
  test('desktop: five panels, horizontal track, baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('landing-track')).toBeVisible()
    await expect(page.getByTestId('baseline')).toBeAttached()
    // Scroll to the end: the last panel's CTA becomes visible.
    await page.mouse.wheel(0, 10000)
    await expect(page.getByRole('link', { name: 'Build your profile' })).toBeVisible()
  })

  test('mobile: vertical stack, all content reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('landing-stack')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Get on the podium' })).toBeVisible()
  })

  test('reduced motion: vertical stack on desktop', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('landing-stack')).toBeVisible()
  })

  test('market variants switch on the query param', async ({ page }) => {
    await page.goto('/?market=rally')
    await expect(page.getByText('Vantage Gear')).toBeVisible()
    await page.goto('/?market=skyline')
    await expect(page.getByRole('group', { name: 'Filter profiles' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npm run e2e:chromium -- e2e/landing.spec.ts`
Expected: PASS. If the wheel-scroll assertion is flaky, replace `page.mouse.wheel(0, 10000)` with `page.keyboard.press('End')` and re-run.

- [ ] **Step 3: Full gate**

Run: `npm run check && npm run e2e:chromium`
Expected: everything green.

- [ ] **Step 4: Commit and push to staging**

```bash
git add e2e/landing.spec.ts
git commit -m "test(landing): e2e coverage for track, fallbacks and market variants"
git push origin staging
```

- [ ] **Step 5: Human verification (report, do not deploy)**

Report to Nicholas: staging preview URL (`podium-git-staging-podium6.vercel.app`), reminder to compare `/?market=skyline` vs `/?market=rally` and pick the winner, and to check the domino scroll feel on a real trackpad. Do NOT touch production.

---

## Self-Review (completed)

- **Spec coverage:** tokens→T1, fonts→T2, mark/rounding→T3, fixtures→T4, hook→T5, rally game→T6+T9, scroll/baseline/snap/domino→T7+T10, skyline→T8, five panels + no-FAQ + footer→T11, assembly + `?market` + old-section removal→T12, e2e + staging check→T13. Dark-mode counterparts (required by contrast.test.ts) → T1.
- **Placeholder scan:** none — every step has runnable code or an exact command.
- **Type consistency:** `RallyState`/`tickerLine` (T6) match usage in T9; `trackX`/`snapTarget`/`dominoAngle` (T7) match T10; `BAR_RATIOS` (T3) consumed in T10's `domino-steps`; `MarketProfile` fields used in T8/T9 match T4. Panel export names in T11 match T12 imports.
