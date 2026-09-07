import { describe, it, expect } from 'vitest'
import manifest from './manifest'

// WS-INFRA-01: /manifest.webmanifest used to 307 to /auth because nothing served
// it. These assertions prove a real, install-ready manifest is generated.
describe('web app manifest (WS-INFRA-01)', () => {
  it('names the app and provides an installable display mode', () => {
    const m = manifest()
    expect(m.name).toMatch(/Podium/)
    expect(m.short_name).toBe('Podium')
    expect(m.start_url).toBe('/')
    expect(m.display).toBe('standalone')
  })

  it('carries brand theme colours', () => {
    const m = manifest()
    expect(m.theme_color).toBe('#C1EC2F')
    expect(m.background_color).toBe('#FFFFFF')
  })

  it('references icons that actually exist in the app', () => {
    const srcs = (manifest().icons ?? []).map((i) => i.src)
    // app/icon.svg and app/favicon.ico both exist in the repo.
    expect(srcs).toContain('/icon.svg')
    expect(srcs).toContain('/favicon.ico')
  })
})
