# Handoff: landing rebuild, hero + all panels live on staging branch (2026-08-10)

Branch: `staging`. A concurrent session (EB1) also commits to this checkout: stage/commit by explicit path only, never `git add -A`.

## Governing documents
1. `docs/superpowers/specs/2026-08-05-landing-build-spec-v3.md` — THE build spec.
2. Memory `podium-landing-quality-bar.md` — Nicholas's standing rules (Awwwards bar, verify EVERY change visually, unlimited subagents, no em dashes).
3. Memory `podium-landing-redesign.md` — current state + verification protocol.

## State (commits 5a54304 hero, a18d3ee panels)
- Hero: 3D rigid dominoes (logo colours ink/ink/lime), contact solve, corner-push scroll coupling via shared `components/landing/stage/track-map.ts`, floor at 80vh (`--floor-y`), blue primary CTA, un-fall intro on performance.now, one-shot 4s canvas watchdog. All verified in browser.
- Panels 02-05 real content (marketplace skyline + `?variant=rally`, what-we-do, roles, finale) wired in `app/page.tsx`, panel-stub deleted. Verified headless at every dwell.
- Founder round-2 feedback list (2026-08-10): ALL SIX items done.

## Verification protocol (do not relearn this the hard way)
- claude-in-chrome screenshots of a BACKGROUNDED tab show frozen stale paint (Chrome pauses rAF). Click the page first to focus, or use headless Playwright (script must sit in repo root for `import 'playwright'` to resolve; delete after).
- Dev cold hydration takes 10-20s (three.js dev chunk ~10MB). Invisible dominoes + static word chip = not hydrated yet, NOT a bug. Wipe `.next` only for genuinely stale bundles.
- Dev server: launch DETACHED so the harness can't reap it:
  `Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev" -WorkingDirectory "C:\Users\nicho\Documents\Podium\Podium" -WindowStyle Hidden`

## Next (in order)
1. Polish pass on the four new panels against the spec (they were scoped down; each agent's scope-downs are listed in its final report, e.g. skyline has no pan/filters, rally has no cursor racket). Art-direct in browser.
2. R5: mobile ≤900px stack, reduced-motion sweep, no-WebGL posters (spec §6-7).
3. R6: QA gates + screenshot matrix (spec §8), rewrite stale `e2e/landing.spec.ts` + `e2e/auth.spec.ts` landing assertions, `npm run check`, review workflow, then push staging remote for Nicholas (skyline vs rally decision).

## Known bugs out of scope
- /403 missing from PUBLIC_PATHS in middleware.ts.
- Auth signup e2e strict-mode locator collision.
