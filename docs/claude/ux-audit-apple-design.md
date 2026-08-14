# Podium Frontend — UX Audit through the Apple-Design Lens

_Read-only audit. Proposals only; no source was changed. Author: Claude (apple-design skill posture)._
_Scope: shared primitives (`components/ui/*`, `components/layout/*`) and representative pages across every route group. The art-directed landing (`app/page.tsx`, `components/landing/*`) is the quality reference and is deliberately excluded._

---

## Executive summary

The recent aesthetic sweep gave Podium a coherent _visual_ system: disciplined three-size type scale, semantic tokens, soft layered shadows, lime-dot editorial headings, consistent focus rings, and genuinely thorough `prefers-reduced-motion` gating. Visually it is already good, and much of the craft should be left alone.

The gap is **motion behaviour, not motion presence.** One structural fact drives most of this audit: outside the landing, `motion/react` (Framer Motion) is imported **nowhere**. Every product-surface animation is a fixed-duration CSS `transition` or `@keyframes`. That choice quietly forecloses the single most important principle in the skill — **interruptibility** (§3): a CSS transition cannot be grabbed and reversed from its current on-screen value, cannot inherit a gesture's velocity, and cannot project momentum. The result is an interface that looks refined but feels "scripted" the moment you touch something that moves.

The flagship casualty is the **swipe-card discovery flow** — Podium's most tactile, most gesture-native surface — which today is a position-thresholded CSS `translateX` with no velocity, no fling, no rubber-banding, and no exit animation. That is finding #1.

The highest-leverage moves, in order:

1. **Rebuild `SwipeCard` on a Framer drag + spring** — velocity-aware fling, momentum projection, rubber-banded edges, real off-screen exit. (`components/ui/swipe-card.tsx`)
2. **Make the bottom `Sheet` a drag-to-dismiss drawer** with velocity handoff and momentum projection — the canonical Apple drawer. (`components/ui/sheet.tsx`)
3. **Shared-element active indicator in the nav** (magic-move pill/underline via `layoutId`) instead of a static tinted background. (`components/layout/nav-shell.tsx`, `components/ui/tabs.tsx`)
4. **Tighten press response** — press feedback is currently a 200ms `transition-all` on a `scale(0.99)`; make it instant (~100ms) and to `0.97`. (`components/ui/button.tsx`, `.pressable` in `globals.css`)
5. **Size-specific typographic tracking** — one `letter-spacing: -0.01em` is applied to all headings; large display wants tighter, mono micro-labels want positive. (`app/globals.css`)
6. **Materialize overlays and add a scroll-edge mask** — surfaces are fully opaque with a 2px overlay blur and a hard 1px header border; adopt translucency + a fade mask where floating chrome meets scrolling content. (`sheet.tsx`, `dialog.tsx`, `nav-shell.tsx`)
7. **Message-bubble spring-in + staggered list reveals** — new bubbles pop in with no motion; grids mount cold. (`components/messaging/chat-window.tsx`, discovery grids)
8. **Honour `prefers-reduced-transparency` and `prefers-contrast`**, not just reduced-motion. (`app/globals.css`)

A one-time dependency note: items 1–3 and 7 assume `motion/react` (already in the tree for the landing). Introduce **one** tiny shared spring-preset module (`lib/motion/springs.ts`) so values stay consistent and defensible, per Craft (§16.7).

---

## Proposed shared spring vocabulary (prerequisite for High items)

Create `lib/motion/springs.ts` — the single source of truth, mapping Apple's damping/response onto Framer's `bounce`/`duration` (skill §4):

```ts
// Framer 'spring' with bounce+duration maps closely to Apple damping+response.
export const SPRING = {
  // Critically damped default — no overshoot. Menus, repositions, settles.
  default:  { type: 'spring', bounce: 0,    duration: 0.4 },
  // Snappier settle for small UI (toggles, tab indicator).
  snappy:   { type: 'spring', bounce: 0,    duration: 0.28 },
  // Momentum interactions only — a flick/throw preceded it. Card fling, drawer.
  momentum: { type: 'spring', bounce: 0.18, duration: 0.4 },
} as const
```

Rule of thumb from the skill: **`bounce: 0` everywhere by default; reserve overshoot for motion a gesture's momentum actually caused** (§4). Every recipe below references these.

---

## HIGH impact

### H1 — `SwipeCard` is a scripted CSS translate, not a fluid gesture

**Problem.** This is Podium's most physical surface and it violates the most principles. In `components/ui/swipe-card.tsx`:

- Drag position is tracked (`handlePointerMove`, L93–96) but **velocity is not** — the skill's §2 velocity/position history is absent, so there is no data to hand off at release (§5) or to project a landing point (§6).
- Commit is decided purely on **position threshold** (`SWIPE_THRESHOLD = 96`, L33, L101–102). A fast short flick that clearly means "yes" is discarded; the skill says decide with the **velocity sign / projected endpoint**, not the release position (§6, Quick Reference).
- There is **no exit animation.** On commit, `setDrag(0)` snaps the card back to centre (L76–79) and the parent removes it from the queue (`athletes-browser.tsx` L64–68). The card never flies off in the direction of the swipe — the gesture has no visible consequence, breaking "hint in the direction of the gesture" (§8) and spatial consequence.
- Return-to-centre uses a **fixed CSS `transition-transform duration-200`** (L141), so a drag cannot be caught and reversed mid-return (§3).
- **No rubber-banding** at the edges (§9); the card follows the finger 1:1 to infinity.
- The peeked "next" card (`SwipeDeck`, L253–261) is a static `scale-95 opacity-60` ghost — it never rises to meet the outgoing card, another missed §8 telegraph.

**Recipe.** Rebuild the interactive card on Framer's `drag` with a motion value, keeping the existing button/keyboard paths (which are correctly the primary accessible path — leave that architecture intact):

```tsx
const x = useMotionValue(0)
const rotate = useTransform(x, [-200, 200], [-12, 12])
const likeOpacity = useTransform(x, [40, 120], [0, 1])
const passOpacity = useTransform(x, [-120, -40], [1, 0])

<motion.article
  style={{ x, rotate }}
  drag="x"
  dragElastic={0.5}                      // rubber-band past the edges (§9)
  dragMomentum={false}
  onDragEnd={(_, info) => {
    // Project the landing point from release velocity (§6), decel ≈ 0.998.
    const projected = x.get() + info.velocity.x * 0.0665
    if (projected > 120)  fling('right', info.velocity.x)
    else if (projected < -120) fling('left', info.velocity.x)
    else animate(x, 0, SPRING.default)   // settle home, interruptible
  }}
/>

// fling: throw the card off-screen at the finger's velocity (§5 handoff)
function fling(dir, velocity) {
  animate(x, dir === 'right' ? 400 : -400, {
    ...SPRING.momentum, velocity,        // continue at release velocity — no seam
    onComplete: () => onSwipe(dir),      // commit only after it leaves
  })
}
```

- `x` is a `MotionValue`, so the drag is **interruptible**: catch a flying card and drag it back and it follows the finger with no jump (§3), because animation reads the presentation value.
- `rotate`/badge opacity are **derived** from `x` via `useTransform` — feedback is continuous during the drag, not just at the end (§1).
- The `0.0665` factor is Apple's projection form `(v/1000)·d/(1−d)` with `d = 0.998` (§6).
- Add a **10px movement threshold** before the card commits to horizontal tracking so vertical scroll still wins (§10); `touch-pan-y` (already present, L139) plus `drag="x"` handles this.
- Optional, high-value: a **`navigator.vibrate?.(10)`** on the commit frame — meaningful, causal haptic on the snap (§13), reserved for the commit only.
- **Peek card:** drive its `scale`/`opacity` from `useTransform(x, [0, 200], [0.95, 1])` so it grows toward the outgoing card as the top one leaves (§8).

**Reduced motion.** Keep the buttons/keyboard as-is; when `prefers-reduced-motion`, skip the fling and cross-fade the outgoing card out (`opacity 200ms`) rather than throwing it (§14). Framer respects this via `useReducedMotion()`.

**Why it elevates.** This is the one surface where users literally push pixels with a finger. Velocity handoff and projection are "the detail that most separates fluid from fine" (§5). Done right, the deck feels like a real stack of cards you throw — the emotional core of a discovery/matchmaking product.

---

### H2 — Bottom `Sheet` should be a drag-to-dismiss drawer

**Problem.** `components/ui/sheet.tsx` is a Base-UI dialog with CSS enter/exit only: the bottom variant translates `2.5rem` + fades (L56). A bottom sheet on mobile is the textbook Apple drawer (§4 table: drawer = damping 0.8, response 0.3) and users _expect_ to drag it down to dismiss. Today it can only be closed by the X button or backdrop tap — no direct manipulation, no momentum, no rubber-band at the top bound.

**Recipe.** For the `data-[side=bottom]` case, wrap the popup in a Framer drag layer (or adopt Vaul, which implements exactly this — skill §6 explicitly cites it):

- `drag="y"`, `dragConstraints={{ top: 0 }}`, `dragElastic={0.5}` so pulling _up_ past the top rubber-bands (§9) and pulling down tracks 1:1.
- On release: project with velocity (§6); if projected past ~40% of sheet height **or** downward velocity > 500px/s, animate off-screen with `SPRING.momentum` + `velocity` handoff, then call `onOpenChange(false)`. Otherwise spring home with `SPRING.default`.
- Dim the backdrop **proportionally to drag position** (`useTransform(y, [0, height], [1, 0])`) so the scrim tracks the gesture continuously (§1, §12 "dim to focus").
- Add a **grab handle** (a 36×4px rounded bar, top-centre) — the familiar affordance (§16.4) that says "draggable".
- **Enter as a material, not a slide:** animate `y` _and_ a small blur/scale together so it reads as arriving glass (§12 "materialize, don't just fade").

**Reduced motion.** Keep drag-to-dismiss (it is direct, not vestibular) but replace the off-screen throw with an opacity cross-fade (§14).

**Why.** Direct manipulation of the drawer is the difference between "a web modal" and "a native sheet." It also improves one-handed reachability on mobile (Flexibility, §16.5).

---

### H3 — Nav active-state has no spatial continuity (no magic-move indicator)

**Problem.** In `components/layout/nav-shell.tsx` the active primary-nav item gets a static `bg-primary/10` pill (L65–68), the mobile bottom-nav item just recolours (L131–136), and in `components/ui/tabs.tsx` the line-variant underline is an `::after` that **fades** opacity between tabs (L64) rather than sliding. Moving between sections produces a hard cut, not the continuous "the indicator travels with you" motion that anchors where you are (§7 spatial consistency, §16.4 familiarity).

**Recipe.** A shared-layout indicator with Framer's `layoutId`:

```tsx
{active && (
  <motion.span
    layoutId="nav-active"          // one id per nav group
    className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
    transition={SPRING.snappy}      // bounce:0, duration:0.28
  />
)}
```

Because every active item renders the _same_ `layoutId`, Framer animates the pill's position/size between them — it physically slides from the old tab to the new one. Apply identically to: primary nav (L58–73), mobile bottom nav (L123–142, animate a top border-accent or dot), and the Tabs underline (`tabs.tsx` L64 — replace the opacity `::after` with a `layoutId="tab-underline"` span).

**Reduced motion.** `layout` animations must be disabled under reduced motion — wrap in `<MotionConfig reducedMotion="user">` (Framer then cross-fades the indicator instead of sliding). Verify the pill still _appears_ on the active item, just without travel (§14).

**Why.** The travelling indicator answers "where am I?" continuously (§16 wayfinding) and is one of the most recognizably-Apple touches (tab bars, segmented controls). Low cost, high perceived polish.

---

## MEDIUM impact

### M1 — Press feedback is too slow and too subtle (Response, §1)

**Problem.** `components/ui/button.tsx` L12 puts `active:scale-[0.99]` inside a blanket `transition-all duration-200`. The skill is explicit: feedback must be **instant on pointer-down** (§1), and the sample value is `scale(0.97)` on a ~100ms ease-out. At 200ms and 0.99 the press is barely perceptible and lags the finger. Same issue in `.pressable` (`globals.css` L378–384): `scale(0.99)` over `0.12s` is closer but still shallow.

**Recipe.**
- Split the transition so the press is its own fast channel: keep hover lift at 200ms, but drive `active` on a **100ms ease-out** and deepen to `scale(0.97)`.

```css
.button:active { transform: scale(0.97); transition: transform 100ms ease-out; }
```
- In Tailwind terms, avoid `transition-all duration-200` swallowing the press: give the button `active:duration-100` (Tailwind supports variant-scoped duration) or move the press to `.pressable`-style dedicated rule.
- Keep `motion-reduce` suppression (already present, L12) — a scale is mild, but honour the preference.

**Why.** "The moment lag appears, directness falls off a cliff" (§1). Press is the most-repeated interaction in the whole app; making it instant is felt everywhere.

---

### M2 — Typographic tracking is size-invariant

**Problem.** `app/globals.css` L344–349 applies one `letter-spacing: -0.01em` to _all_ headings h1–h6, and the display token (`--text-display`, clamp up to 3rem, L96) inherits it. The skill (§15) is direct: **tracking is size-specific — a fixed value is wrong somewhere.** Large display text needs _more_ negative tracking; the Geist-Mono micro-labels (used for SectionDividers) want _positive_ tracking for legibility at small sizes.

**Recipe.** A tracking scale keyed to size:

```css
.text-display { letter-spacing: -0.025em; line-height: 1.05; }   /* big: tighter + tight leading */
h1, h2        { letter-spacing: -0.018em; }
h3, h4, h5, h6{ letter-spacing: -0.01em; }                        /* current value is right here */
.font-mono    { letter-spacing: 0.04em; }                         /* micro-labels: positive */
:root, body   { letter-spacing: 0; }                              /* body near zero (§15) */
```

Also add `font-optical-sizing: auto` globally (DM Sans is a variable font; costs nothing, lets the face optically adjust). Leading already tracks size well (headings `1.18`, body `1.55`) — that part is good.

**Why.** Craft (§16.7): "every spacing and timing value is a deliberate choice you can defend." A single letter-spacing across a 3rem→0.8rem range is demonstrably wrong at the extremes; fixing it sharpens display titles and rescues the mono labels.

---

### M3 — Overlays are opaque; chrome meets content with a hard border (Materials, §12)

**Problem.** The skill's material model is translucent floating layers with content scrolling under, plus scroll-edge fades instead of dividers. Podium currently:
- `nav-shell.tsx` L45: sticky header is `bg-background/95 backdrop-blur` — nearly opaque, and separated by a **hard `border-b`** rather than a scroll-edge mask.
- `dialog.tsx` L34 / `sheet.tsx` L31: backdrop is `bg-black/10` + `backdrop-blur-xs` (2px — barely a material), and the surface itself is fully opaque `bg-popover`.
- `dialog.tsx` L56 / `sheet.tsx` L56: enter is a plain `zoom-in-95` / translate — no blur-in, so glass "pops" rather than "materializes."

**Recipe.**
- **Scroll-edge mask** on the sticky header: replace the always-on `border-b` with a gradient/blur fade that only appears once content scrolls under it (§12 "scroll edge effects, not hard dividers"). A `mask-image` or a small `::after` gradient toggled on scroll position.
- **Deepen the modal scrim** to `bg-black/25` and keep the `backdrop-blur` — a modal is a focus task and should push the background back (§12 "dim to focus").
- **Materialize:** on dialog/sheet enter, animate `backdrop-filter: blur(0→20px)` together with the scale/translate so the surface reads as arriving glass (§12). Framer or a keyframe that animates blur + transform in lockstep.
- Consider the header at `/80` rather than `/95` so it reads as a material with content faintly visible beneath (only if legibility holds in both themes — verify with the vibrancy rule, §12).

**Reduced transparency.** Gate all of the above behind `@media (prefers-reduced-transparency: reduce)` → solid surface, no blur (§14, and see M6).

**Why.** Translucency is "a floating functional layer that brings structure without stealing focus" (§12). It is the most recognizably-Apple material cue and currently essentially unused in-product.

---

### M4 — New content appears with no motion (chat + lists)

**Problem.**
- `components/messaging/chat-window.tsx`: incoming messages are appended (L86–90) and just _appear_ — no enter animation. A new bubble should spring in from its sender's side (§8 hint direction, §7 anchored origin).
- Discovery grids (`athletes-browser.tsx` grid branch, and the marketplace-card grids) mount with no staggered reveal — a wall of cards blinks in at once.
- The typing indicator (`chat-window.tsx` L41–56) uses `animate-bounce`, a generic Tailwind loop, not tuned to the conversation's calm.

**Recipe.**
- **Message bubble:** wrap `MessageBubble` in `motion.div` with `initial={{ opacity: 0, y: 8, scale: 0.96 }}` → `animate` on `SPRING.default`, and set `transformOrigin` to the sender's corner (right for mine, left for theirs) so it grows from where it belongs (§7). Only animate the _newly added_ message, not the whole list on every render — key on message id and use `AnimatePresence`.
- **Grid reveal:** a Framer `staggerChildren: 0.04` on first mount (cap the total so a 30-card grid doesn't take a second), each card `opacity 0→1, y 8→0` on `SPRING.default`. Disable stagger on subsequent "load more" appends — only the new page animates.
- **Typing dots:** replace `animate-bounce` with a subtler opacity/scale pulse; keep the `0.15s` per-dot delay (that stagger is good).

**Reduced motion.** All of the above collapse to opacity-only cross-fades (§14) — Framer's `useReducedMotion` handles it; keep the existing `motion-reduce:animate-none` on the dots (already present, L50).

**Why.** Motion that telegraphs _origin_ (which side a message came from, cards arriving in reading order) aids comprehension, not just delight (§8). Restraint matters here — keep durations short and never animate on re-render, only on genuine entry, so dashboards stay fast (§16.6).

---

### M5 — Return-to-rest and transitions can't be interrupted (systemic)

**Problem.** Beyond the swipe card, the pattern repeats: `page-transition.tsx` uses class-swap CSS transitions (fine for non-gesture page enters — leave it), but any surface a user can _touch mid-motion_ (sheets, the swipe card, future draggables) uses CSS `transition`, which the skill flags as unable to be grabbed and reversed (§3). The `tabs.tsx` indicator and `nav` active state (H3) are the visible symptoms.

**Recipe.** No new work beyond H1–H3 + M4 — those convert every _touchable_ moving element to a MotionValue/spring. The guidance for the team: **CSS transitions are fine for enter/exit of things the user cannot grab** (page transitions, tooltips, static fades); **springs for anything draggable or reversible.** Encode this as a one-line comment in `lib/motion/springs.ts` so it stays a defensible rule.

**Why.** Interruptibility is "the single most important principle" (§3). Drawing the CSS-vs-spring line explicitly prevents the next feature from re-introducing scripted motion.

---

### M6 — Only `prefers-reduced-motion` is honoured; transparency and contrast are not

**Problem.** `globals.css` has thorough `prefers-reduced-motion` blocks (L314, L372, L393) — genuinely well done. But the skill (§14) names **three** independent signals, and `prefers-reduced-transparency` and `prefers-contrast` appear nowhere. Once M3 introduces real translucency, reduced-transparency becomes a correctness requirement, not a nicety.

**Recipe.**
```css
@media (prefers-reduced-transparency: reduce) {
  .backdrop-blur, [data-slot="sheet-content"], [data-slot="dialog-content"],
  header.sticky { backdrop-filter: none; background: var(--card); }
}
@media (prefers-contrast: more) {
  [data-slot="dialog-content"], [data-slot="sheet-content"] {
    border-color: var(--foreground);
  }
  /* near-solid surfaces + defined contrasting borders */
}
```

**Why.** Responsibility/Flexibility (§16.3, §16.5): translucency that stays translucent for a user who asked for solid surfaces is an accessibility regression. Ship these _with_ M3.

---

## LOW impact

### L1 — Swipe-deck peek is a dead ghost
Covered mechanically in H1, but even short of the full rebuild: drive the peek card's `scale`/`opacity` off drag distance so it responds. Cheap, adds depth (§8).

### L2 — Toast/`sonner` uses library defaults
`components/ui/sonner.tsx` — verify enter/exit are spring-like and the swipe-to-dismiss is enabled; align its motion to `SPRING.default`. Minor.

### L3 — Card hover-lift is uniform regardless of surface size
`.liftable` (`globals.css` L385) lifts everything `-2px` with the same shadow. The skill notes bigger surfaces should read as thicker (§12) — a large card could lift slightly more with a deeper shadow than a small chip. Very minor; only worth it if you touch these anyway.

### L4 — Micro-copy on empty/success states is already strong
Not a fix — a note that `EmptyState` copy ("Say hello. The first message is the hard one.") is exactly the specific, human voice the skill's Delight principle wants (§16.8). Keep this bar.

---

## Already good — do not touch

- **`prefers-reduced-motion` discipline.** Every utility, keyframe, and component gates on it (`globals.css` L314/L372/L393; `page-transition.tsx`; `swipe-card.tsx` L141; typing dots L50). This is the hard part and it is done well. Extend the _pattern_ to the other two media queries (M6); don't rework what exists.
- **Popover/dropdown/select spatial anchoring.** `dropdown-menu.tsx` L44, `select.tsx` L86 already set `origin-(--transform-origin)`, so menus scale from their trigger — exactly the §7 anchored-origin rule. Correct; leave it.
- **Focus-visible rings** are consistent and offset against the surface everywhere (`input.tsx` L16, `swipe-card.tsx` L140, buttons). Craft-level a11y; keep.
- **Three-size type scale + semantic tokens.** The constraint is the point; M2 tunes tracking _within_ it, it does not add sizes.
- **The button hover-lift language** (soft lift + shadow, `motion-safe` gated) is the right restrained default (§16.6). M1 only sharpens the _press_, not the hover.
- **The landing** — out of scope and correctly the quality reference.
- **Message layout robustness** (`min-w-0`, `[overflow-wrap:anywhere]`, CLS-safe intrinsic image sizing in `message-bubble.tsx`) — careful craft; motion in M4 sits on top without disturbing it.

---

## Sequencing note

Land the prerequisite (`lib/motion/springs.ts`) first, then H1 (swipe card) as the proof-of-value showcase, then H2/H3. M1 and M2 are quick, independent wins that can ship anytime. M3 must ship together with M6. Keep every recipe behind the reduced-motion/transparency/contrast gates already established — motion and depth here serve clarity and consequence, never decoration.
