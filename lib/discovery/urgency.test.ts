import { it, expect } from 'vitest'
import { getUrgency } from './urgency'

const now = new Date('2026-08-16T12:00:00Z')

it('flags a deadline within 7 days as closing', () => {
  const u = getUrgency({ application_deadline: '2026-08-19T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'closing', days: 3, label: 'Closes in 3d' })
})
it('labels a same-day deadline "Closes today"', () => {
  const u = getUrgency({ application_deadline: '2026-08-16T20:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'closing', days: 0, label: 'Closes today' })
})
it('flags a listing created within 7 days as new', () => {
  const u = getUrgency({ application_deadline: null, created_at: '2026-08-12T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'new', label: 'New' })
})
it('returns null for an old listing with a far deadline', () => {
  expect(getUrgency({ application_deadline: '2026-12-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)).toBeNull()
})
it('closing takes priority over new', () => {
  const u = getUrgency({ application_deadline: '2026-08-18T00:00:00Z', created_at: '2026-08-15T00:00:00Z' }, now)
  expect(u?.kind).toBe('closing')
})
it('boundary: deadline 8 calendar days out (but under 8 raw days) is NOT closing', () => {
  const u = getUrgency({ application_deadline: '2026-08-24T06:00:00Z', created_at: '2026-01-01T00:00:00Z' }, now)
  expect(u).toBeNull()
})
it('boundary: listing created exactly 7 calendar days ago is still new', () => {
  const u = getUrgency({ application_deadline: null, created_at: '2026-08-09T00:00:00Z' }, now)
  expect(u).toEqual({ kind: 'new', label: 'New' })
})
it('boundary: listing created 8 calendar days ago is NOT new', () => {
  const u = getUrgency({ application_deadline: null, created_at: '2026-08-08T00:00:00Z' }, now)
  expect(u).toBeNull()
})
