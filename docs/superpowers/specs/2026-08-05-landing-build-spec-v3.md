# PODIUM LANDING REBUILD · FINAL BUILD SPEC v3 (SYNTHESIS)

**Synthesis summary, what was taken from where and why:**
1. **Spine: Direction 2 (motion).** Its physics-continuous architecture wins: velocity-matched shove, critically damped scroll spring, fallen pieces that persist as real objects the camera travels past (no crossfade handoff to smear), the chip detaching and falling as a fourth domino, and the dashed YOU slot finale. It deletes the historical failure modes structurally instead of patching them.
2. **From Direction 1 (editorial):** the 176px stepped three-line headline (the poster move Dir 2's timid 108px cap forfeits), the technical-drawing register (FIG annotation, measuring-tape ticks, word-roll counters), the docked focus card whose container never moves (calmer and more legible than Dir 2's text-inside-a-springing-bar), the strict sub-baseline law, the honest card facts with no counts, and the screenshot-matrix QA gate.
3. **From Direction 3 (spatial):** fov 28 long-lens plus the "passes as a product photograph" acceptance test, corridor parallax layers (0.85x / 1.0x / 1.15x) with the cropped ink column, follow-through rest angles past 90°, forward-only impact garnish (solves reverse-scrub determinism), rally idle autoplay and the OUT stamp, the mobile burger sheet, and contact shadows updated only while pieces move.
4. **Killed as cheap or usability-breaking:** Dir 1's labels on resting bars (re-creates the bar-chart failure), cursor hiding, two-piece shove, and marketplace card colliding with its own headline; Dir 2's expanding-bar focus cards, fabricated "Reach 120k" stats, and anticipation jitter; Dir 3's crossfade handoff, cursor-position panning, odometer gimmick, and blue-filled primary button that muddies the blue-is-interactive rule.
5. **Contradictions resolved:** 72px nav, solid after 40px, never blurred; fixed baseline with moving ticks; load intro is an un-fall (teaches the true mechanic); shove overlaps the final impact with no pre-shove dead band; five returns sign the rally; "ten minutes" everywhere; 900px breakpoint; ink primary with lime wipe hover; DPR cap 1.75; fillet 3%.

---

## 1. CONCEPT

One sentence, "The podium has room for ___", completed by motion. The page is a corridor along one fixed ground line at 72vh. Three injection-moulded lime plastic dominoes tip over under the visitor's scroll, the last impact shoves the corridor sideways, the energy stands the marketplace skyline up, the same pieces reassemble as the podium when the roles arrive, and the journey ends at an empty dashed slot labeled YOU. Nothing fades in arbitrarily: everything is pushed, struck, or settled by something else. Type is the architecture, plastic is the only actor, and the mono annotation layer treats the whole page as a technical drawing.

---

## 2. GLOBAL SYSTEM

### 2.1 Tokens

| Token | Value |
|---|---|
| Page | `#FAFBFB`, light only |
| Ink | `#17181A` · Body grey `#4A4B4E` · Lime `#C1EC2F` · Tints `#DDF0A8`, `#E9F5C4` · Blue `#2742F0` (interactive elements only, never decoration) |
| Hairlines | 1.5px ink structural; 1px ink at 12% inside cards; ticks ink at 25% |
| Grid | 12 cols, margin `5vw`, gutter `2vw`. Col width `5.666vw`. Col N left edge = `5vw + (N-1) * 7.666vw` |
| `--display-xl` | `clamp(64px, 10.5vw, 176px)`, DM Sans 800, lh 0.92, ls -0.035em, ink |
| `--display-l` | `clamp(44px, 5.5vw, 96px)`, 800, lh 0.98, ls -0.02em |
| `--display-m` | `clamp(22px, 1.9vw, 30px)`, 800, lh 1.1, ls -0.01em |
| `--title` | `clamp(18px, 1.4vw, 22px)`, DM Sans 500, lh 1.2 |
| `--body` | `clamp(15px, 1.2vw, 18px)`, DM Sans 300, lh 1.55, grey, max-width 38ch |
| `--ui` | `clamp(14px, 1.05vw, 16px)`, DM Sans 500 |
| `--mono` | Geist Mono 400/500, 10.5px labels / 11px data, uppercase, +0.15em |
| Radii | Buttons and chips 12px. Cards 12px with 28px top-left. Podium bars: `border-top-left-radius: calc(var(--bar-w) * 0.6)`, other corners 12% of bar width |
| Buttons | Primary: ink fill, white DM Sans 500 16px, h 56px, pad 0 28px, r 12px. Nav Join free: h 40px, pad 0 20px, 14px label. Secondary: blue text link + arrow, no box. No shadows, no gradients, ever, on UI |
| Focus-visible | 2px `#2742F0` outline, 3px offset, every interactive element |

Fonts subset and preloaded (DM Sans 300/500/800, Geist Mono 400/500); text renders on first paint.

### 2.2 Baseline and floor zone

Fixed 1.5px ink hairline, top edge at exactly `72vh`, full viewport width, z above panel fills, below nav. It never moves. Every "standing" element has its bottom edge at 72vh exactly.

Tick strip lives ON the track and translates with it: 1px ink 25% ticks, 6px tall every 2vw, 12px every 10vw; at each panel origin (0, 100, 200, 300, 400vw) a 16px ink tick plus mono coordinate `000` to `400`. The fixed line plus moving tape reads as ground the page travels over.

**Sub-baseline law (72vh to 100vh):** wayfinding, ticks, mono floor captions, and the footer only. No body copy, no cards, no interactive UI except footer links. No exceptions.

### 2.3 Nav (fixed, 72px)

Left at 5vw: podium mark 28px lime glyph + "Podium" DM Sans 800 18px ink, gap 12px. Right at 95vw, gaps 32px: Marketplace, How it works, Pricing, Sign in (`--ui` 14px, resting `#4A4B4E`), Join free (ink fill). Background: transparent at scrollY 0; after 40px of scroll, solid `#FAFBFB` + 1px bottom hairline ink 8%. No blur, no translucency. Active section: 4px lime square left of the link, crossfades 150ms on panel change.

### 2.4 Wayfinding (fixed)

Bottom-left 5vw, 12px below baseline, mono: `SCROLL ↓ TO TIP THE FIRST DOMINO` at load; after the cascade completes it swaps to the counter `01 / 05` (digits roll vertically 300ms). Bottom-right during P < 0.225: `SKIP INTRO →` mono blue, focusable; Space triggers the same skip.

### 2.5 Scroll fabric

Body height 1000vh (900vh travel). `P = smoothed(scrollY / 900vh)`, 0 to 1. Smoothing: critically damped spring (stiffness 170, damping 26, mass 1) on scrollY before it drives P; residual velocity settles ~350ms after release. Wheel delta clamped to max 0.008 P per event. Perceived input lag never exceeds ~120ms. Track: `position: fixed; inset: 0; width: 500vw`, `translate3d` in X only, `x = f(P)` per the motion map. Parallax layers during travel: tick strip 0.85x track speed, panel content 1.0x, designated foreground layers 1.15x.

### 2.6 3D stage

One shared transparent `<Canvas>`, fixed full viewport, z between panel background and DOM content. DPR `min(devicePixelRatio, 1.75)`, MSAA 4x, `frameloop: demand` outside active windows. ACESFilmic tone mapping, exposure 1.0, sRGB out.

- **Camera:** PerspectiveCamera fov 28 (long lens, product photography). World floor y = 0 projects to screen y = 72vh, calibrated on resize, tolerance ±2px, verified with a `?debugGround` overlay. 1 world unit = 10vh. `cameraX` couples 1:1 to track x, so 3D objects are left behind and picked up exactly like DOM panels.
- **Light rig (never varies):** key RectAreaLight 4x4 units at (-6, 7, 6), intensity 3.2, white; directional fill from (5, 3, 4), 0.6; prefiltered neutral studio HDRI 256px PMREM, `envMapIntensity 0.9`; no visible background.
- **Ground:** drei ContactShadows at y = 0, opacity 0.24, blur 2.4, scale 20, resolution 512. Updated only while a piece is moving. This is 3D scene vocabulary, not a UI shadow.
- **Material `limePlastic`:** MeshPhysicalMaterial `#C1EC2F`, roughness 0.32, metalness 0, clearcoat 1.0, clearcoatRoughness 0.12, ior 1.45, specularIntensity 0.9. No textures. Every piece has a real edge fillet, radius 3% of piece width, so the clearcoat draws a highlight line. Numerals engraved as geometry.
- The hero trio persists in world space for the whole journey. Panel 4's podium and panel 5's bar are instanced clones of the same geometry and material (narratively the same pieces; two are never on screen simultaneously except mid-travel, where both are legitimate world objects).

---

## 3. PANELS

### PANEL 01 · HERO (track 0 to 100vw)

- **Kicker:** C1, y 12vh, mono, preceded by a 20x3px lime tick: `PODIUM · SPORTS SPONSORSHIP MARKETPLACE · PRE-LAUNCH`.
- **Headline:** C1 to C8, top 17vh, `--display-xl`, three stepped lines: `The podium` (C1) / `has room` (indented +1 column, 7.666vw) / `for [chip].` (C1). The stepped rag silhouettes a podium. Minimum 24px clearance above the CTA row, QA-checked.
- **Word chip (inline, line 3):** lime fill, ink text at headline size, height 1.02em, pad 0 0.18em, radius top-left 0.6em capped 28px, others 0.12em. Words: `athletes` / `teams` / `brands` / `you`. Mono superscript counter `01/04` 12px right of chip, rolls in sync. Never interactive, never blue.
- **CTA row:** C1, button bottom edges exactly ON the baseline. Primary `Get on the podium` → `/role-select`. 24px right: secondary blue `See how it works ▸` (fast-travels to panel 3). Support line, `--body`: `Free for athletes and clubs. Brands pay when they sponsor.` At ≥1440px it sits 24px right of the secondary; below 1440px it moves 16px above the CTA row at C1.
- **Dominoes (3D, feet on baseline):** D1 center 54vw, w 6vw, h 20vh · D2 center 67vw, w 6.5vw, h 29vh · D3 center 81.5vw, w 7vw, h 40vh. Depth 0.55x width. Cross-section is the podium glyph, extruded, 3% fillet. Engraved numerals: D1 `3`, D2 `2`, D3 `1` (tallest is first place). Strike geometry: computed at runtime so each falling tip literally touches the next face (approx contact angles 37° and 28° at 16:9); tune spacing in-scene, never fake with timing.
- **Annotation:** mono `FIG. 01 · THE CASCADE` at (76vw, 13vh), 1px ink 20% leader elbowing to D3's top corner, drawn via stroke-dashoffset.
- **Floor captions (sub-baseline, mono ink 40%):** under D1/D2/D3: `PROFILE` / `OFFER` / `DEAL` (the deal flow foreshadowed; falling order = deal order).

### PANEL 02 · MARKETPLACE (100 to 200vw), two build variants

Shared: kicker `02 · MARKETPLACE` C1 y 12vh; headline `--display-l` C1 to C4, top 16vh. The fallen hero pieces lie on the ground at track 57 to 107.5vw; D3's flat slab pokes ~7.5vw into this panel's left edge. It is set dressing, non-interactive, not cuttable: it is why the panel looks the way it does.

#### VARIANT A · SKYLINE (default)

- **Headline:** `Every profile` / `is a podium.`
- **Left rail:** filter chips at C1, y 35vh: `ALL / ATHLETES / TEAMS / BRANDS`, 36px tall, 1.5px ink outline, r 12px, pad 0 14px, mono labels, 12px gaps; active chip ink fill, page-white label. Mono count right of chips: `18 SHOWN`. Honesty note below, mono grey: `SAMPLE PROFILES · REAL ONES ARRIVE AT LAUNCH`.
- **Focus card:** C1 to C4 (28.6vw), standing ON the baseline, height 30vh, `#FAFBFB`, 1.5px ink border, r 12px + 28px top-left, padding 24px. Top to bottom: role tag chip (lime fill, ink mono, mini glyph radii) + mono `SAMPLE` top-right; title `--display-m` as archetype, no invented names (`400M SPRINTER`); two hairline rows, `--ui` label + mono value: `REGION · ZAGREB, HR`, `SEEKING · KIT SPONSOR`; blue link `View profiles at launch →`. No follower counts, no deal values, ever. Card top is 42vh; headline bottom is ~33vh at all QA widths; collision-free by construction.
- **Skyline field:** 36vw to panel edge, strip 150vw, pannable. 18 bars standing on the baseline: widths 3.2 to 5.6vw varied, gaps 1.2vw, heights 8 to 34vh hand-authored (no two adjacent within 4vh, tallest at ~60% across), fills alternate `#E9F5C4` / `#DDF0A8`, never two adjacent identical, glyph radii on every bar. **No text on resting bars.** Focused bar only: full `#C1EC2F` + 2px `#2742F0` top edge inset 2px. Its caption renders BELOW the baseline, aligned under the bar, mono 11px ink (`ATHLETE · TRACK · SAMPLE`), locally replacing tick labels. Rightmost visible bar always peeks cut ~40% by the viewport edge (pan affordance).
- **Sub-baseline:** `‹ DRAG TO PAN ›` mono centered under the field.

#### VARIANT B · RALLY

- **Headline:** `Sponsorship` / `is a rally.` Body C1 to C4, y 34vh: `Offer, counter, agree. It goes back and forth until both sides say yes. Keep the ball in play.`
- **Court:** 36 to 92vw, floor = baseline, two 16px ticks below baseline at the ends. Net: 1.5px ink post at 60vw, 14vh tall, mono `NET` rotated alongside. Nothing else; the court is drawn with the page's own pen.
- **Wall (platform side):** lime 3D bar, 5vw x 26vh, standing at 38vw, `limePlastic`, glyph profile. Auto-returns everything with ±10° aim variance and a 0.96 scaleX squash 80ms. That the platform never drops the ball is the joke and the message.
- **Racket (player):** DOM bar 1.5vw x 12vh at 88vw, ink fill, glyph radii. Follows cursor y through a stiff spring (stiffness 500, damping 40), clamp 32 to 70vh. It may leave the ground: the one airborne element, held by the player. Cursor stays visible.
- **Ball:** 3D lime sphere, diameter 2.4vh, moulded seam ring so spin reads, contact shadow scaling 1.0 at ground to 0.55 at apex. Physics at 120Hz fixed step: gravity 260vh/s², serve 42vw/s, +5% speed per return, restitution 0.82 off racket and wall, spin proportional to speed. Floor contact = miss.
- **Ticker:** C11, y 12vh, mono at 200%: `RALLY 00`; below, grey: `BEST 05 SIGNS THE DEAL`; below that, `SKIP THE RALLY →` mono blue. Per return, a chip drops into a right-rail stack (32px, ink outline, r 12px, mono, spring-snap): `OFFER · KIT` → `COUNTER · +TRAVEL` → `REVISED TERMS` → `AGREED IN PRINCIPLE` → `SIGNED`.
- **Signed state (return 5):** physics timescale eases 1.0 → 0.25 over 600ms; ball rolls to rest on the baseline at center court, shadow tightening; a card (skyline card construction, 22vw x 24vh) tips up standing at 56vw: chip `TERMS AGREED`, `--display-m` `That is the whole idea.`, body `Offers move back and forth inside Podium until both sides sign.`, primary `Get on the podium`, mono footnote `A GAME, NOT A PROMISE · REAL DEALS HAPPEN INSIDE`. Minimum 1.5s visible before any reset. `PLAY AGAIN ↻` mono blue below. State persists for the session.
- **Miss:** ball stops dead at the floor with a 1-frame squash, mono `OUT` stamps beside it 600ms, ticker shakes ±3px and resets to 00, re-serve after 800ms. No penalty copy.
- **Idle:** no pointer for 4s → racket autoplays (sine-tracks the ball, 120ms lag); first pointer move returns control instantly.
- **Sub-baseline:** `CLICK TO SERVE · FIVE RETURNS SIGNS THE DEAL`.

### PANEL 03 · WHAT WE DO (200 to 300vw)

- Kicker `03 · WHAT WE DO`; headline `--display-l` C1 to C6, y 16vh: `From profile to paid.`
- **Three cards standing ON the baseline:** w 22vw, heights 28 / 35 / 42vh (a podium in profile), left edges 8 / 33 / 58vw. Cards 1 and 2: white, 1.5px ink border. Card 3: lime fill, ink text, no border (the top step is the payoff). r 12px + 28px top-left, padding 24px. Contents: step chip (mono `01`, lime fill on white cards; white fill ink text on card 3), `--display-m` title (`Build your profile` / `Get discovered` / `Sign and get paid`), 1px hairline 12%, `--body` max 3 lines: `Your sport, your story, what you need. Ten minutes.` / `Brands search by sport, region and budget. You appear.` / `Agree terms and get paid through Podium.` Card 3 only: blue link `Start now →` (blue on lime = 4.9:1, AA pass).
- **Foreground column:** ink bar 16vw wide, bleeding from viewport top down to 30vh, at panel-x 88vw, on the 1.15x parallax layer, z behind card 3 (overlaps it by 4vw). The one architectural crop you walk past.
- **Baseline dot:** 6px lime dot travels the line card 1 → card 3 during dwell. Lime, not blue: it is not interactive.
- **Sub-baseline:** mono `TEN MINUTES TO A LIVE PROFILE`.

### PANEL 04 · WHO'S ON THE PODIUM (300 to 400vw)

- Kicker `04 · WHO'S ON THE PODIUM`; headline `--display-l` C1 to C5, y 16vh: `Made for the` / `whole podium.`
- **Role rows:** C1 to C5 (38vw), from y 38vh, three rows 10vh tall, 1px hairline 12% separators. Each: mono index `01/02/03`, role name `clamp(20px, 1.7vw, 26px)` DM Sans 500, `--body` one-liner, right-aligned blue `Start →` (`/role-select?role=athlete|team|brand`). One-liners: `Turn performance into partnerships.` / `Fund the season with local and national sponsors.` / `Find rights-holders at every level, not just the top.` Whole row is the hover target.
- **Podium (3D, instanced trio, on baseline):** arrangement 2-1-3: 29vh piece center 60vw, 40vh center 70.5vw, 20vh center 80.5vw, hero widths, engraved 2/1/3 facing camera. DOM labels tracking projected anchors, mono ink, 3vh above each top face: `TEAMS & CLUBS` / `ATHLETES` / `BRANDS` (athletes tallest, center). Idle yaw drift ±4°, 14s period.
- **Binding:** row hover/focus → matching step lifts world y +0.06 units spring-settle, `envMapIntensity` 0.9 → 1.15 over 200ms, its label rises 4px spring-loose; the other two steps lerp color 20% toward `#DDF0A8`; row background `#E9F5C4` fades in 150ms. Leave reverses over 300ms. Row click routes.
- **Sub-baseline:** mono `EVERY LEVEL OF THE GAME` under the group, plus `PICK A SIDE · YOU CAN CHANGE LATER` at C1.

### PANEL 05 · YOUR SPOT (400 to 500vw)

- Kicker `05 · YOUR SPOT`.
- **Headline:** `--display-xl`, three stepped lines mirroring the hero exactly: `The podium` / `has room` (+1 col) / `for [you.]`, chip static lime. The sentence resolves; the bookend is literal.
- **Body:** C1, below headline: `Free for athletes and clubs. Ten minutes to build. Live at launch.`
- **CTA:** primary `Get on the podium` standing on the baseline at C1; 24px right, mono blue link `HELLO@PODIUMSPONSORSHIP.COM`.
- **Closing image:** upright bar (D3 twin, 7vw x 40vh) standing at 64vw; at 78vw the empty slot: 1.5px dashed ink outline (6px dash / 6px gap) in the exact podium-bar silhouette, 8vw x 30vh, transparent, mono `YOU` centered inside. Floor caption under the pair: `STILL STANDING · YOUR SPOT`.
- **Footer (sub-baseline, y 82vh, single row):** podium mark 20px + mono `© 2026 PODIUM` left; `Privacy · Terms · Contact` center (`--ui` ink, blue + underline on hover); `05 / 05` + final 16px tick right. The baseline is the footer rule. Nothing else.

---

## 4. MOTION SCORE

### 4.0 Tokens

| Token | Value | Use |
|---|---|---|
| `out-expo` | cubic-bezier(0.16, 1, 0.3, 1) | reveals, line draws |
| `out-quint` | cubic-bezier(0.22, 1, 0.36, 1) | text rises, snaps to rest |
| `inout-circ` | cubic-bezier(0.85, 0, 0.15, 1) | programmatic travel |
| `gravity` | cubic-bezier(0.55, 0, 1, 0.45) | timed falls (scrubs use power maps) |
| `shove` | cubic-bezier(0.05, 0.7, 0.3, 1) | track impulse, tuned to velocity match |
| `micro` | cubic-bezier(0.4, 0, 0.2, 1) | hovers, 120 to 240ms |
| `spring-snap` | k 400, c 30, m 1 | chips, small UI |
| `spring-settle` | k 170, c 26, m 1 | pieces, cards, scroll smoothing |
| `spring-loose` | k 120, c 18, m 1 | follow-through, labels |

### 4.1 Load choreography (ms from first paint)

| t | Element | Motion |
|---|---|---|
| 0 | Baseline | scaleX 0 → 1, origin left, 900ms out-expo. The stage builds before the actors |
| 120 | Nav items | opacity + y -8 → 0, 400ms out-quint, 40ms stagger |
| 200 | Kicker | clip-path reveal left to right, 500ms out-expo |
| 350 | Headline | each line masked rise y 110% → 0, 700ms out-quint, 90ms stagger |
| 600 | Dominoes | **un-fall**: from the fallen cascade pose (96° / 94° / 90°, D3 swinging in from past the right edge) each rotates to 0° about its ground edge, spring-settle, 2° overshoot, stagger D1 0 / D2 120 / D3 240. Shadows track. The fall played backward teaches the mechanic before the wheel is touched |
| 850 | Support + CTA row | y 12 → 0 + fade, 500ms out-quint, 60ms stagger |
| 1000 | Wayfinding, ticks, floor captions | fade 300ms linear; FIG leader draws 400ms |
| 1100 | Scroll cue | fade in; `↓` bobs 6px every 2.4s |
| 2200 | Word cycle | first swap; cadence per 4.2 |

Settled by 1.7s. Scrolling mid-load fast-forwards everything to end state instantly.

### 4.2 Rotating word

Miniature domino: perspective 800px on the chip wrapper. Outgoing word rotates X 0° → 90° about its bottom edge, 240ms `gravity`; incoming enters -90° → 0° spring-settle with 4° overshoot, starting 60ms before the outgoing finishes. Chip width springs to the measured width (spring-snap) starting 80ms early. Counter `01/04` rolls in sync. Cadence 800ms (founder amendment 2026-08-05, was 2600); `you` holds 1200ms with one 1 → 1.03 → 1 scale (spring-loose). On first scroll input: fast roll to `you` in 240ms, then the cycle locks for the session. The real dominoes take the metaphor from here.

### 4.3 Domino cascade (scrub, P 0.000 to 0.150)

Pure function of smoothed P; scrubbing up replays everything exactly in reverse. Rotation about each piece's bottom-right ground edge, rightward, power maps θ = θmax · u^k (slow start, gravity-fast finish). The very first pixel of scroll moves D1: no dead zone.

| Piece | P window | θmax | k | Notes |
|---|---|---|---|---|
| D1 (20vh) | 0.000 - 0.060 | 96° | 1.8 | strikes D2 at θ ≈ 37° (P ≈ 0.035); tip stays in geometric contact |
| D2 (29vh) | 0.035 - 0.105 | 94° | 1.7 | strikes D3 at θ ≈ 28° (P ≈ 0.070) |
| D3 (40vh) | 0.070 - 0.150 | 90° | 1.5 | tip crosses the right viewport edge ≈ P 0.118, arming the shove |

Rest angles past 90° for D1/D2: each tip rests on the next piece's fallen body, a true pile. Settle rebounds are baked into the curve tails (D3: 90 → 87.5 → 90 across P 0.140 - 0.150; D1/D2 half amplitude), keeping the scrub reversible. **Forward-only garnish (never fires in reverse):** struck piece recoil shiver 0.8° / 60ms; contact-shadow pulse +30% / 120ms; 1px 90ms headline jolt on the final impact only.

Type exits during the scrub: headline lines rise out through their masks P 0.030 - 0.085; support and CTA exit 0.045 - 0.095. The chip does not exit with them: at P 0.055 it **detaches and falls** (gravity mapped to P 0.055 - 0.090), lands on the baseline, one 12% bounce, rests carrying `you`, and slides off with the shove. The sentence's blank becomes the fourth domino.

### 4.4 Shove and persistence (P 0.145 to 0.225)

Track x: 0 → -100vw, `shove` curve, beginning at P 0.145 as D3 crosses 87°: impact and page movement are causally continuous, no dead band before it. **Velocity continuity requirement:** dx/dP at P 0.145 within 10% of D3's tip horizontal screen velocity at that instant (target initial rate ≈ 260vw per unit P; tune the first control point, log both values in dev). Camera coupled 1:1: the fallen slabs are left lying on the ground and exit as real objects passing by. No fade, no morph, nothing to smear.

**Skyline shockwave:** as the viewport's left edge passes the resting D3 slab (≈ P 0.205), bar n rises at 0.205 + n x 0.0018, scaleY 0 → 1 origin bottom over a 0.008 window, 6% overshoot with one rebound baked in. The wave travels at roughly track speed: the domino's energy runs through the ground and stands the market up. Never synchronize the overshoot peaks.

### 4.5 Travel and dwell map

Rest points: P 0 / 0.27 / 0.42 / 0.59 / 0.86. Counter rolls at each travel window midpoint.

| P | Track x | Content |
|---|---|---|
| 0.000 - 0.150 | 0 | cascade (4.3) |
| 0.145 - 0.225 | 0 → -100vw | shove + shockwave (4.4) |
| 0.225 - 0.320 | hold | DWELL 02: rail lines mask in 0.230 - 0.250 (0.006 stagger); chips pop spring-snap 0.250 - 0.268 (0.004 stagger); focus card rises from below the baseline at 0.255 (out-expo); attract loop starts at rest |
| 0.320 - 0.380 | → -200vw | inout-circ; parallax layers 0.85 / 1.0 / 1.15 |
| 0.380 - 0.470 | hold | DWELL 03: cards tip up (8° about bottom edge + y 24px → 0) at 0.385 / 0.400 / 0.415, 0.030 windows, spring-settle; step chips pop +0.008 after each; baseline dot travels 0.420 - 0.465 out-quint |
| 0.470 - 0.530 | → -300vw | same law |
| 0.530 - 0.650 | hold | DWELL 04: slabs slide in flat from the left 0.530 - 0.566 (0.008 stagger, out-quint, shadow streak), then stand -90° → 0°, order 3-2-1 so ATHLETES rises last and center, at 0.570 / 0.588 / 0.606, 0.030 each, spring-settle 2.5° overshoot; labels +0.012 after each, rise 6px spring-loose; rows mask in 0.540 - 0.580. What fell in panel 1 stands back up when the roles arrive |
| 0.650 - 0.710 | → -400vw | same law |
| 0.710 - 1.000 | hold | DWELL 05: headline lines 0.720 - 0.750; body 0.750; CTA 0.765; dashed slot draws its full perimeter via stroke-dashoffset 0.750 - 0.810 out-expo; `YOU` fades 0.810; footer 0.810 - 0.840. Idle after 0.840: bar sheen (environment rotation, 8s loop), slot dashes crawl 6px/s, panel 4 yaw continues when visible. No loops on type |

Snap: input idle >150ms mid-travel within 20vw of a rest → tween to rest 600ms out-quint. PageUp/PageDown and arrow keys jump between rest points (1100ms inout-circ). Panel entrances reverse fast (300ms, no stagger) when leaving.

---

## 5. INTERACTION

### 5.1 Skyline

- **Focus:** click/tap, or arrow keys in a listbox pattern (bars are buttons, `aria-activedescendant`). Focus moves the full-lime fill + blue top edge (220ms micro), the below-line caption word-rolls (300ms out-quint), the card swaps content only: outgoing rows mask down 200ms, incoming rise 300ms out-expo, 40ms stagger. The card container never moves.
- **Hover (non-focused bar):** scaleY 1 → 1.05 spring-snap from baseline origin, tint deepens one step, immediate neighbors scaleY 1.02 spring-loose at 40ms delay (the ground carries the nudge). No text appears on hover.
- **Pan:** pointer drag 1:1 (grab cursor, 6px threshold distinguishes click), release momentum decay 0.92/frame, 60px rubber-band at ends; horizontal wheel pans; vertical wheel is never hijacked (it belongs to the track); clamp so ≥4 bars stay visible. No cursor-position panning.
- **Filter:** non-matching bars sink to 3vh stubs (never vanish, the skyline keeps its ground), spring-settle, 30ms stagger by index; survivors re-space with FLIP spring-settle; count updates (`8 SHOWN`); `ALL` restores with the shockwave at half amplitude. Things leave through the floor in this world, never through opacity.
- **Attract:** until first pointer/keyboard input inside the panel, focus advances to the next bar every 4s with full choreography; pauses while the pointer is inside the field; stops permanently on interaction.

### 5.2 Rally

Full loop per Panel 02B spec. Additional rules: Escape or scrolling away releases pointer capture instantly, the game never blocks the journey; keyboard fallback moves the racket with arrow keys at 18vh/s and the instruction line swaps text accordingly; ticker and chip stack are an `aria-live="polite"` region; signed card is reachable via `SKIP THE RALLY →`, which jumps straight to the signed state.

### 5.3 Hover/focus table (every interactive element)

| Element | Hover | Timing |
|---|---|---|
| Primary buttons | lime wipes in from left behind the label (scaleX 0 → 1, origin left), label crossfades white → ink at the 50% mark (110ms), lift y -2px spring-snap; press scale 0.98 | 240ms cubic-bezier(0.65, 0, 0.35, 1) |
| Join free (nav) | same wipe | 200ms |
| Secondary / all blue links | 1.5px underline draws left to right; arrow +4px spring-snap | 180ms out-quint |
| Nav links | grey → ink + underline draw; active panel holds the lime square marker | 180ms micro |
| Filter chips | outline and label → blue; selected: ink fill, white label + 1 → 0.96 → 1 press spring | 150ms |
| Skyline bar | per 5.1 | 220ms |
| Card links | underline draw + arrow +4px | 150ms |
| Panel 3 cards | lift y -4px spring-settle; step chip nudges x +2px spring-loose | |
| Panel 4 rows | per Panel 04 binding | 150 / 200ms |
| Racket | outline blue while active; scaleX 0.85 squash 80ms on strike | 120ms |
| Footer links | ink → blue + underline draw | 140ms |
| Focus-visible | 2px `#2742F0` outline, 3px offset, global | instant |

### 5.4 Nav behaviours

Marketplace → P 0.27, How it works → P 0.42, animated 1100ms inout-circ with the smoothing spring bypassed then re-engaged: the corridor rushes past, no teleporting. Logo → P 0 (the cascade rebuilds in reverse on the way, everything being P-driven). Pricing, Sign in route away; Join free → `/role-select`. During P < 0.150, any nav click or skip first plays a 400ms canned completion of the remaining fall, then travels: the intro can never trap intent.

---

## 6. MOBILE (≤900px) AND STACK

Vertical document, sections in order, each min-height 100svh, no pin, no track. The baseline becomes a per-section ground line (1.5px ink at the bottom of each section's stage; standing elements stand on it; aligned so the lines chain section to section). Ticks dropped; `01 / 05` counter kept bottom-left. Touch targets ≥44px.

- **Nav 60px:** mark + Join free + ink burger → full-screen `#FAFBFB` sheet, links at `--display-l` scale standing on a ground line, 40ms stagger.
- **01 Hero:** headline `clamp(44px, 13vw, 72px)`, three stepped lines (indent 8vw). Dominoes: dedicated 60svh canvas; the cascade autoplays ONCE when the section is 60% in view, timed keyframes compressed to 2.0s using the same θ curves, D3 exiting right; `↻ REPLAY` mono button after. Poster on low-power devices (`hardwareConcurrency < 4` or a failed 60fps probe in the first second). CTA full-width standing on the section line, support line above it.
- **02 Marketplace:** skyline only (rally is pointer-first; do not fake it on touch). Filter row horizontal scroll, 44px chips. Strip: native `overflow-x` with scroll-snap on bars, 44svh tall, bars 14vw wide, heights 6 to 22svh on the section line. Focus card renders full-width BELOW the strip, updated by snap position (IntersectionObserver on bar centers); tap focuses directly.
- **03:** cards stack full-width, min-height 26svh, card 3 lime; tip-up entrance at 4° amplitude on scroll-into-view.
- **04:** podium poster (or 55% canvas) above; role rows full-width, tap routes.
- **05:** headline `clamp(40px, 12vw, 64px)` stepped; CTA full-width on the final line; bar + dashed slot at 55% scale right-aligned; footer single column, 16px gaps.

---

## 7. REDUCED MOTION AND FALLBACKS

`prefers-reduced-motion: reduce` (any width): the vertical stack, no scrub, no parallax, no smoothing spring, no autoplay, no attract, no dash crawl. All 3D replaced by 2x WebP posters rendered from the real rig (standing trio / fallen slabs / podium 2-1-3 / bar + slot), contact shadows baked. Entrances are opacity-only, ≤200ms. Chip is static `you` with a mono line above it: `ATHLETES · TEAMS · BRANDS ·`. Rally not offered; skyline renders at rest with 150ms ease-out focus.

No WebGL or low-power with motion allowed: posters swap in, every DOM interaction, the track, and all travel remain intact.

---

## 8. QA GATES (all must pass before launch)

1. **Material:** isolated turntable against `#FAFBFB`, founder sign-off BEFORE integration; any still frame must pass as a product photograph; rendered mid-face color within 5% of `#C1EC2F` after ACES (color-pick and correct the material, not the swatch).
2. **Registration:** `?debugGround` overlay; world y = 0 vs 72vh within ±2px at 1280 / 1440 / 1920 and after resize.
3. **Determinism:** automated P sweep down then up; reverse must be pixel-identical (garnish excepted by design).
4. **Momentum:** logged dx/dP at shove start within 10% of D3 tip velocity.
5. **Escape:** wheel-spam reaches panel 2 in under 3s and the tester can describe what fell; skip and nav work mid-cascade.
6. **Composition matrix:** screenshots at 1280x800 / 1440x900 / 1680x1050 / 1920x1080, all panels: headline ≥30% viewport width; ≥2 elements standing on the baseline; no empty full-width band taller than 18vh. Any failure is a bug, not a preference.
7. **Performance:** 60fps through cascade and travel on a mid-tier laptop; degrade order DPR 1.75 → 1.25, shadow resolution 512 → 256, MSAA off. Choreography is never cut.
8. **Access:** full journey keyboard-only; focus visible everywhere; axe clean; reduced-motion path audited; live regions verified.

---

## 9. BUILD ORDER (each step verifiable in a browser)

1. **Tokens + static hero.** CSS custom properties, grid, font preloads, fixed nav, fixed baseline, complete hero DOM at rest with a static chip. Verify: hero poster passes gate 6 at all four widths.
2. **Scroll fabric.** 1000vh body, damped-spring P, 500vw track with five stub panels (kickers + headlines), moving tick strip, counter rolls, snap, keyboard jumps, skip stub. Verify: travel between all five rests feels inertial; ticks read as a tape.
3. **3D stage.** Fixed canvas, fov 28 world-coupled camera, light rig, `limePlastic` on a test bar, ContactShadows, `?debugGround`. Verify: gates 1 and 2 signed off on the turntable.
4. **Hero pieces + load.** Three filleted, engraved dominoes; full load choreography including the un-fall; FIG leader; floor captions; word-flip cycle with width spring and counter. Verify: load sequence and cycle; early scroll fast-forwards load.
5. **Cascade.** θ(P) scrub with baked rebounds, forward-only garnish, type exits, chip detach and fall, lock-to-you. Verify: gate 3 determinism; first pixel moves D1.
6. **Shove + persistence.** Velocity-matched launch, slabs persist in world and pass by, shockwave with placeholder bars. Verify: gate 4 log; the impact visibly pushes the page.
7. **Skyline complete.** Authored 18 bars, shockwave polish, docked card and swap choreography, pan with momentum and rubber-band, filters with stubs and FLIP, below-line captions, attract loop, listbox semantics. Verify: full pointer + keyboard interaction pass.
8. **Rally variant** behind `?variant=rally`. Court, spring racket, 120Hz physics, chip stack, OUT, signed state with time dilation, idle autoplay, skip, persistence. Verify: play to signed with mouse and with keyboard.
9. **Panels 3 + 4.** Card tip-ups, lime card 3, baseline dot, foreground column on the 1.15x layer; podium slide-in and 3-2-1 stand, labels, row binding, idle yaw. Verify: both dwell choreographies and the hover binding.
10. **Panel 5 + footer.** Finale type, static chip, bar + dashed slot draw and crawl, sheen idle, footer, email link. Verify: closing image; every link routes.
11. **Mobile + fallbacks.** ≤900px stack with chained ground lines, burger sheet, autoplay hero with REPLAY, snap skyline with below-strip card, posters, reduced-motion document, no-WebGL and low-power paths. Verify: 360px and 768px devices, `prefers-reduced-motion`, WebGL disabled.
12. **Hardening.** Run gates 1 through 8, screenshot matrix, degrade ladder, a11y audit, copy proofed verbatim against this spec. Verify: all gates green, founder sign-off on the recorded scroll-through.