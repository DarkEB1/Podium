import Hero from '@/components/landing/hero'
import HowItWorks from '@/components/landing/how-it-works'
import MarketplacePreview from '@/components/landing/marketplace-preview'
import RolePanels from '@/components/landing/role-panels'
import SocialProof from '@/components/landing/social-proof'
import FAQ from '@/components/landing/faq'
import Footer from '@/components/layout/footer'
import { siteUrl } from './sitemap'

// M-1: per-route metadata. This page is public and indexable — see app/sitemap.ts.
export const metadata = {
  // Resolves the relative canonical/openGraph URLs below against the deployed
  // origin (from the validated env), so shared links are absolute.
  metadataBase: new URL(siteUrl()),
  title: 'Podium — the sponsorship marketplace for athletes, teams and brands',
  description:
    'Podium connects athletes, teams and agents with the brands that want to back them. Build a profile, get discovered, agree the deal and get paid — in one place.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Podium',
    title: 'Podium — the sponsorship marketplace for athletes, teams and brands',
    description:
      'Get discovered by the brands that want to back you. Free forever for athletes, teams and agents.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Podium — the sponsorship marketplace',
    description: 'Where athletes, teams and brands find each other.',
  },
}

export default function Home() {
  return (
    <main>
      <Hero />
      <SocialProof />
      <HowItWorks />
      <MarketplacePreview />
      <RolePanels />
      <FAQ />
      <Footer />
    </main>
  )
}
