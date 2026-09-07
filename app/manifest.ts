import type { MetadataRoute } from 'next'

/**
 * WS-INFRA-01 — web app manifest, served at `/manifest.webmanifest`.
 *
 * `/manifest.webmanifest` (and `/manifest.json`) previously 307'd to `/auth`
 * because no route served it and the middleware matcher does not exclude it.
 * Providing a real manifest gives the install/add-to-home-screen affordance a
 * name, theme colour and icons, and the middleware now lists the path as public.
 *
 * Icons reuse the existing `app/icon.svg` (the podium mark) and `favicon.ico`
 * rather than introducing new PNG assets. `theme_color` is the brand lime; the
 * background matches the light marketing ground.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Podium — Sponsorship Marketplace',
    short_name: 'Podium',
    description:
      'The sponsorship marketplace connecting athletes, teams and agents with the brands that want to back them.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#C1EC2F',
    icons: [
      {
        src: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: '/favicon.ico',
        type: 'image/x-icon',
        sizes: '256x256',
      },
    ],
  }
}
