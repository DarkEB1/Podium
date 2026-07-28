import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// Every scheduled cron in vercel.json must resolve to a real route handler, and
// every cron route handler should be scheduled. A path/handler mismatch means a
// job silently never runs (or a handler is dead).

const vercel = JSON.parse(readFileSync(join(__dirname, 'vercel.json'), 'utf8')) as {
  crons: { path: string; schedule: string }[]
}

describe('vercel.json crons', () => {
  it('points every cron at an existing route handler', () => {
    for (const cron of vercel.crons) {
      const routeFile = join(__dirname, 'app', `${cron.path}`, 'route.ts')
      expect(existsSync(routeFile), `${cron.path} -> ${routeFile}`).toBe(true)
    }
  })

  it('gives every cron a valid five-field schedule', () => {
    for (const cron of vercel.crons) {
      expect(cron.schedule.trim().split(/\s+/)).toHaveLength(5)
    }
  })

  it('schedules the three prelaunch jobs (2.5)', () => {
    const paths = vercel.crons.map((c) => c.path)
    expect(paths).toContain('/api/cron/chat-cleanup')
    expect(paths).toContain('/api/cron/guardian-consent-expiry')
    expect(paths).toContain('/api/cron/adult-transfer')
  })
})
