import { it, expect } from 'vitest'
import { decorateWithMatch } from './match'

const athlete = { primary_sport: 'Surfing', level: 'pro', availability_status: 'available_now' }
const base = { id: '1', title: 'X', description: null, type: 't', status: 'active', sport_required: 'Surfing', level_required: 'pro', location: null, is_remote: true, pay_type: 'flat_fee', pay_amount: 100, pay_currency: 'GBP', contract_duration_months: null, application_deadline: null, created_at: '2026-08-10T00:00:00Z', brand_user_id: 'b', brand_name: 'B', brand_logo_url: null, brand_cover_url: null, brand_description: null }

it('attaches a 0..100 score and reasons from the matcher', () => {
  const [scored] = decorateWithMatch([base as never], athlete as never)
  // Non-null assertion: array always has one element
  expect(scored!.matchScore).toBeGreaterThan(0)
  expect(scored!.matchScore).toBeLessThanOrEqual(100)
  expect(scored!.matchReasons).toContain('Sport matches')
})

it('with no athlete, score is 0 and reasons empty (never throws)', () => {
  const [scored] = decorateWithMatch([base as never], null)
  // Non-null assertion: array always has one element
  expect(scored!.matchScore).toBe(0)
  expect(scored!.matchReasons).toEqual([])
})
