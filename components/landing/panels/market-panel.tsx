import MarketSkyline from '@/components/landing/market-skyline'
import MarketRally from '@/components/landing/market-rally'

export default function MarketPanel({ variant }: { variant: 'skyline' | 'rally' }) {
  return (
    <section aria-labelledby="market-heading" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      <h2 id="market-heading" className="mb-6 font-heading text-large font-extrabold text-foreground">
        The marketplace, live
      </h2>
      {variant === 'rally' ? <MarketRally /> : <MarketSkyline />}
      <ul className="mt-6 flex flex-wrap gap-2" aria-label="What members say">
        <li className="rounded-full border border-border bg-card px-4 py-2 text-small font-medium text-foreground">
          &ldquo;Signed my first sponsor in 3 weeks&rdquo; — athlete
        </li>
        <li className="rounded-full border border-border bg-card px-4 py-2 text-small font-medium text-foreground">
          &ldquo;Found 4 grassroots partners&rdquo; — brand
        </li>
      </ul>
    </section>
  )
}
