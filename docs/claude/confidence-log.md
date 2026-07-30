# Confidence Log — Podium

Format: `[YYYY-MM-DD] [component] [P%] [what most influenced the estimate]`

---

[2026-04-19] [harness-setup] [98%] [all checks pass, hooks verified as valid JSON, E2E smoke passes — minor uncertainty on hook env var availability in all Claude Code versions]

[2026-07-30] [qa-report-criticals] [96%] [every finding re-read in the current code before any fix: teams.ts strips status, sendProposal never touched matches.proposal_sent, nothing inserts profile_settings, signContract never wrote locked_at, docs bucket rejects application/json. Unit tests cover each fix and the suite is green. The 4% is that the migrations have not been applied to a real database yet, so the send_proposal function, the profile_settings trigger and the exports bucket are verified as SQL and by mocked call sites, not against live Postgres.]

<!-- Entries added here as work progresses -->
