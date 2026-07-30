import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(__dirname, '20260730000000_onboarding_completion.sql'), 'utf8').toLowerCase()

describe('onboarding completion migration', () => {
  it('adds a nullable completion marker to brand_profiles', () => {
    expect(sql).toContain('alter table public.brand_profiles')
    expect(sql).toContain('add column if not exists onboarding_completed_at timestamptz')
    // Nullable is the whole point: null means "still in the wizard".
    expect(sql).not.toMatch(/onboarding_completed_at timestamptz not null/)
  })

  it('backfills existing brands so none are trapped back inside the wizard', () => {
    expect(sql).toMatch(
      /update public\.brand_profiles[\s\S]*set onboarding_completed_at = created_at[\s\S]*where onboarding_completed_at is null/,
    )
  })

  it('releases the team and agent rows the redirect loop stranded in draft', () => {
    for (const table of ['team_profiles', 'agent_profiles']) {
      expect(sql).toMatch(
        new RegExp(`update public\\.${table}[\\s\\S]*set status = 'active'[\\s\\S]*where status = 'draft'`),
      )
    }
  })

  it('leaves brand status alone, since it tracks admin approval not onboarding', () => {
    // Statement-scoped: a whole-file regex would run past the semicolon and
    // match the team/agent status updates further down.
    const brandUpdates = sql
      .split(';')
      .filter((stmt) => /update public\.brand_profiles/.test(stmt))
    expect(brandUpdates).not.toHaveLength(0)
    for (const stmt of brandUpdates) {
      expect(stmt).not.toMatch(/set status/)
    }
  })
})
