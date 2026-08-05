import { describe, it, expect } from 'vitest'
import { newRally, registerReturn, nextRally, tickerLine, RETURNS_TO_SIGN } from './rally-engine'
import { RALLY_PAIRS } from './market-fixtures'

describe('rally engine', () => {
  it('starts unsigned with zero returns', () => {
    expect(newRally(0)).toEqual({ pairIndex: 0, returns: 0, signed: false })
  })

  it('signs after exactly RETURNS_TO_SIGN returns and then freezes', () => {
    let s = newRally(0)
    for (let i = 0; i < RETURNS_TO_SIGN - 1; i++) s = registerReturn(s)
    expect(s.signed).toBe(false)
    s = registerReturn(s)
    expect(s.signed).toBe(true)
    expect(registerReturn(s)).toEqual(s)
  })

  it('advances to the next pair and wraps at the end', () => {
    expect(nextRally(newRally(3), 4).pairIndex).toBe(0)
    expect(nextRally(newRally(1), 4)).toEqual({ pairIndex: 2, returns: 0, signed: false })
  })

  it('escalates the offer by £250 per return in the ticker', () => {
    let s = newRally(0)
    expect(tickerLine(s, RALLY_PAIRS)).toBe('RALLY 0 · OFFER £400 · KIT DEAL')
    s = registerReturn(s)
    s = registerReturn(s)
    expect(tickerLine(s, RALLY_PAIRS)).toBe('RALLY 2 · OFFER £900 · KIT DEAL')
  })

  it('stamps SIGNED with the final thousands-separated offer', () => {
    let s = newRally(0)
    for (let i = 0; i < RETURNS_TO_SIGN; i++) s = registerReturn(s)
    expect(tickerLine(s, RALLY_PAIRS)).toBe('SIGNED · £1,650 · KIT DEAL')
  })
})
