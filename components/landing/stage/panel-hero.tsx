import Link from 'next/link'
import WordChip from './word-chip'

// Panel 01 · Hero (build spec v3 §3). Static composition first (build step 1):
// the chip is static, the domino volumes are dashed placeholders that the 3D
// pieces replace in build step 4. Everything "standing" bottoms out at 72vh.
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
          top: '17vh',
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

      {/* CTA row standing on the baseline */}
      <div
        className="absolute flex items-center gap-6"
        style={{ left: 'var(--margin-x)', bottom: '28vh' }}
      >
        <Link
          href="/role-select"
          className="flex h-14 items-center rounded-xl bg-foreground px-7 text-[16px] font-medium text-background"
        >
          Get on the podium
        </Link>
        <a href="#what-we-do" className="text-[16px] font-medium text-primary">
          See how it works <span aria-hidden="true">▸</span>
        </a>
        <p
          className="max-w-[30ch] font-light text-muted-foreground"
          style={{ fontSize: 'var(--body-size)', lineHeight: 1.55 }}
        >
          Free for athletes and clubs. Brands pay when they sponsor.
        </p>
      </div>

      {/* 3D domino volumes — dashed placeholders until the canvas lands */}
      {DOMINOES.map((d) => (
        <div
          key={d.n}
          aria-hidden="true"
          className="absolute border-[1.5px] border-dashed border-foreground/20"
          style={{
            left: `${d.center - d.w / 2}vw`,
            width: `${d.w}vw`,
            height: `${d.h}vh`,
            bottom: '28vh',
            borderRadius: `calc(${d.w}vw * 0.6) calc(${d.w}vw * 0.12) calc(${d.w}vw * 0.12) calc(${d.w}vw * 0.12)`,
          }}
        >
          <span className="absolute bottom-2 right-2 font-mono text-[10.5px] text-foreground/30">
            {d.n}
          </span>
        </div>
      ))}

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
          style={{ left: `${d.center}vw`, top: 'calc(72vh + 12px)' }}
        >
          {d.caption}
        </span>
      ))}
    </section>
  )
}
