# UX Audit — Animations & Motion (Podium frontend)

- **Author**: `improve-animations` skill (senior motion advisor pass)
- **Commit**: `f187e19`
- **Date**: 2026-08-14
- **Scope**: READ-ONLY audit + self-contained implementation plans. No source was modified.
- **Rule catalog**: `.claude/skills/improve-animations/AUDIT.md` (values below are copied from it verbatim, never approximated).

---

## Recon — the motion surface

**Stack**: Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, Base UI (`@base-ui/react`, *not* Radix), tw-animate-css, sonner (toasts), next-themes. `@react-three/fiber` + bespoke scroll motion on the marketing landing only.

**Framer Motion / `motion` is NOT actually used in app code.** Every `motion`/`framer-motion` hit is in `.claude/skills/*` or `docs/` — `package-lock.json` has it transitively but no component imports `motion/react`. Podium's real motion system is **CSS-class based**:
- `lib/motion/transitions.ts` + `components/layout/page-transition.tsx` — route-group enter transitions (a hand-rolled from→to class toggle, no library).
- `app/globals.css` — keyframes (`chip-in/out`, `hint-arrow`, `hint-rule`, `slot-pulse`) and motion utilities (`.pressable`, `.liftable`, `.scroll-hint-*`).
- Base UI primitives styled with tw-animate-css data-state utilities (`data-open:animate-in`, `zoom-in-95`, `slide-in-from-top-2`, `data-starting-style`/`data-ending-style`).
- `components/ui/button.tsx` — hover-lift / active-scale.
- Bespoke, art-directed landing motion in `components/landing/stage/*` (out of scope except craft bugs).

**Conventions today**:
- **No custom easing tokens exist.** There are no `--ease-*` CSS variables. Every transition uses Tailwind's *built-in* `ease-out` / `ease-in-out` (weak curves) or bare `ease`. The one strong curve defined anywhere — `MOTION.easing = 'cubic-bezier(0.16, 1, 0.3, 1)'` in `transitions.ts:26` — is **dead code**, never referenced.
- Duration scale is ad hoc: `duration-100` (dropdowns/dialog), `duration-150` (sheet overlay), `duration-200` (page transitions, button, stat-strip, swipe snap-back), `duration-500` (blur-image), `duration-[180ms]` (overlay variant).
- `prefers-reduced-motion` handling is **generally excellent** — `motion-reduce:` utilities and a `useReducedMotion()` hook are used widely and thoughtfully (skeletons, sheet, dialog, chat typing dots, stat-strip, button, `.liftable`/`.pressable`, chip flip, scroll hints all degrade correctly).

**Personality**: crisp product app (electric-blue + lime, DM Sans, soft-Airbnb card system from the recent aesthetic sweep). Motion should stay *quick and understated* in the app; the delight budget lives on the marketing funnel.

**Frequency map** (drives severity):
- **Very high**: `Button` (every screen), page transitions (every navigation), `Switch`/`Tabs` (settings, dashboards), dropdown/select menus.
- **Occasional**: `Dialog`, `Sheet`, `Accordion`, toasts, swipe deck.
- **Rare**: onboarding wizards, role select, empty states.

**What's already right — do not touch**:
- Reduced-motion coverage across the app (see above). This is a strong baseline; every plan below preserves it.
- Dropdown/Select/Dialog use `zoom-in-95` (0.95, never `scale(0)`) and `origin-(--transform-origin)` — popovers correctly scale **from their trigger**, not center.
- `Select` disables its open animation when `alignItemWithTrigger` (the default) — correct, because the selected item is positioned over the trigger and animating would look wrong (`select.tsx:86` `data-[align-trigger=true]:animate-none`).
- `Sheet` uses real CSS **transitions** with `data-starting-style`/`data-ending-style` (interruptible), not keyframes — correct for a draggable-feeling drawer.
- `PageTransition` has a robust rAF + 150ms fallback so a background-tab page can never get stuck invisible (`page-transition.tsx:81-102`). Keep this.
- `stat-strip.tsx:43` is a model hover tile: `transition-[transform,box-shadow] duration-200 ease-out` + `motion-reduce:` reset. Use it as the exemplar.
- Chat typing indicator: staggered `animate-bounce` with `motion-reduce:animate-none` (`chat-window.tsx:47-53`) — correct.

---

## Vetted findings (ordered by leverage)

| # | Severity | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Easing / Cohesion & tokens | `app/globals.css` `@theme` + every `ease-out`/`ease-in-out` consumer | No custom easing tokens; all UI motion rides Tailwind's weak built-in curves. The one strong curve (`MOTION.easing`) is dead. AUDIT: "Built-in CSS easings are too weak for deliberate motion." | Define `--ease-out`/`--ease-in-out`/`--ease-drawer` tokens; override Tailwind's `--ease-*` so every existing `ease-out` utility instantly upgrades. One edit, whole-app payoff. |
| 2 | MEDIUM | Performance | `switch.tsx:19`, `tabs.tsx:61`, `progress.tsx:48`, `button.tsx:12`, `accordion.tsx:40`, `role-select-form.tsx:94`, `transitions.ts:70`, `profile-wizard.tsx:818`, `brand-profile-form.tsx:584`, `settings-form.tsx:606` | `transition-all` in 10 spots. Animates every changing property off-GPU and can animate unintended ones. AUDIT: "`transition: all` … always a finding." | Replace each with an explicit property list (`transition-colors`, `transition-[transform,box-shadow]`, `transition-[width]`, etc.). |
| 3 | MEDIUM | Performance / Tokens | `lib/motion/transitions.ts:70`, `page-transition.tsx` | Page-transition base = `transition-all ease-out … will-change-transform`. Fires on *every* navigation. `transition-all` (see #2), `will-change-transform` is left on **permanently** (compositor/memory cost with no animation running), and the defined `MOTION.easing` token is ignored in favour of weak `ease-out`. | Scope the transition to `opacity`+`transform`, drop `will-change` to only while animating, and route easing through the new `--ease-out` token. |
| 4 | MEDIUM | Easing / Physicality | `sheet.tsx:56` | Drawer slides with `transition duration-200 ease-in-out`. The enter half of `ease-in-out` starts slow (an `ease-in` entrance — an AUDIT red flag), and bare `ease-in-out` is a weak curve for a drawer. | Switch to the iOS drawer curve `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` and bump to `duration-300`. |
| 5 | MEDIUM | Accessibility | `accordion.tsx:53-73` | The panel expand/collapse (`data-open:animate-accordion-down` / `data-closed:animate-accordion-up`, which animate `height`) has **no `prefers-reduced-motion` fallback**. Movement plays for users who opted out. | Gate the height animation behind `motion-reduce:animate-none` so the panel snaps for reduced-motion users. |
| 6 | LOW | Duration | `dropdown-menu.tsx:44,138`, `select.tsx:86`, `dialog.tsx:34,56` | Open/close runs at `duration-100`. AUDIT budget: dropdowns 150–250ms, modals 200–500ms. 100ms is under the floor — reads as an abrupt pop rather than a settle. | Bump to `duration-150` (menus/select) and `duration-200` (dialog). |
| 7 | LOW | Accessibility | `button.tsx:12`, `stat-strip.tsx:44`, `globals.css:388` `.liftable` | Hover lift/scale is gated on `motion-reduce` but not on pointer type. On touch, a tap fires `:hover` and the lift **sticks** until the next tap elsewhere. AUDIT: gate hover motion behind `@media (hover: hover) and (pointer: fine)`. | Add a `(hover:hover)` guard to the lift utilities (low priority — cosmetic on touch). |

### Missed opportunities (additive, not corrective)

- **New chat messages teleport in** (`chat-window.tsx:194-229`). Incoming `MessageBubble`s append with no enter motion; in a realtime thread a message just pops. A 150ms `fade-in + slide-in-from-bottom-1` on the newest bubble (reduced-motion → fade only) would make arrivals feel alive. Plan 8 below.
- **Swipe cards have no fly-off** (`swipe-card.tsx:75-107,141`). A committed swipe sets `dragX=0` instantly and swaps content — the card that was flung snaps back to center as new data appears, and the snap-back on a *below-threshold* release is a fixed 200ms CSS tween (AUDIT: gesture-driven motion should carry velocity via a spring). A short translate-off-screen exit on commit would complete the gesture. Noted; lower priority (needs JS, component owns no queue state by design).
- **Dialog/Sheet close is symmetric with open.** Fine as-is, but a slightly faster close (150ms) than open (200–300ms) would read as more responsive. Optional, folded into Plans 4/6.

---

## Plans

> Executor note: these plans assume the codebase at commit `f187e19`. Base UI (`@base-ui/react`) is the primitive library — **not** Radix. Tailwind is **v4** (tokens live in `@theme` / `:root` inside `app/globals.css`; there is no `tailwind.config.js` theme block). If a code excerpt below does not match what you find, STOP and report drift instead of improvising.

---

### 001 — Introduce strong easing tokens and route UI motion through them

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: HIGH
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 1 file (`app/globals.css`); optionally 2 one-line follow-ups. Small.

#### Problem

The app has **no custom easing tokens**. Every transition uses Tailwind's built-in `ease-out` (`cubic-bezier(0, 0, 0.2, 1)`) or `ease-in-out` (`cubic-bezier(0.4, 0, 0.2, 1)`) — both too weak for deliberate UI motion (AUDIT §2). The single strong curve defined in the repo is never used:

```ts
// lib/motion/transitions.ts:26 — defined but dead
easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
```

Consumers that would instantly benefit (they already type `ease-out`): `button.tsx:12`, `stat-strip.tsx:43`, `blur-image.tsx:49`, `transitions.ts:70`, plus the dropdown/select/dialog zoom-ins (tw-animate-css uses the `--ease-out` theme var for `animate-in`).

#### Target

Tailwind v4 resolves the `ease-out` / `ease-in-out` utilities from theme variables `--ease-out` / `--ease-in-out`. Override them (and add a drawer curve) inside the existing `@theme inline { … }` block in `app/globals.css`, using the exact AUDIT values:

```css
/* app/globals.css — inside @theme inline { … }, alongside the other --* tokens */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);        /* strong ease-out for UI enters/exits */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);    /* strong ease-in-out for on-screen movement */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);     /* iOS-like drawer curve (used by Plan 004) */
```

After this, every `ease-out` / `ease-in-out` Tailwind utility already in the tree upgrades with no per-file edits. `--ease-drawer` is a *new* token (Tailwind exposes it as the `ease-drawer` utility) consumed by Plan 004.

#### Repo conventions to follow

- All design tokens live in `app/globals.css` — `@theme inline { … }` (the Tailwind-facing layer, lines 10–87) and `:root` / `.dark` (raw values). Easing has no runtime theme variance, so define it **once** in `@theme inline`. Do not add a `tailwind.config.js` — this project is Tailwind v4, config-in-CSS.
- Exemplar of the target feel already in the tree: `stat-strip.tsx:43` (`transition-[transform,box-shadow] duration-200 ease-out`).

#### Steps

1. In `app/globals.css`, inside the `@theme inline { … }` block (before its closing `}` at line 87), add the three `--ease-*` declarations from **Target** above.
2. (Optional, recommended) Delete the now-redundant dead token: in `lib/motion/transitions.ts:26`, either remove the `easing:` line or leave a comment that easing is now token-driven. Do NOT remove it if anything imports `MOTION.easing` — grep first: `grep -rn "MOTION.easing\|\.easing" --include=*.ts --include=*.tsx`. (Current result: no consumers.)
3. Do not change any `ease-in-out` used as a **literal CSS keyword** in an `animation:` shorthand — `globals.css:309,312` (`hint-*`) and `panel-finale.tsx:134` (`slot-pulse`) use the raw keyword, not the utility, and must stay as-is.

#### Boundaries

- Do NOT touch `components/landing/stage/*` files. (Overriding the global token will refine two landing hover transitions that use the `ease-out` utility — `panel-what.tsx:154`, `panel-market.tsx:190` — this is acceptable and is covered by the feel-check, but do not edit those files.)
- Do NOT change durations in this plan (that's Plan 006).
- Do NOT add new dependencies or a Tailwind config file.

#### Verification

- **Mechanical**: `npm run type-check` clean; `npm run lint` clean; `npm run build` succeeds. `grep -n "ease-out\|ease-in-out\|ease-drawer" app/globals.css` shows the three new tokens in `@theme inline`.
- **Feel check**: run the app (`npm run dev`).
  - Hover a `Button` and a StatStrip tile: the lift should feel like it *snaps out then eases to rest* (strong ease-out), not a linear glide.
  - Open a dropdown/select: the zoom-from-trigger should decelerate crisply.
  - In DevTools Animations panel at 10% speed, confirm the curve is front-loaded (fast start, long settle).
  - Toggle `prefers-reduced-motion` (Rendering panel): motion still drops to opacity where it did before — this plan changes curves only, not reduced-motion behaviour.
  - **Landing regression check**: scroll the marketing landing, hover the "what" and "market" panels; the ~2vh hover lift should still feel right (crisper is fine, broken is not). If it reads worse, report — do not hand-tune the landing.
- **Done when**: the three tokens exist in `@theme inline`, build is green, and app hover/menu motion visibly decelerates rather than gliding.

---

### 002 — Replace `transition-all` with explicit property lists

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: ~8 files, one class-string edit each. Small.

#### Problem

`transition-all` animates every property that changes — off the GPU, and sometimes properties you never meant to animate (a ring appearing, a border width). AUDIT §5: "`transition: all` … always a finding." Current occurrences (excluding `transitions.ts`, handled by Plan 003):

```
components/ui/switch.tsx:19        — "… transition-all outline-none …"   (Root: only bg-color changes; thumb has its own transition-transform)
components/ui/tabs.tsx:61          — "… transition-all …"                (Tab: color/bg/shadow on activate)
components/ui/progress.tsx:48      — "h-full bg-primary transition-all"  (Indicator: only width changes)
components/ui/button.tsx:12        — "… shadow-sm transition-all duration-200 …" (transform + shadow + bg-color)
components/ui/accordion.tsx:40     — "… transition-all outline-none …"   (Trigger: color/underline)
components/auth/role-select-form.tsx:94 — "… p-5 text-left transition-all" (border/bg/ring on select)
components/athlete/profile-wizard.tsx:818     — "h-full bg-foreground transition-all"   (progress fill: width)
components/brand/brand-profile-form.tsx:584   — "h-full bg-foreground transition-all"   (progress fill: width)
components/athlete/settings-form.tsx:606      — "h-full rounded-full bg-primary transition-all" (progress fill: width)
```

#### Target

Swap each `transition-all` for the exact properties that animate:

| File:line | Replace `transition-all` with |
| --- | --- |
| `switch.tsx:19` | `transition-colors` (bg only; thumb keeps its own `transition-transform` at line 26) |
| `tabs.tsx:61` | `transition-[color,background-color,box-shadow]` |
| `progress.tsx:48` | `transition-[width]` |
| `button.tsx:12` | `transition-[transform,box-shadow,background-color,color]` |
| `accordion.tsx:40` | `transition-colors` |
| `role-select-form.tsx:94` | `transition-[color,background-color,border-color,box-shadow]` |
| `profile-wizard.tsx:818` | `transition-[width]` |
| `brand-profile-form.tsx:584` | `transition-[width]` |
| `settings-form.tsx:606` | `transition-[width]` |

Keep every other class token in the string unchanged, including existing `duration-*`, `ease-*`, and `motion-reduce:` utilities.

Example (button):

```tsx
/* components/ui/button.tsx:12 — before */
"… shadow-sm transition-all duration-200 outline-none …"
/* after */
"… shadow-sm transition-[transform,box-shadow,background-color,color] duration-200 outline-none …"
```

Note on progress bars: `width` still triggers layout, but Base UI's Progress and the wizard fills set width directly and there is no transform-based equivalent without markup changes — scoping the transition to `width` (instead of `all`) is the in-scope win here. Do NOT rewrite them to transforms in this plan.

#### Repo conventions to follow

- Tailwind v4 arbitrary-property transitions use bracket syntax with **no spaces**: `transition-[color,background-color,box-shadow]`. Comma-separated, no spaces inside brackets.
- Exemplar already correct in the tree: `stat-strip.tsx:43` (`transition-[transform,box-shadow]`) and `sheet.tsx:31` (`transition-opacity`).

#### Steps

1. For each row in the **Target** table, open the file at the line and replace the single token `transition-all` with the specified replacement. One token swap per file. Do not reorder or remove neighbouring classes.
2. `components/ui/tabs.test.tsx:35` asserts `expect(trigger!.className).toContain("transition-all")`. Update that assertion to the new value: `toContain("transition-[color,background-color,box-shadow]")`. (This is the only test coupled to these strings — grep confirms: `grep -rn "transition-all" --include=*.test.tsx`.)

#### Boundaries

- Do NOT touch `lib/motion/transitions.ts` (Plan 003 owns it).
- Do NOT touch `components/landing/stage/*`.
- Motion properties only — do not change markup, durations, or easing.
- Do NOT add dependencies.

#### Verification

- **Mechanical**: `npm run type-check` clean; `npm run lint` clean; `npm run test` green (the `tabs.test.tsx` assertion must be updated in Step 2 or it fails). `grep -rn "transition-all" components/ app/ lib/` returns **no** matches in app source afterwards.
- **Feel check**: toggle a `Switch`, switch `Tabs`, hover a `Button`, advance a profile-wizard step (watch the progress fill), select a role card. Every one should transition exactly as before — this is a no-visible-change performance fix. In DevTools Performance, recording a `Switch` toggle should show the change on the compositor, not a layout/paint storm.
- **Done when**: no `transition-all` remains in `components/`, `app/`, or `lib/`, and all interactions look identical to before.

---

### 003 — Fix the page-transition base (transition-all, permanent will-change, dead easing token)

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: MEDIUM
- **Category**: Performance / Tokens
- **Estimated scope**: 1 file (`lib/motion/transitions.ts`), 1 line. Small. Depends on Plan 001 for the `--ease-out` token (works without it too — Tailwind `ease-out` will simply be the built-in curve until 001 lands).

#### Problem

The class applied to **every** route-group navigation wrapper (`PageTransition`, consumed by each route group's `template.tsx`) is:

```ts
// lib/motion/transitions.ts:70 — current
const base = `transition-all ease-out ${DURATION_CLASS[variant]} will-change-transform`
```

Three issues on a string that runs on every navigation:
1. `transition-all` — animates whatever else changes on the page container during the from→to swap (AUDIT §5). Only `opacity` and `transform` actually animate here.
2. `will-change-transform` is applied **permanently** to the wrapper — `will-change` is a promote-to-layer hint meant to be transient; leaving it on holds a compositor layer (and memory) for the life of every page, for an animation that lasts 180–200ms.
3. The defined strong curve `MOTION.easing` (`cubic-bezier(0.16, 1, 0.3, 1)`, line 26) is ignored; the class uses Tailwind's weak built-in `ease-out`.

#### Target

```ts
// lib/motion/transitions.ts:70 — target
const base = `transition-[opacity,transform] ease-out ${DURATION_CLASS[variant]}`
```

- `transition-[opacity,transform]` — only the two properties that animate (both GPU-friendly).
- Drop `will-change-transform` from the resting class. A page wrapper does not need a standing compositor promotion; the 180–200ms opacity/transform transition composites fine without it. (If a specific low-end device shows flicker, the correct fix is a transient `will-change` toggled off on `transitionend` — out of scope here; do not re-add the permanent hint.)
- `ease-out` now resolves to the strong `--ease-out` token once Plan 001 lands (this is why 001 should ship first, but 003 is safe to ship independently).

Leave the reduced-motion branch (lines 72–73) and `ENTER_FROM` / `DURATION_CLASS` maps unchanged.

#### Repo conventions to follow

- This file is the single source of truth for page-transition motion (`transitions.ts` header comment). Keep the class-based, no-library approach.
- Exemplar of scoped transitions elsewhere: `stat-strip.tsx:43`.

#### Steps

1. Edit `lib/motion/transitions.ts:70` to the **Target** string exactly: replace `transition-all` → `transition-[opacity,transform]` and delete the trailing ` will-change-transform`.
2. Optionally remove the dead `easing` field at line 26 (see Plan 001 Step 2). If unsure, leave it; it is harmless once documented.
3. Check `page-transition.tsx` still compiles — it consumes `transitionClasses()` output and appends `opacity-100 translate-y-0 scale-100`; those resting utilities are unaffected.

#### Boundaries

- Do NOT change `page-transition.tsx`'s rAF/fallback logic (lines 81–102) — that back-tab safety net is deliberate and correct.
- Do NOT change durations or the variant maps.
- Do NOT re-introduce a permanent `will-change`.

#### Verification

- **Mechanical**: `npm run type-check` clean; `npm run lint` clean; `npm run test` green (check for tests referencing `transition-all` / `will-change` in `lib/motion/` — grep: `grep -rn "will-change\|transition-all" lib/`). `npm run build` succeeds.
- **Feel check**: navigate between top-level routes and into a detail page. The cross-fade / 8px-up should look identical to before. In DevTools → Layers, confirm the transition wrapper no longer holds a standing composited layer at rest (no permanent `will-change`). At 10% animation speed, confirm only opacity + transform move.
- **Done when**: `transitions.ts:70` reads `transition-[opacity,transform] ease-out …`, no `will-change` remains in the file, and navigation motion is visually unchanged.

---

### 004 — Give the drawer (Sheet) a real drawer curve

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: MEDIUM
- **Category**: Easing & duration / Physicality
- **Estimated scope**: 1 file (`components/ui/sheet.tsx`), 1 class-string edit. Small. **Depends on Plan 001** (needs the `--ease-drawer` token / `ease-drawer` utility).

#### Problem

The Sheet content slides with a weak, wrong-shaped curve:

```tsx
// components/ui/sheet.tsx:56 — current (excerpt)
"fixed z-50 flex flex-col gap-4 bg-popover … shadow-card transition duration-200 ease-in-out motion-reduce:transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 …"
```

`ease-in-out` on an entering drawer means the slide-in **starts slow** — an `ease-in` entrance, which AUDIT §2 calls out as always a finding ("starts slow, delaying the exact moment the user is watching"). Bare `ease-in-out` is also a weak built-in curve for a surface this large. 200ms is on the short side for a drawer (budget 200–500ms).

#### Target

```tsx
// components/ui/sheet.tsx:56 — target (only these tokens change)
"… shadow-card transition duration-300 ease-drawer motion-reduce:transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 …"
```

- `ease-drawer` → `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` (defined by Plan 001). This is the iOS-style curve: responsive start, smooth settle, ideal for edge-anchored panels.
- `duration-200` → `duration-300` (comfortably inside the 200–500ms drawer budget; the extra travel time reads as weight without feeling slow).
- Keep `transition` (Tailwind's curated property set — it already covers `transform` + `opacity`; the sheet animates the per-side `translate-*` offsets and opacity). Keep every `data-starting-style` / `data-ending-style` / `motion-reduce:` token unchanged.
- Leave `sheet.tsx:31` (the overlay, `transition-opacity duration-150`) as-is — a fast backdrop fade is correct.

#### Repo conventions to follow

- Base UI drawers animate via `data-starting-style` / `data-ending-style` (real CSS transitions, interruptible) — already the pattern here. Do not convert to keyframes.
- Token added in Plan 001; exemplar drawer-curve value copied verbatim from AUDIT §2.

#### Steps

1. Confirm Plan 001 has landed (`grep -n "ease-drawer" app/globals.css` returns the token). If not, do Plan 001 first.
2. In `components/ui/sheet.tsx:56`, change `duration-200` → `duration-300` and `ease-in-out` → `ease-drawer`. Change nothing else in the string.

#### Boundaries

- Do NOT touch the overlay (line 31) or the per-side translate offsets.
- Do NOT change `motion-reduce:` handling.
- Do NOT add dependencies.

#### Verification

- **Mechanical**: `npm run type-check` / `lint` / `build` clean.
- **Feel check**: open a Sheet from each side (`right` default; also test `bottom`). The panel should slide in with a **fast, confident start** that eases to rest — not the current slow-in/slow-out. At 10% speed, confirm the first third of travel covers more distance than the last third (front-loaded = correct). Spam open/close: because these are CSS transitions with starting/ending styles, an interrupted open should retarget smoothly, not restart. Toggle reduced motion: the panel should fade (opacity-only) with no slide.
- **Done when**: Sheet enters on the `ease-drawer` curve at 300ms, close still feels snappy, and reduced-motion is fade-only.

---

### 005 — Give the Accordion a reduced-motion fallback

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`components/ui/accordion.tsx`), 1 class edit. Small.

#### Problem

The Accordion panel animates its `height` on expand/collapse via tw-animate-css keyframes, with **no** `prefers-reduced-motion` guard:

```tsx
// components/ui/accordion.tsx:61 — current
className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
```

`animate-accordion-down` / `-up` animate the panel height (movement). Users who set `prefers-reduced-motion: reduce` still get the full expand/collapse slide. AUDIT §6: movement with no reduced-motion handling is a finding. (Every other animated primitive in this repo — sheet, dialog, skeletons, chip flip — already degrades; the accordion is the gap.)

#### Target

```tsx
// components/ui/accordion.tsx:61 — target
className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up motion-reduce:animate-none"
```

`motion-reduce:animate-none` makes the panel snap open/closed (no height slide) for reduced-motion users while preserving the animation for everyone else. The `overflow-hidden` + `h-(--accordion-panel-height)` / `data-*-style:h-0` on the inner div (lines 64-68) still produce a correct final layout with the animation disabled.

#### Repo conventions to follow

- Reduced-motion in this repo is expressed with Tailwind `motion-reduce:` utilities appended to the same class string. Exemplars: `card-skeleton.tsx:25` (`[&_[data-slot=skeleton]]:motion-reduce:animate-none`), `chat-window.tsx:50` (`animate-bounce … motion-reduce:animate-none`), `dialog.tsx:56` (`motion-reduce:data-open:zoom-in-100`).

#### Steps

1. In `components/ui/accordion.tsx:61`, append `motion-reduce:animate-none` to the `AccordionPrimitive.Panel` className (after `data-closed:animate-accordion-up`).

#### Boundaries

- Do NOT change the inner `<div>` height mechanics (lines 64-68) — they must stay so the panel resolves to the correct open/closed height with animation off.
- Do NOT alter the trigger (line 40) here — its `transition-all` is handled by Plan 002.

#### Verification

- **Mechanical**: `npm run type-check` / `lint` / `build` clean; existing accordion tests (if any — grep `grep -rln accordion **/*.test.tsx`) still green.
- **Feel check**: open/close an accordion normally → smooth height slide as before. Then enable `prefers-reduced-motion` (DevTools Rendering) and open/close → the panel should **snap** open and closed with no sliding height, and content must be fully visible when open (no clipped 0-height). 
- **Done when**: reduced-motion users get an instant expand/collapse; default users are unchanged.

---

### 006 — Nudge popover/dialog durations up to the AUDIT floor

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: LOW
- **Category**: Easing & duration
- **Estimated scope**: 4 files, one `duration-*` token each. Small. Pairs naturally with Plan 001.

#### Problem

Menus, selects, and the dialog open/close at `duration-100`:

```
components/ui/dropdown-menu.tsx:44   — "… shadow-md ring-1 … duration-100 …"
components/ui/dropdown-menu.tsx:138  — "… shadow-lg ring-1 … duration-100 …" (sub-content)
components/ui/select.tsx:86          — "… shadow-md ring-1 … duration-100 …"
components/ui/dialog.tsx:34          — overlay "… bg-black/10 duration-100 …"
components/ui/dialog.tsx:56          — content "… shadow-card duration-100 …"
```

AUDIT §2 budgets: dropdowns/selects 150–250ms, modals 200–500ms. 100ms is **under** the floor — the zoom-from-trigger reads as an abrupt pop instead of a settle. (This is the mild end of the scale; hence LOW.)

#### Target

| File:line | `duration-100` → |
| --- | --- |
| `dropdown-menu.tsx:44` | `duration-150` |
| `dropdown-menu.tsx:138` | `duration-150` |
| `select.tsx:86` | `duration-150` |
| `dialog.tsx:34` (overlay) | `duration-200` |
| `dialog.tsx:56` (content) | `duration-200` |

Everything else in each string (the `data-open:animate-in … zoom-in-95`, origin, reduced-motion tokens) stays. Combined with Plan 001's `--ease-out`, the slightly longer settle on the stronger curve is where the "expensive, considered" feel comes from.

#### Repo conventions to follow

- These are tw-animate-css / Base UI popups; `duration-*` sets the animation duration for the `animate-in`/`animate-out` keyframes. Just swap the numeric token.

#### Steps

1. For each row in the table, replace the single `duration-100` token with the specified value. One swap per location (dropdown-menu.tsx has two).

#### Boundaries

- Do NOT change `sheet.tsx` (Plan 004) or `select.tsx`'s `data-[align-trigger=true]:animate-none` (that no-animation default is correct).
- Do NOT touch `zoom-in-95` / origin / reduced-motion tokens.

#### Verification

- **Mechanical**: `npm run type-check` / `lint` / `build` clean.
- **Feel check**: open a dropdown, a select (in a non-align-trigger context, e.g. a multiselect where `alignItemWithTrigger=false`), and a dialog. Each should settle rather than blink into place — noticeably calmer than 100ms but still fast. Confirm close still feels responsive (if it reads sluggish, the close is fine at these values; do not exceed them).
- **Done when**: menus animate at 150ms, dialog at 200ms, and nothing feels laggy.

---

### 007 — (Optional, LOW) Gate hover-lift behind pointer capability

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: LOW
- **Category**: Accessibility
- **Estimated scope**: 3 spots. Small. Do last / skip if time-boxed.

#### Problem

Hover lift/scale is gated on `motion-reduce` but not on pointer type, so on touch a tap fires `:hover` and the lift **sticks** until the user taps elsewhere:

```
components/ui/button.tsx:12    — "motion-safe:hover:-translate-y-0.5 …"
components/layout/stat-strip.tsx:44 — "hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99]"
app/globals.css:388            — .liftable:hover { transform: translateY(-2px); … }
```

AUDIT §6: gate hover motion behind `@media (hover: hover) and (pointer: fine)` because "touch fires false hovers on tap."

#### Target

- **`.liftable`** (`globals.css`): wrap the `:hover` rule in the media query.

```css
/* app/globals.css — target for .liftable hover */
@media (hover: hover) and (pointer: fine) {
  .liftable:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover);
  }
}
```

- **Button / StatStrip** (Tailwind): Tailwind v4 has no built-in `(hover:hover)` variant on arbitrary utilities, but the `hover:` variant in v4 is **already** compiled under `@media (hover: hover)` by default (Tailwind v4 changed `hover:` to only apply on hover-capable devices). **Verify this first**: `grep -n "hover" node_modules/tailwindcss/preflight.css` won't show it; instead build and inspect the generated CSS for a `.hover\:...:hover` rule wrapped in `@media (hover:hover)`. If Tailwind v4's default hover-media behaviour is active (it is, unless `@custom-variant hover` overrides it — this repo only overrides `dark`, see `globals.css:8`), then **button.tsx and stat-strip.tsx need no change** and only `.liftable` must be wrapped.

#### Repo conventions to follow

- `globals.css` already scopes motion utilities under `@media (prefers-reduced-motion: reduce)` (lines 393-401). Add the `(hover:hover)` block near the `.liftable` definition (lines 385-392).

#### Steps

1. Confirm Tailwind v4's default hover-media behaviour is active (no `@custom-variant hover` in `globals.css` — only `dark` is overridden at line 8). If confirmed, Tailwind `hover:` utilities on Button/StatStrip are already touch-safe; leave them.
2. Wrap the `.liftable:hover` rule (`globals.css:388-392`) in `@media (hover: hover) and (pointer: fine) { … }`. Keep the existing `@media (prefers-reduced-motion: reduce)` block (lines 393-401) as-is.

#### Boundaries

- Do NOT remove the reduced-motion block.
- Do NOT touch `.pressable:active` (press feedback should fire on touch — that's correct).
- If Step 1 shows a `@custom-variant hover` override exists (it should not), STOP and report — the Button/StatStrip fix would then be non-trivial.

#### Verification

- **Mechanical**: `npm run build` clean.
- **Feel check**: in DevTools device toolbar (touch emulation), tap a `.liftable` card and a Button — the lift should NOT stick after the tap. On a real desktop with a mouse, hover lift still works.
- **Done when**: no sticky hover lift on touch; desktop hover unchanged.

---

### 008 — (Optional, missed opportunity) Animate incoming chat messages

- **Status**: TODO
- **Commit**: `f187e19`
- **Severity**: LOW (additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1–2 files (`components/messaging/chat-window.tsx` and/or `message-bubble.tsx`). Small.

#### Problem

In the realtime thread, new `MessageBubble`s are appended with no enter motion (`chat-window.tsx:194-229`) — a message just pops into place. A brief entrance would make arrivals feel alive and confirm "something new happened," without adding noise (messages are occasional, not 100×/day per AUDIT §1).

#### Target

Apply a one-shot enter to each message row: fade + a small upward slide, reduced-motion → fade only. Use tw-animate-css utilities already in the project (same family as the dropdowns), on the wrapping `div`/`MessageBubble`:

```tsx
// concept — on the message row wrapper
className={cn(
  "flex",
  msg.sender_id === currentUserId ? "justify-end" : "justify-start",
  "animate-in fade-in-0 slide-in-from-bottom-1 duration-150 ease-out motion-reduce:slide-in-from-bottom-0",
)}
```

- `slide-in-from-bottom-1` = 0.25rem of travel (subtle — a nudge, not a fly-in).
- `duration-150 ease-out` (ease-out resolves to the strong `--ease-out` token after Plan 001).
- `motion-reduce:slide-in-from-bottom-0` drops the translate for reduced-motion; the fade remains.

**Caveat / feel-check required**: `animate-in` keyframes replay whenever the element mounts. Because `chat-window.tsx` keys rows by `msg.id`, only genuinely-new rows mount and animate — existing rows do not replay on re-render. **Verify this holds** (see feel-check) before shipping; if the whole list re-animates on every keystroke/typing update, gate the animation to only the last message index instead.

#### Repo conventions to follow

- tw-animate-css `animate-in fade-in-0 slide-in-from-*` is the established enter pattern (dropdown/select/dialog). Reuse it rather than adding Framer Motion (the app has no `motion/react` usage — do not introduce it).
- Reduced-motion via `motion-reduce:` utility (exemplars in Plan 005).

#### Steps

1. In `chat-window.tsx`, add the enter classes to the message row wrapper(s) — both the proposal-card branch (`:202`) and the `MessageBubble` branch (`:221`, wrap or pass a className). Keep `key={msg.id}`.
2. Do NOT animate the `TypingIndicator` container (it already has its own bounce) or the empty state.

#### Boundaries

- Do NOT add Framer Motion or any dependency.
- Do NOT change the realtime/subscription logic.
- Do NOT animate on every render — only on mount of a new message (verify).

#### Verification

- **Mechanical**: `npm run type-check` / `lint` / `test` clean.
- **Feel check**: open a conversation, send a message and receive one (or simulate an INSERT). Only the **new** bubble should rise+fade in; older bubbles must stay still. Type in the composer — the typing signal must NOT cause the whole thread to re-animate (if it does, gate to last index). Toggle reduced motion: bubbles fade with no slide. Confirm auto-scroll (`scrollIntoView`) still pins to the newest message.
- **Done when**: new messages animate in subtly, existing messages never replay, reduced-motion is fade-only.

---

## Recommended execution order

| Order | Plan | Severity | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | 001 — Easing tokens | HIGH | — | TODO |
| 2 | 002 — Kill `transition-all` | MEDIUM | — (independent of 001) | TODO |
| 3 | 003 — Page-transition base | MEDIUM | 001 (soft) | TODO |
| 4 | 004 — Sheet drawer curve | MEDIUM | **001 (hard — needs `--ease-drawer`)** | TODO |
| 5 | 005 — Accordion reduced-motion | MEDIUM | — | TODO |
| 6 | 006 — Popover/dialog durations | LOW | 001 (pairs with) | TODO |
| 7 | 007 — Hover pointer-gate | LOW | — | TODO |
| 8 | 008 — Chat message enter | LOW | 001 (soft) | TODO |

**Ship 001 first** — it is the highest-leverage single edit (whole-app easing upgrade) and unblocks 004. 002 and 005 are independent and safe to parallelize. 006–008 are polish; ship after the core four feel right.

**Global boundaries for all plans**: never edit `components/landing/stage/*` (art-directed, locked 2026-08-05) except where a plan explicitly notes an *indirect* token effect to feel-check. Preserve every existing `motion-reduce:` / `prefers-reduced-motion` behaviour — this repo's reduced-motion coverage is a strength; do not regress it. No new dependencies (the app deliberately has no `motion/react` usage; keep it CSS-class based).
</content>
</invoke>
