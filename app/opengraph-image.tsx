import { ImageResponse } from 'next/og'

/**
 * WS-INFRA P2 — the shared social-share image.
 *
 * Home declared `twitter:card = summary_large_image` while no page provided an
 * image, so every link preview (WhatsApp, LinkedIn, X, Slack, iMessage) fell
 * back to a blank card or a scraped favicon. This file-convention route lives at
 * the app root, so Next attaches `og:image` to every route's metadata; the
 * sibling `twitter-image.tsx` re-exports it for `twitter:image`.
 *
 * Rendered with `next/og` (no external fonts or asset fetches — both are blocked
 * on the edge and would fail the build), on the brand's dark ground with the
 * lime accent, so it never depends on a static file that could go missing.
 */
export const runtime = 'edge'

export const alt =
  'Podium — the sponsorship marketplace for athletes, teams and brands'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand tokens, mirrored from app/icon.svg / globals.css.
const INK = '#17181A'
const LIME = '#C1EC2F'
const MUTED = '#9CA3A01A'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* The podium mark: three bars, tallest lime — mirrors app/icon.svg. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px' }}>
          <div style={{ width: 44, height: 74, borderRadius: 14, background: '#FFFFFF' }} />
          <div style={{ width: 44, height: 116, borderRadius: 14, background: '#FFFFFF' }} />
          <div style={{ width: 44, height: 158, borderRadius: 14, background: LIME }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.02,
            }}
          >
            Podium
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 40,
              fontWeight: 500,
              color: '#E5E7EB',
              maxWidth: 940,
              lineHeight: 1.15,
            }}
          >
            The sponsorship marketplace for athletes, teams and brands.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            color: LIME,
            borderTop: `1px solid ${MUTED}`,
            paddingTop: 28,
          }}
        >
          podiumsponsorship.com
        </div>
      </div>
    ),
    size,
  )
}
