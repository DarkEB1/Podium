import MarketSkyline from '@/components/landing/market-skyline'
import MarketRally from '@/components/landing/market-rally'

export default function MarketPanel({ variant }: { variant: 'skyline' | 'rally' }) {
  return (
    <section aria-labelledby="market-heading" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      {/* M-2: no invented member quotes and no "live" claim on a pre-launch
          product — fabricated social proof is a misleading commercial practice
          (CPRs), the same class of issue scrubbed from the old hero. */}
      <h2 id="market-heading" className="mb-6 font-heading text-large font-extrabold text-foreground">
        The marketplace
      </h2>
      {variant === 'rally' ? <MarketRally /> : <MarketSkyline />}
      <p className="mt-6 max-w-md text-small text-muted-foreground">
        Illustration of how discovery works. Create a free account to browse
        the real marketplace.
      </p>
    </section>
  )
}
