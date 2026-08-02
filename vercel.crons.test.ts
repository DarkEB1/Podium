import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// Every scheduled cron in vercel.json must resolve to a real route handler, and
// every cron route handler must run somewhere — either on its own schedule or
// inside the consolidated /api/cron/daily runner. A gap means a job silently
// never runs (or a handler is dead).

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

  it('fits the Vercel Hobby plan: at most 2 crons, each at most daily', () => {
    expect(vercel.crons.length).toBeLessThanOrEqual(2)
    for (const cron of vercel.crons) {
      // Hourly (or more frequent) schedules use * or */n in the hour field,
      // which the Hobby plan rejects. Minute and hour must both be fixed.
      const [minute, hour] = cron.schedule.trim().split(/\s+/)
      expect(minute, `${cron.path} minute`).toMatch(/^\d+$/)
      expect(hour, `${cron.path} hour`).toMatch(/^\d+$/)
    }
  })

  it('runs every cron route: its own schedule or the daily runner', async () => {
    const { DAILY_CRON_JOBS } = await import('./lib/cron/daily-jobs')
    const scheduled = new Set([
      ...vercel.crons.map((c) => c.path),
      ...DAILY_CRON_JOBS.map((j) => j.path),
    ])
    const routeDirs = readdirSync(join(__dirname, 'app', 'api', 'cron'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/api/cron/${entry.name}`)
    expect(routeDirs.length).toBeGreaterThan(1)
    for (const path of routeDirs) {
      if (path === '/api/cron/daily') continue
      expect(scheduled.has(path), `${path} is neither scheduled nor in DAILY_CRON_JOBS`).toBe(true)
    }
  })
})
