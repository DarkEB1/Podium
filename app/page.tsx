import HorizontalTrack from '@/components/landing/horizontal-track'
import HeroPanel from '@/components/landing/panels/hero-panel'
import MarketPanel from '@/components/landing/panels/market-panel'
import WhatWeDoPanel from '@/components/landing/panels/what-we-do-panel'
import RolesPanel from '@/components/landing/panels/roles-panel'
import BuildPanel from '@/components/landing/panels/build-panel'
import { siteUrl } from './sitemap'

// M-1: per-route metadata. This page is public and indexable — see app/sitemap.ts.
export const metadata = {
  // Resolves the relative canonical/openGraph URLs below against the deployed
  // origin (from the validated env), so shared links are absolute.
  metadataBase: new URL(siteUrl()),
  title: 'Podium: the sponsorship marketplace for athletes, teams and brands',
  description:
    'Podium connects athletes, teams and agents with the brands that want to back them. Build a profile, get discovered, agree the deal and get paid, all in one place.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Podium',
    title: 'Podium: the sponsorship marketplace for athletes, teams and brands',
    description:
      'Get discovered by the brands that want to back you. Free forever for athletes, teams and agents.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Podium: the sponsorship marketplace',
    description: 'Where athletes, teams and brands find each other.',
  },
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>
}) {
  // Two marketplace variants ship to staging; the winner is chosen in
  // implementation review and the loser deleted (spec: page structure).
  const { market } = await searchParams
  const variant = market === 'rally' ? 'rally' : 'skyline'
  return (
    // landing-light: this page is art-directed light-only (locked palette);
    // the scope re-declares the light tokens so a system-dark visitor still
    // sees the approved cold-white design. App dashboards keep dark mode.
    <main className="landing-light bg-background text-foreground">
      <a
        href="#hero-heading"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <HorizontalTrack>
        <HeroPanel />
        <MarketPanel variant={variant} />
        <WhatWeDoPanel />
        <RolesPanel />
        <BuildPanel />
      </HorizontalTrack>
    </main>
  )
}
