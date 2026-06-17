# Emotional Design + Subtle Neo-Brutalist Re-skin — Design

**Date:** 2026-06-17
**Builds on:** the completed v1 build (branch `feat/v1-improvements`)
**Status:** Approved aesthetic — ready for implementation planning

---

## 1. Purpose

Give Podium more character and make it "feel more full" — subtly — by layering a **subtle neo-brutalist
aesthetic** and **emotional design** over the existing clean v1 UI. The current UI reads barren: flat
surfaces *and* empty voids. We fix both, without adding new product features.

## 2. Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Intensity | **B — subtle neo-brutal** (crisp ink borders, small hard *offset* shadows, chunkier headings, flat accent blocks). Keep the clean Airbnb *structure*; add edge/weight, not noise. |
| Emotional ingredients | **All four:** characterful empty states · micro-interactions · personality microcopy · decorative accents/texture |
| Voice | **Energetic & sporty** (punchy, momentum-building) |
| Root cause to fix | **Both** flat surfaces and empty voids |
| Icons | **Lucide** (`lucide-react`, already installed; free/MIT; rounded) — no hand-drawn SVGs, no new dependency |
| Heading font | **Bricolage Grotesque** (replaces Syne — friendly, contemporary, readable); body stays **DM Sans** |

**Why the font change:** Syne (the v1 heading face) was reported as "too squashed / hard to read." Root
causes: it's a tight display face, it was used on buttons/labels/numbers (not just headings), and tracking
was negative. Fix = Bricolage Grotesque for display headings only, DM Sans for everything else, looser
line-height.

## 3. Strategy — re-skin the centre, not the leaves

The v1 build runs on semantic **tokens** and ~12 shared **primitives**. Re-skinning those changes the
whole platform's feel at once. Leaf screens (the ~50 role pages) are **not** edited except where a bespoke
element or microcopy string is dropped in. This keeps the change small, consistent, and low-risk.

**This intentionally overrides specific v1 visual rules.** Documented so it's deliberate, not drift:
- Spec §2.4 "soft box shadow / remove all unnecessary borders" → **superseded**: key surfaces now carry a
  1.5px ink border and a hard *offset* shadow.
- Spec §2.2 "Syne for headings" → **superseded**: Bricolage Grotesque for headings.
- **Kept unchanged:** the 4/8/16/32/64 spacing scale, generous whitespace/margins, the card-grid layout,
  the two-typeface / three-size discipline, WCAG AA contrast, `prefers-reduced-motion`, light-mode-only,
  placeholder palette (no final colours yet).

## 4. Design tokens (`app/globals.css`, `app/layout.tsx`)

```css
:root{
  /* Borders — introduce an "ink" border for key surfaces */
  --border-ink: oklch(0.20 0 0);        /* near-black, = foreground */
  --border-ink-width: 1.5px;
  --border: oklch(0.88 0 0);            /* keep a soft grey for minor dividers */

  /* Radius — slightly crisper than v1 (was 0.75rem) */
  --radius: 0.625rem;                   /* 10px */

  /* Shadows — hard offset, not soft blur (the signature move) */
  --shadow-card:       3px 3px 0 oklch(0.20 0 0 / 0.92);
  --shadow-card-hover: 6px 6px 0 oklch(0.20 0 0 / 0.92);
  --shadow-press:      2px 2px 0 oklch(0.20 0 0);   /* buttons at rest */
  --shadow-focus:      3px 3px 0 var(--primary);    /* focused inputs */

  /* Accent stays the placeholder warm; used as flat blocks behind badges/headings */
  --accent: oklch(0.80 0.13 85);        /* slightly punchier amber for blocks */
}
```

**Font wiring (`app/layout.tsx`):** replace the `Syne` import with `Bricolage_Grotesque` bound to
`--font-heading` (variable name kept so nothing else changes); `DM_Sans` stays on `--font-sans`. In
`globals.css` set headings to `--font-heading` with `line-height: 1.18` and `letter-spacing: -0.01em`;
body `line-height: 1.55`. The three-size scale (`--text-large/medium/small`) is unchanged.

**Page texture:** add a faint fractal-noise SVG (`opacity ~0.035`) to the `body` page background so the
warm off-white surface has grain — separates card surfaces from the page and kills the "blank canvas" feel.

## 5. Icons (Lucide)

- Use `lucide-react` everywhere; **remove all emoji** from UI strings and any placeholder glyphs.
- Add `components/ui/icon.tsx` — a thin wrapper re-exporting Lucide with project defaults
  (`size: 20`, `strokeWidth: 2`, `absoluteStrokeWidth` off) so weight is consistent and brutalist-friendly.
- Add `lib/copy/icon-map.ts` mapping semantic concepts → Lucide icons (e.g. `target`→`Target`,
  `availability`→`Circle`, `verified`→`BadgeCheck`, `team`→`Shield`, `partners`→`Users`,
  `proposal`→`Send`, `payments`→`Wallet`) so empty states / stat tiles / badges pull from one source.

## 6. Primitive re-skins (the ~12 files that do the work)

Each keeps its existing public API; only visuals/interactions change.

- **`button.tsx`** — ink border + `--shadow-press`; on `:active` translate `(2px,2px)` and collapse shadow
  to 0 (physical press). Heading font for label. Reduced-motion: no translate.
- **`card.tsx` + `marketplace-card.tsx`** — ink border, `--shadow-card`; hover lifts `translate(-2px,-2px)`
  to `--shadow-card-hover` (150ms). Reduced-motion: shadow change only, no translate.
- **`badge.tsx` + `status-badges.tsx`** — flat colour blocks with ink border; availability green/amber/red
  (always paired with a Lucide icon, never colour-alone), verified blue `BadgeCheck`, level = accent block,
  seeking = low-opacity primary.
- **`input.tsx`, `textarea.tsx`, `select.tsx`, `combobox.tsx`** — ink border; focus throws
  `--shadow-focus` + primary border (replaces soft ring). Visible labels retained.
- **`card-select.tsx`** — selected tile = accent-tint fill + primary ink border + `--shadow-press`.
- **`empty-state.tsx`** — see §7.
- **`card-skeleton.tsx`** — match the new bordered card silhouette (ink border, no shadow while loading).
- **`sonner.tsx` (toast)** — bordered block, 6px left accent bar coloured by status, hard shadow, Lucide
  status icon.
- **`tabs.tsx`, `dialog.tsx`, `sheet.tsx`** — ink borders + hard shadow on the surface; modal/sheet keep the
  v1 scale/slide transitions.

## 7. Bespoke elements (new small components)

- **`empty-state.tsx`** (re-skin) — circular accent disc + Lucide icon + energetic headline + body + CTA.
  This is the single biggest "less barren" win; it already exists and is wired into grids/lists from the
  v1 `GL4` sweep, so re-skinning it propagates everywhere.
- **`components/ui/sticker.tsx`** — rotated pill label (accent fill, ink border, hard shadow) for
  "Most popular", "7-day free trial", "Featured".
- **`components/ui/section-divider.tsx`** — ink rule with a solid label chip (e.g. "Your shortlist").
- **`components/ui/accent-heading.tsx`** — heading with a highlighter-style accent swipe behind it, to
  energise and fill section titles.
- **Featured corner** — a folded-corner tab via a `featured` prop on `marketplace-card.tsx` (no new file).
- **`stat-strip.tsx`** (re-skin) — bordered stat tiles with hard shadow + a Lucide icon per metric.

## 8. Micro-interactions

Button press, card hover-lift, input focus-shadow (all above), plus smooth toggle/checkbox transitions.
A shared `.pressable` / `.liftable` utility in `globals.css`. **All movement gated by
`prefers-reduced-motion: reduce` → opacity/shadow only, no translate** (extends the v1 A9 motion rule).

## 9. Microcopy (energetic & sporty)

- **`lib/copy/index.ts`** — namespaced string constants (empty states, success/error toasts, validation,
  key CTAs, onboarding prompts) so voice is centralised and reviewable.
- **`docs/brand/voice.md`** — one-page voice guide (punchy, momentum, second-person, sports-aware; never
  cheesy; never sacrifices clarity).
- Sample mappings: `Profile published` → "You're on the radar — profile is live!"; `No results found` →
  "Nothing here yet — widen your filters and dig in"; `Add a profile photo to continue` → "Add a photo so
  brands can put a face to the talent"; `Submit proposal` → "Send proposal · make your move".
- Validation messages stay field-specific and human (v1 §9.3) — energised, not vague.

## 10. Accessibility

- Accent/ink blocks must meet WCAG AA (ink text on amber passes; verify primary-on-white for CTAs).
- Status never by colour alone — always a Lucide icon or text label.
- Focus states remain clearly visible (the focus hard-shadow is additive, not a replacement for outline on
  keyboard nav).
- Honour `prefers-reduced-motion` for every interaction in §8.

## 11. Out of scope

- No new product features or data; no layout restructuring beyond dropping bespoke elements / empty states
  into existing slots.
- No final colour palette (still placeholder) and no dark mode.
- Leaf role screens are not redesigned — they inherit the re-skin via tokens/primitives.

## 12. Acceptance criteria

1. Heading font is Bricolage Grotesque; DM Sans body at line-height 1.55; no display font on
   buttons/labels/numbers; no "squashed" headings.
2. No emoji anywhere in the UI; all icons are Lucide via the `Icon` wrapper.
3. Key surfaces (buttons, cards, inputs, badges, toasts, tabs, dialogs) show ink borders + hard offset
   shadows; buttons press, cards lift; all motion respects reduced-motion.
4. Every empty state is characterful (icon + energetic line + CTA); microcopy pulls from `lib/copy`.
5. Bespoke elements (sticker, section divider, accent heading, featured corner, stat tiles) exist and are
   used in at least their primary slots (subscription "Most popular", dashboards, section headers).
6. Page carries the subtle grain texture; `npm run check` stays green; WCAG AA contrast holds.
