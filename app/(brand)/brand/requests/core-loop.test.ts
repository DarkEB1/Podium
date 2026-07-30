import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * THE CORE-LOOP REGRESSION GUARD (B-1).
 *
 * The bug this file exists to prevent is not a broken function — every piece
 * worked in isolation. It is a DISJOINT FLOW: the only surface that SENDS a
 * connection request addressed it to a brand user, while the only surface that
 * could ACCEPT one belonged to athletes. Nothing failed, nothing logged; the
 * request simply sat in a queue nobody could see. Because the match-creation
 * trigger only fires on acceptance, messaging, proposals, contracts and
 * payments were all unreachable.
 *
 * So the invariant asserted here is structural: for every role a send surface
 * can address, there must exist an accept surface owned by that same role.
 */

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const APP_DIR = path.join(ROOT, 'app')
const COMPONENTS_DIR = path.join(ROOT, 'components')

type Role = 'athlete' | 'brand' | 'team' | 'agent'

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      out.push(...walk(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const SOURCE_FILES = [...walk(APP_DIR), ...walk(COMPONENTS_DIR)]

/**
 * Which role(s) a `recipient_id:` expression can address. The FK is to
 * `users.id`, so the role is only knowable from the field the caller reads it
 * out of. An unrecognised expression FAILS the suite on purpose — a new send
 * surface must declare who it is writing to.
 *
 * Most entries name one role because the expression itself does. A
 * role-parameterised sender declares every role it can address instead, and the
 * assertion below requires an inbox for each of them.
 */
const RECIPIENT_EXPRESSION_ROLE: ReadonlyArray<{ pattern: RegExp; roles: readonly Role[] }> = [
  { pattern: /brand_user_id|brand\.user_id|brandUserId/, roles: ['brand'] },
  { pattern: /athlete_user_id|athlete\.user_id|athleteUserId/, roles: ['athlete'] },
  { pattern: /team_user_id|team\.user_id|teamUserId/, roles: ['team'] },
  { pattern: /agent_user_id|agent\.user_id|agentUserId/, roles: ['agent'] },
  // components/discovery/connect-request-button.tsx takes the recipient's role
  // as a prop, so its expression cannot name one role on its own. Its
  // `recipientRole` prop type is the declaration, and all three are checked.
  { pattern: /^recipientUserId$/, roles: ['athlete', 'team', 'brand'] },
]

interface SendSurface {
  file: string
  expression: string
  roles: readonly Role[]
}

/** Every client surface that POSTs a connection request. */
function findSendSurfaces(): SendSurface[] {
  const found: SendSurface[] = []
  for (const file of SOURCE_FILES) {
    const src = readFileSync(file, 'utf8')
    if (!/api\.discovery\.connections\b|['"`]\/api\/discovery\/connections['"`]/.test(src)) continue
    for (const match of src.matchAll(/recipient_id\s*:\s*([^,\n}]+)/g)) {
      const expression = match[1]!.trim()
      const entry = RECIPIENT_EXPRESSION_ROLE.find((e) => e.pattern.test(expression))
      found.push({ file: path.relative(ROOT, file), expression, roles: entry?.roles ?? [] })
    }
  }
  return found
}

/**
 * Every page that lists requests where the signed-in user is the RECIPIENT,
 * keyed by the route group it lives in — i.e. the role that can act on it.
 */
function findAcceptSurfaces(): Map<Role, string[]> {
  const byRole = new Map<Role, string[]>()
  for (const file of walk(APP_DIR)) {
    if (path.basename(file) !== 'page.tsx') continue
    const src = readFileSync(file, 'utf8')
    const readsIncoming =
      /getIncomingConnectionRequests/.test(src) ||
      /\.eq\(\s*['"]recipient_id['"]/.test(src)
    if (!readsIncoming) continue

    const rel = path.relative(APP_DIR, file).replace(/\\/g, '/')
    const group = /^\((athlete|brand|team|agent)\)\//.exec(rel)
    if (!group) continue
    // exec against a fixed alternation, so group 1 is one of the four roles.
    const role = group[1] as Role
    byRole.set(role, [...(byRole.get(role) ?? []), rel])
  }
  return byRole
}

const sendSurfaces = findSendSurfaces()
const acceptSurfaces = findAcceptSurfaces()

describe('connection-request core loop', () => {
  it('has at least one surface that sends a connection request', () => {
    expect(sendSurfaces.length).toBeGreaterThan(0)
  })

  it('resolves the recipient role of every send surface', () => {
    const unknown = sendSurfaces.filter((s) => s.roles.length === 0)
    expect(
      unknown,
      `Unrecognised recipient expression(s): ${unknown
        .map((u) => `${u.file} → ${u.expression}`)
        .join(', ')}. Add it to RECIPIENT_EXPRESSION_ROLE so this guard can check ` +
        'that the addressed role actually has an inbox.'
    ).toEqual([])
  })

  // THE ASSERTION. Send-side recipient role === accept-side owner role.
  it('gives every role a send surface can address an inbox of its own', () => {
    const targeted = new Set(sendSurfaces.flatMap((s) => s.roles))
    expect(targeted.size).toBeGreaterThan(0)

    for (const role of targeted) {
      expect(
        acceptSurfaces.get(role) ?? [],
        `Role "${role}" receives connection requests but has no page listing requests ` +
          `where recipient_id = the signed-in user. Requests addressed to ${role}s can never ` +
          'be accepted, so the match trigger never fires and messaging/proposals/payments ' +
          'stay unreachable (B-1).'
      ).not.toEqual([])
    }
  })

  it('brands — the role every current send surface addresses — have an inbox', () => {
    expect(acceptSurfaces.get('brand')).toContain('(brand)/brand/requests/page.tsx')
  })

  it('reaches that inbox from the brand navigation', async () => {
    const { navItemsForRole } = await import('@/lib/nav/config')
    const hrefs = navItemsForRole('brand').map((i) => i.href)
    expect(hrefs).toContain('/brand/requests')
  })

  it('the inbox is reachable in the four-slot nav budget without losing Messages', async () => {
    // Accepting opens a conversation; a Requests slot bought by dropping
    // Messages would just move the dead end one step later.
    const { navItemsForRole } = await import('@/lib/nav/config')
    const hrefs = navItemsForRole('brand').map((i) => i.href)
    expect(hrefs).toContain('/brand/messages')
    expect(hrefs).toHaveLength(4)
  })

  // SB-10 / FA-1 / FA-8: the inbox query belongs in lib/supabase/.
  it('never queries connection_requests directly from a page', () => {
    const offenders = walk(APP_DIR)
      .filter((f) => /page\.tsx$/.test(f))
      .filter((f) => /from\(\s*['"]connection_requests['"]\s*\)/.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f))

    expect(
      offenders,
      'Pages must call lib/supabase/connections.ts, not Supabase directly (CLAUDE.md).'
    ).toEqual([])
  })
})
