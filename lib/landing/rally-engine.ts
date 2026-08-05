// Pure state machine for the marketplace rally game. All animation-frame and
// pointer concerns live in the component; this module is the testable core.
import type { RALLY_PAIRS as PairsType } from './market-fixtures'

export const RETURNS_TO_SIGN = 5

export type RallyState = {
  pairIndex: number
  returns: number
  signed: boolean
}

export function newRally(pairIndex: number): RallyState {
  return { pairIndex, returns: 0, signed: false }
}

export function registerReturn(s: RallyState): RallyState {
  if (s.signed) return s
  const returns = s.returns + 1
  return { ...s, returns, signed: returns >= RETURNS_TO_SIGN }
}

export function nextRally(s: RallyState, pairCount: number): RallyState {
  return newRally((s.pairIndex + 1) % pairCount)
}

export function tickerLine(s: RallyState, pairs: typeof PairsType): string {
  const pair = pairs[s.pairIndex]!
  const offer = pair.baseOffer + s.returns * 250
  const amount = `£${offer.toLocaleString('en-GB')}`
  const label = pair.athlete.seeking.toUpperCase()
  return s.signed ? `SIGNED · ${amount} · ${label}` : `RALLY ${s.returns} · OFFER ${amount} · ${label}`
}
