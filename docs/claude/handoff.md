# Handoff: landing rebuild, 3D hero in progress (2026-08-05)

Session ended at context limit mid build-step 3/4 of the landing rebuild. Read this fully, then continue. Branch: `staging`. A concurrent session (EB1) is also committing to this checkout: stage/commit by explicit path only, never `git add -A`. (Previous Phase-5 handoff was stale-complete and replaced by this one.)

## Governing documents (read in this order)
1. `docs/superpowers/specs/2026-08-05-landing-build-spec-v3.md` — THE build spec (geometry, motion score with exact timings, both marketplace variants, QA gates, 12-step build order). Build exactly this.
2. `docs/superpowers/specs/2026-08-05-landing-redesign-design.md` — original spec + amendments section.
3. Memory: `podium-landing-quality-bar.md` — Nicholas's standing rules (Awwwards bar, 3D r3f language, verify EVERY change visually via claude-in-chrome screenshots on localhost:3000, unlimited subagents/ultracode, compress context at 70%, no em dashes in copy).

## Where the build stands (commits 134de60, ee3dee4, 8f764c6)
- Build steps 1-2 DONE and visually verified: stage scroll fabric (1000vh, damped spring writing `--p` + imperative track transform, snap, keyboard jumps, skip), fixed nav with active marker, fixed baseline + travelling tick tape, poster hero DOM (stepped display-xl with 16vh cap, static lime chip, CTA row on baseline, dashed domino placeholder volumes), stub panels 02-05. Travel/dwell verified in browser.
- `lib/landing/motion-map.ts` (+35 passing tests): trackX piecewise map with real bezier solving, dominoTheta cascade curves incl settle tails, rest/snap/dwell helpers. Stage and scene still use inline v0 placeholder maps: SWAP them to import motion-map (interfaces match by design).
- Build step 3 (3D stage) WIP in `components/landing/stage/scene.tsx`: camera/world mapping (1 unit = 10vh, floor y=0 at 72vh, fov 28 at dist 5/tan(14°), camera x couples to trackX), extruded podium-glyph geometry with fillet, MeshPhysicalMaterial lime plastic per spec, RoomEnvironment PMREM (no network), RectAreaLight rig, ContactShadows, un-fall load animation, cascade scrub wiring.

## THE BLOCKER (fix first)
r3f Canvas children do not mount on current builds: canvas element exists, `SceneInner` never runs (no `[scene] SceneInner mounted` log, `window.__sceneDebug` stays undefined, no meshes). ONE earlier dev build DID render all three glossy plastic pieces with shadows (visually verified screenshot), so geometry/material/camera/lighting are correct. Fixes already applied:
- `next/dynamic({ssr:false})` silently never loaded the chunk: replaced with static import + mount gate. After this the DOM wrapper + red debug dot rendered.
- Suspected React context read inside the r3f renderer (useStage in canvas children) suspending the internal Suspense: stage API now passed as PROP into SceneInner/Rig/HeroDominoes. Still not mounting after this change on the last fresh build.
- Dev toolchain was repeatedly serving stale/mixed bundles (edits invisible until server restart + hard reload; root cause suspicion: stray `C:\Users\nicho\package-lock.json` made Next infer the home dir as workspace root and broke watching; `outputFileTracingRoot` now pinned in next.config.ts). Because of this, DISTRUST any single dev observation.

Next debugging steps, in order:
1. `npm run build && npm run start` (production build on :3000, kill dev first) — eliminates every dev-server ghost. If pieces render in prod, the scene is DONE and the issue is purely dev-HMR; continue building and only restart dev when stale. (Attempted at session end: the background task was reaped mid-build, worker exit 0xC0000142; re-run it first thing, in the foreground if background tasks keep dying.)
2. If prod also fails: bisect SceneInner children (start with bare `<mesh><boxGeometry/><meshBasicMaterial/></mesh>` directly inside Canvas, add back Rig, HeroDominoes, environment effect, ContactShadows one at a time, hard reload each). Suspects in order: SceneInner's PMREM/RoomEnvironment effect, drei ContactShadows, RectAreaLightUniformsLib.
3. Known secondary bug once mounting works: in the one build where pieces rendered they were stuck FALLEN (~90°): if frameloop was 'demand' at that point r3f pauses the clock so the un-fall never advanced. Canvas is currently frameloop='always'. Later, per spec, restore demand-with-invalidate but drive the un-fall from performance.now() rather than state.clock so it cannot freeze.
4. Remove debug artifacts when verified: red DOM dot + `data-scene-version` in scene.tsx, red 3D box, `__sceneDebug`, `[scene]` log.

## Then continue the spec build order (step 4 onward)
Word-flip chip cycle, cascade scrub + type exits + chip detach (motion-map has the curves), scroll-locked intro (spec amendment: page pins until D3 tip crosses right viewport edge ~P 0.118; cascade owns P 0-0.15 with track x=0 so the map already accommodates), shove velocity match, then panels: skyline (spec §3 P02A + §5.1), rally (§3 P02B + §5.2, `?variant=rally`, page.tsx already reads it), panels 3/4/5 (§3), mobile stack + reduced motion + posters (§6-7), QA gates + screenshot matrix (§8), rewrite stale `e2e/landing.spec.ts` and `e2e/auth.spec.ts` landing assertions for the new DOM, full `npm run check`, push staging.
Use subagents freely for panels once the 3D pipeline is stable; keep the browser verification loop yourself. Fan out an ultracode review workflow before pushing.

## Environment notes
- Dev server: background task, `npm run dev` from repo root; after editing scene/stage files, if changes do not appear: restart server AND ctrl+shift+r (watcher unreliability may persist).
- Chrome tab 532371252 is the working tab (claude-in-chrome); viewport 1512x795, vh=795.
- The visual companion mockups (aesthetic references Nicholas approved) live in `.superpowers/brainstorm/33237-1785930672/content/` — `locked-hero.html` is the approved hero look pre-3D.
- Nicholas's system is dark mode: `.landing-light` scope must keep the landing light. Fonts: DM Sans vars are on `<html>` (do not move back to body).
