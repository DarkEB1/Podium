/**
 * HTML escaping for transactional email (B-8 / SEC-1).
 *
 * The original audit flagged "email template stored XSS via proposal title".
 * At the time there was no email layer, so the finding was not actionable. This
 * layer makes it live: proposal titles, display names, message previews and
 * every other piece of user-supplied text now get rendered into HTML that lands
 * in a mail client. A mail client is a hostile rendering target — it executes
 * some HTML, follows some links, and a crafted display name like
 * `<img src=x onerror=...>` or `</td></table>...` can break layout or worse.
 *
 * The rule this module enforces: **user content is only ever inserted via
 * `escapeHtml`.** Templates never interpolate a raw string into markup. The
 * `html` tagged-template helper makes that the path of least resistance — its
 * interpolations are escaped by default, and the only way to inject trusted
 * markup is the explicit `raw()` marker, which is easy to grep for in review.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
}

/**
 * Escape a string for insertion into HTML text or a double-quoted attribute.
 * Also escapes backtick and equals, which matter in unquoted-attribute contexts
 * that some mail clients tolerate. Non-strings are coerced first so a stray
 * number/null cannot slip through as `[object Object]` or throw.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"'`=]/g, (char) => HTML_ESCAPES[char] ?? char)
}

/** Marker for a pre-trusted HTML fragment (a template composing other escaped parts). */
class RawHtml {
  constructor(public readonly value: string) {}
}

/** Wrap a string the caller guarantees is already safe HTML. Grep-able in review. */
export function raw(value: string): RawHtml {
  return new RawHtml(value)
}

/**
 * Tagged template that escapes every interpolation by default. Pass a `raw(...)`
 * value to inject trusted markup (e.g. an inner template's already-escaped
 * output). Arrays are joined after escaping each element.
 *
 *   html`<h1>${userName}</h1>`            // userName is escaped
 *   html`<div>${raw(renderButton(...))}</div>` // renderButton output trusted
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = strings[0] ?? ''
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (value instanceof RawHtml) {
      out += value.value
    } else if (Array.isArray(value)) {
      out += value.map((v) => (v instanceof RawHtml ? v.value : escapeHtml(v))).join('')
    } else {
      out += escapeHtml(value)
    }
    out += strings[i + 1] ?? ''
  }
  return out
}

/**
 * A URL fit for an href. Permits only http(s) and mailto so a `javascript:` or
 * `data:` URL from user-influenced input can never become a live link. Returns
 * '#' for anything rejected.
 */
export function safeUrl(value: unknown): string {
  const url = String(value ?? '').trim()
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url
  return '#'
}

/**
 * A URL escaped for insertion into a double-quoted `href`.
 *
 * Deliberately NOT `escapeHtml`: that escapes `=` and backtick, which turns a
 * perfectly good query string (`?token=abc&x=1`) into `?token&#61;abc&amp;x&#61;1`
 * — valid HTML that decodes correctly, but ugly and needlessly reliant on every
 * mail client decoding numeric entities in attributes. Inside a quoted
 * attribute only `&`, `"`, `<` and `>` are significant, so we escape exactly
 * those (and `&` first, or we'd double-escape our own entities). The URL is
 * validated by `safeUrl` before it reaches here.
 */
export function hrefAttr(value: unknown): string {
  return safeUrl(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
