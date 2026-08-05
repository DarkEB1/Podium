import Link from 'next/link'
import PodiumMark from '@/components/brand/podium-mark'

const FOOTER_LINKS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Cookies', href: '/cookies' },
]

export default function BuildPanel() {
  return (
    <section aria-labelledby="build-heading" className="flex h-full flex-col justify-end px-6 pb-[18vh] pt-24 md:px-16">
      <div className="max-w-2xl rounded-2xl bg-foreground p-10 text-background">
        <PodiumMark height={28} limeTop className="text-background" />
        <h2 id="build-heading" className="mt-5 font-heading text-large font-extrabold">
          Your spot is open.
        </h2>
        <Link
          href="/role-select"
          className="mt-6 inline-block rounded-xl bg-primary px-7 py-3.5 text-medium font-bold text-primary-foreground"
        >
          Build your profile
        </Link>
      </div>
      <nav aria-label="Footer" className="mt-8 flex flex-wrap items-center gap-6">
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-small font-medium text-muted-foreground underline-offset-4 hover:underline">
            {l.label}
          </Link>
        ))}
        <span className="font-mono text-small uppercase tracking-[.15em] text-muted-foreground">
          © 2026 PODIUM
        </span>
      </nav>
    </section>
  )
}
