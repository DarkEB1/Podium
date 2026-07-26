import { describe, it, expect } from 'vitest'
import { escapeHtml, html, raw, safeUrl } from './escape'

describe('escapeHtml (B-8/SEC-1)', () => {
  it('neutralises the classic script-injection vector', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src&#61;x onerror&#61;alert(1)&gt;'
    )
  })

  it('escapes every dangerous character including quotes, backtick and equals', () => {
    expect(escapeHtml(`&<>"'\`=`)).toBe('&amp;&lt;&gt;&quot;&#39;&#96;&#61;')
  })

  it('coerces null/undefined to empty rather than the string "null"', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Maya Okoro')).toBe('Maya Okoro')
  })
})

describe('html tagged template', () => {
  it('escapes interpolations by default', () => {
    const name = '</h1><script>steal()</script>'
    const out = html`<h1>${name}</h1>`
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('trusts raw() fragments so templates can compose', () => {
    const inner = '<strong>ok</strong>'
    expect(html`<div>${raw(inner)}</div>`).toBe('<div><strong>ok</strong></div>')
  })

  it('escapes each element of an interpolated array', () => {
    const out = html`${['<a>', '<b>']}`
    expect(out).toBe('&lt;a&gt;&lt;b&gt;')
  })

  // A proposal title is the exact field the original finding named.
  it('renders a malicious proposal title inert', () => {
    const title = 'Big deal"><img src=x onerror=alert(document.cookie)>'
    const out = html`<strong>${title}</strong>`
    expect(out).not.toMatch(/<img/)
    expect(out).toContain('&lt;img')
  })
})

describe('safeUrl', () => {
  it('permits http, https and mailto', () => {
    expect(safeUrl('https://podium.app/x')).toBe('https://podium.app/x')
    expect(safeUrl('http://podium.app')).toBe('http://podium.app')
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
  })

  it('rejects javascript: and data: URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#')
    expect(safeUrl('data:text/html,<script>')).toBe('#')
    expect(safeUrl('  JavaScript:alert(1)')).toBe('#')
  })
})
