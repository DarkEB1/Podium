/**
 * Web Push transport (RFC 8291 payload encryption + RFC 8292 VAPID), built on
 * Web Crypto with no dependency (2.4-era zero-dep ethos). VAPID keys are
 * self-generated (no third-party account), so this is fully self-contained.
 *
 * NOTE: the encryption here follows the RFCs but cannot be exercised end to end
 * without VAPID keys and a real browser push service; smoke-test a live send
 * once VAPID_* are set before relying on push in production.
 */

// All byte producers return Uint8Array<ArrayBuffer> (not ...<ArrayBufferLike>)
// so Web Crypto accepts them as BufferSource without a cast.
function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const len = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(new ArrayBuffer(len))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function utf8(s: string): Uint8Array<ArrayBuffer> {
  const e = new TextEncoder().encode(s)
  const out = new Uint8Array(new ArrayBuffer(e.length))
  out.set(e)
  return out
}

export interface PushKeys {
  p256dh: string
  auth: string
}

/** Build the RFC 8292 VAPID Authorization header value for an endpoint. */
export async function vapidAuthHeader(
  endpoint: string,
  subject: string,
  publicKeyB64url: string,
  privateKeyB64url: string
): Promise<string> {
  const origin = new URL(endpoint).origin
  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToB64url(
    utf8(JSON.stringify({ aud: origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject }))
  )
  const signingInput = `${header}.${payload}`

  const pub = b64urlToBytes(publicKeyB64url) // 65 bytes: 0x04 || x || y
  const d = b64urlToBytes(privateKeyB64url) // 32-byte scalar
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(d),
    ext: true,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signingInput))
  const jwt = `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`
  return `vapid t=${jwt}, k=${publicKeyB64url}`
}

async function hkdf(
  ikm: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

/** Encrypt a payload for a subscription per RFC 8291 (aes128gcm). */
export async function encryptPayload(payload: Uint8Array, keys: PushKeys): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(keys.p256dh) // 65 bytes
  const authSecret = b64urlToBytes(keys.auth)

  // Ephemeral server ECDH key.
  const server = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey)) // 65 bytes

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, server.privateKey, 256)
  const ecdhSecret = new Uint8Array(sharedBits)

  // RFC 8291 §3.4: combine to the input keying material.
  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32)

  // RFC 8188 content encryption keys.
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(ikm, salt, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(ikm, salt, utf8('Content-Encoding: nonce\0'), 12)

  // Single record: payload || 0x02 delimiter (last record, no padding).
  const record = concat(payload, new Uint8Array([0x02]))
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record)
  )

  // Header: salt(16) || rs(4, =4096) || idlen(1, =65) || keyid(as_public, 65).
  const rs = new Uint8Array([0, 0, 0x10, 0x00])
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic)
  return concat(header, ciphertext)
}

export type WebPushResult =
  | { ok: true }
  | { ok: false; expired: true }
  | { ok: false; error: string }

/** Deliver one already-encrypted body to a push endpoint. */
export async function postToEndpoint(endpoint: string, body: Uint8Array, authHeader: string): Promise<WebPushResult> {
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        TTL: '2419200',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: authHeader,
      },
      body: body as BodyInit,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network error' }
  }
  if (res.ok) return { ok: true }
  if (res.status === 404 || res.status === 410) return { ok: false, expired: true }
  const detail = await res.text().catch(() => '')
  return { ok: false, error: `push ${res.status}: ${detail.slice(0, 200)}` }
}
