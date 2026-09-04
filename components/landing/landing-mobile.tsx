import type { ReactNode } from 'react'
import Link from 'next/link'
import PodiumMark from '@/components/brand/podium-mark'
import { ROUTES } from '@/lib/routes'
import WordChip from './stage/word-chip'
import Chip from './stage/chip'
import { MobileMenu, type MenuItem } from './stage/stage-nav'
import { FIXTURES, type MarketFixture } from './stage/market-fixtures'

// Phone/tablet-portrait landing (WS-LANDING-01). The desktop corridor lays its
// four panels out in a fixed 400vw track with vw/vh-positioned overlays and has
// no breakpoint below md, so every phone width collapsed into overlapping,
// clipped text. Rather than retro-fit a hundred absolute offsets, we tell the
// same story as an ordinary vertical document below md: it flows, wraps and
// scrolls like any page, so nothing can overlap or run off the edge. Rendered
// with `md:hidden` beside the `hidden md:block` corridor in app/page.tsx.

// The brand glyph: a podium bar's corner rounding (top-left 60% of a nominal
// width, the rest tight), reused on the cards and step markers so the stack
// reads as the same product as the corridor.
const CARD_RADIUS = '22px 7px 7px 7px'
const CHIP_RADIUS_SM = '14px 4px 4px 4px'

const MENU_ITEMS: MenuItem[] = [
  { label: 'Marketplace', href: '#market' },
  { label: 'How it works', href: '#what-we-do' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Sign in', href: '/auth' },
]

const STEPS = [
  {
    n: '01',
    title: 'Build your profile',
    lines: ['Free for athletes and clubs.', 'Your sport, your story, your numbers.'],
  },
  {
    n: '02',
    title: 'Set your offer',
    lines: ['Deliverables, price, season.', 'Sponsors see exactly what they get.'],
  },
  {
    n: '03',
    title: 'Sign and get paid',
    lines: ['Agree and sign in one place.', 'Payments powered by Stripe.'],
  },
]

// A quiet mono micro-label. Kept at 11px+ so it stays legible on a phone (the
// corridor's 10.5px labels were flagged for legibility on small screens).
function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[.14em] text-foreground">
      <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
      {children}
    </p>
  )
}

function SampleCard({ fixture }: { fixture: MarketFixture }) {
  return (
    <div
      className="border-[1.5px] border-foreground bg-card p-4"
      style={{ borderRadius: CARD_RADIUS }}
    >
      <p className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
        <span>{fixture.role}</span>
        <span>Sample</span>
      </p>
      <p className="mt-2 font-heading text-[19px] font-extrabold leading-tight text-foreground">
        {fixture.title}
      </p>
      <p className="mt-1 text-[14px] font-light text-muted-foreground">
        {fixture.level} · {fixture.region}
      </p>
      <p className="mt-3 border-t border-foreground/10 pt-3 font-mono text-[12px] uppercase tracking-[.12em] text-foreground">
        Asks from £{fixture.asksFrom} / season
      </p>
      <ul className="mt-2 space-y-1.5 text-[14px] font-light text-muted-foreground">
        {fixture.gets.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-[9px] inline-block h-[3px] w-3 shrink-0 bg-lime" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function LandingMobile({ className }: { className?: string }) {
  // Three archetype cards is enough to show the range without turning the
  // section into a scroll of its own.
  const cards = FIXTURES.slice(0, 3)

  return (
    <div className={className} data-testid="landing-stack">
      {/* sticky header */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-foreground/8 bg-background/95 px-5 backdrop-blur">
        <Link
          href="/"
          aria-label="Podium, back to top"
          className="flex items-center gap-2.5 text-foreground"
        >
          <PodiumMark height={26} limeTop className="text-foreground" />
          <span className="font-heading text-[18px] font-extrabold tracking-tight">Podium</span>
        </Link>
        <span className="flex-1" />
        <Link
          href={ROUTES.auth.signUp}
          className="flex h-9 items-center rounded-xl bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8]"
        >
          Join free
        </Link>
        <MobileMenu items={MENU_ITEMS} />
      </header>

      <main>
        {/* hero */}
        <section className="px-5 pb-14 pt-12">
          <Kicker>Sports sponsorship marketplace</Kicker>
          <h1
            className="mt-6 font-heading font-extrabold text-foreground"
            style={{
              fontSize: 'clamp(42px, 13vw, 68px)',
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
            }}
          >
            <span className="block">Sponsorship</span>
            <span className="block">
              for <WordChip />
            </span>
          </h1>
          <p className="mt-6 max-w-[34ch] text-[16px] font-light leading-relaxed text-muted-foreground">
            Offers listed, deals signed, money paid, all in one place. Free for
            athletes and clubs.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4">
            <Link
              href={ROUTES.auth.signUp}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-primary px-8 text-[16px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8] sm:w-auto"
            >
              Get on the podium
            </Link>
            <Link
              href="#what-we-do"
              className="text-[16px] font-medium text-primary underline-offset-4 hover:underline"
            >
              See how it works <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </section>

        {/* marketplace */}
        <section id="market" className="scroll-mt-20 border-t border-border px-5 py-14">
          <Kicker>Marketplace</Kicker>
          <h2
            className="mt-5 font-heading font-extrabold text-foreground"
            style={{ fontSize: 'clamp(30px, 9vw, 44px)', lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            Every profile is a <Chip>podium</Chip>.
          </h2>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
            Every card is a live profile
          </p>
          <div className="mt-5 flex flex-col gap-4">
            {cards.map((fixture) => (
              <SampleCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </section>

        {/* what we do — a real three-step sequence, so numbered markers fit */}
        <section id="what-we-do" className="scroll-mt-20 border-t border-border px-5 py-14">
          <Kicker>What we do</Kicker>
          <h2
            className="mt-5 font-heading font-extrabold text-foreground"
            style={{ fontSize: 'clamp(30px, 9vw, 44px)', lineHeight: 1, letterSpacing: '-0.03em' }}
          >
            Help you from profile to <Chip>paid</Chip>.
          </h2>
          <ol className="mt-8 flex flex-col gap-8">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center bg-lime font-heading text-[16px] font-extrabold text-lime-foreground"
                  style={{ borderRadius: CHIP_RADIUS_SM }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="font-heading text-[20px] font-bold text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] font-light leading-relaxed text-muted-foreground">
                    {s.lines[0]}
                    <span className="block">{s.lines[1]}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* finale */}
        <section className="border-t border-border px-5 py-14">
          <Kicker>Your spot</Kicker>
          <h2
            className="mt-5 font-heading font-extrabold text-foreground"
            style={{ fontSize: 'clamp(38px, 12vw, 60px)', lineHeight: 0.95, letterSpacing: '-0.035em' }}
          >
            The podium has room for <Chip tone="lime">you</Chip>.
          </h2>
          <div className="mt-8 flex flex-col items-start gap-4">
            <Link
              href={ROUTES.auth.signUp}
              className="flex h-14 w-full items-center justify-center rounded-xl bg-primary px-8 text-[16px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8] sm:w-auto"
            >
              Claim your spot
            </Link>
            <Link
              href={ROUTES.contact}
              className="text-[16px] font-medium text-primary underline-offset-4 hover:underline"
            >
              Talk to us <span aria-hidden="true">▸</span>
            </Link>
          </div>
          <p className="mt-6 text-[14px] font-light text-muted-foreground">
            Founding spots are open. Free for athletes and clubs. No card required.
          </p>
        </section>

        {/* footer */}
        <footer className="border-t border-border px-5 py-10">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[.14em]">
            <Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href={ROUTES.contact} className="text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </Link>
            <Link href="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <p className="mt-5 text-[12px] font-light leading-relaxed text-muted-foreground/80">
            © 2026 Podium. Podium is an introduction platform and is not a party
            to agreements made between brands and athletes or teams.
          </p>
        </footer>
      </main>
    </div>
  )
}
