import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight md:text-7xl">
          The Sports Sponsorship<br />
          <span className="text-primary">Marketplace</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground md:text-xl">
          Athletes and teams list for free. Brands search, connect, and close deals.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/auth/signup" className={buttonVariants({ size: 'lg' })}>
            List Your Profile
          </Link>
          <Link href="/auth/signup" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Find Talent
          </Link>
        </div>
      </div>
    </section>
  )
}
