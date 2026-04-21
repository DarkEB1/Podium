import Hero from '@/components/landing/hero'
import HowItWorks from '@/components/landing/how-it-works'
import MarketplacePreview from '@/components/landing/marketplace-preview'
import RolePanels from '@/components/landing/role-panels'
import SocialProof from '@/components/landing/social-proof'
import FAQ from '@/components/landing/faq'
import Footer from '@/components/layout/footer'

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
