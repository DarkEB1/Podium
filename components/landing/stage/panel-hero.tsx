import Link from 'next/link'
import WordChip from './word-chip'

// Panel 01 · Hero (build spec v3 §3, recomposed 2026-08-10). Reading order is
// a single left rail: kicker → headline → one primary action. Nothing rests on
// the floor line except the dominoes; the CTA block keeps 6vh of air above it.
const DOMINOES = [
  { center: 54, w: 6, h: 20, caption: 'PROFILE', n: '3' },
  { center: 67, w: 6.5, h: 29, caption: 'OFFER', n: '2' },
  { center: 81.5, w: 7, h: 40, caption: 'DEAL', n: '1' },
]

export default function PanelHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative h-screen w-screen shrink-0"
      data-panel="01"
    >
      {/* kicker */}
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        PODIUM · SPORTS SPONSORSHIP MARKETPLACE · PRE-LAUNCH
      </p>

      {/* stepped headline */}
      <h1
        id="hero-heading"
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-xl)',
          lineHeight: 0.92,
          letterSpacing: '-0.035em',
        }}
      >
        <span className="block">The podium</span>
        <span className="block" style={{ marginLeft: 'var(--col)' }}>
          has room
        </span>
        <span className="block">
          for <WordChip />
        </span>
      </h1>

      {/* one clear action: primary → quiet secondary → small print */}
      <div
        className="absolute flex flex-col gap-4"
        style={{ left: 'var(--margin-x)', bottom: '26vh' }}
      >
        <div className="flex items-center gap-7">
          <Link
            href="/role-select"
            className="flex h-14 items-center rounded-xl bg-primary px-8 text-[16px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8]"
          >
            Get on the podium
          </Link>
          <a
            href="#what-we-do"
            className="text-[16px] font-medium text-primary underline-offset-4 hover:underline"
          >
            See how it works <span aria-hidden="true">▸</span>
          </a>
        </div>
        <p className="text-[13.5px] font-light text-muted-foreground">
          Free for athletes and clubs. Brands pay when they sponsor.
        </p>
      </div>

      {/* FIG annotation */}
      <p
        aria-hidden="true"
        className="absolute font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/60"
        style={{ left: '76vw', top: '13vh' }}
      >
        FIG. 01 · THE CASCADE
      </p>

      {/* floor captions (sub-baseline) */}
      {DOMINOES.map((d) => (
        <span
          key={d.caption}
          aria-hidden="true"
          className="absolute -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground/40"
          style={{ left: `${d.center}vw`, top: 'calc(var(--floor-y) + 12px)' }}
        >
          {d.caption}
        </span>
      ))}
    </section>
  )
}
