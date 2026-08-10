import Stage from '@/components/landing/stage/stage'
import PanelHero from '@/components/landing/stage/panel-hero'
import PanelMarket from '@/components/landing/stage/panel-market'
import PanelWhat from '@/components/landing/stage/panel-what'
import PanelRoles from '@/components/landing/stage/panel-roles'
import PanelFinale from '@/components/landing/stage/panel-finale'
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

export default function Home() {
  return (
    // landing-light: this page is art-directed light-only (spec amendment);
    // system dark mode must not restyle it.
    <main className="landing-light bg-background text-foreground">
      <Stage>
        <PanelHero />
        <PanelMarket />
        <PanelWhat />
        <PanelRoles />
        <PanelFinale />
      </Stage>
    </main>
  )
}
