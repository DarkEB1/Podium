import Link from 'next/link'

const links = [
  { label: 'About', href: '#about' },
  { label: 'Trust & Safety', href: '#trust' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: 'mailto:hello@podium.com' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
]

export default function Footer() {
  return (
    <footer className="border-t bg-background py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-6">
          <span className="text-xl font-bold tracking-tight">Podium</span>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Podium. All rights reserved. Confidential &amp; Proprietary.
          </p>
        </div>
      </div>
    </footer>
  )
}
