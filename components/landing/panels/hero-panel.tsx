import Link from 'next/link'
import RotatingWord from '@/components/landing/rotating-word'
import DominoSteps from '@/components/landing/domino-steps'

export default function HeroPanel() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex h-full items-end justify-between gap-14 px-6 pb-[30vh] pt-24 md:px-16"
    >
      {/* QA: the page had no wordmark and no way back in for returning users —
          "logo top-left leads nowhere" must never regress into "no logo". */}
      <div className="absolute left-6 top-6 z-10 flex w-[calc(100vw-3rem)] items-center justify-between md:left-16 md:w-[calc(100vw-8rem)]">
        <Link
          href="/"
          aria-label="Podium home"
          className="font-heading text-xl font-extrabold tracking-tight text-foreground"
        >
          Podium
        </Link>
        <Link href="/auth" className="text-medium font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>
      </div>
      <div className="max-w-xl">
        <p className="mb-4 font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
          SPONSORSHIP MARKETPLACE
        </p>
        <h1 id="hero-heading" className="font-heading text-display font-extrabold tracking-tight text-foreground">
          The podium has room for <RotatingWord words={['athletes', 'teams', 'brands', 'you']} />
        </h1>
        <p className="mt-4 max-w-md text-medium font-light text-muted-foreground">
          Build a profile, get discovered, agree the deal and get paid. Athletes, teams and brands,
          all in one place.
        </p>
        <div className="mt-7 flex items-center gap-3">
          <Link
            href="/role-select"
            className="rounded-xl bg-primary px-7 py-3.5 text-medium font-bold text-primary-foreground"
          >
            Get on the podium
          </Link>
          <Link href="#what-we-do" className="px-3 py-3.5 text-medium font-medium text-primary underline underline-offset-4">
            How it works
          </Link>
        </div>
      </div>
      <div className="hidden md:block">
        <DominoSteps />
      </div>
    </section>
  )
}
