import Link from 'next/link'
import { cn } from '@/lib/utils'
import SignOutButton from '@/components/auth/sign-out-button'
import { AccentHeading } from '@/components/ui/accent-heading'

interface SettingsShellProps {
  sections: { id: string; label: string }[]
  active: string
  children: React.ReactNode
  className?: string
}

/**
 * SettingsShell — two-column settings layout (spec §10.2.3): a left section
 * nav and a right content column. Sections link via hash to allow deep-linking;
 * the active section is marked with aria-current.
 *
 * Clean Airbnb: a single light divider rule separates the two columns on
 * desktop, and the active section carries a subtle primary accent (soft fill +
 * weight) — no ink border ring.
 */
export default function SettingsShell({
  sections,
  active,
  children,
  className,
}: SettingsShellProps) {
  return (
    <div
      className={cn(
        'mx-auto max-w-7xl px-6 py-12 md:px-16 md:py-16',
        className,
      )}
    >
      <AccentHeading as="h1" className="text-display">Settings</AccentHeading>
      <div className="mt-10 grid gap-10 md:grid-cols-[16rem_1fr]">
        <nav
          aria-label="Settings sections"
          className="md:border-r md:border-border md:pr-10"
        >
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {sections.map((section) => {
            const isActive = section.id === active
            return (
              <li key={section.id}>
                <Link
                  href={`#${section.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'block rounded-xl px-3 py-2 text-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {section.label}
                </Link>
              </li>
            )
          })}
          </ul>
          {/* PR-15: sign out is reachable from every role's settings page. */}
          <div className="mt-6 border-t border-border pt-6 md:mt-8 md:pt-8">
            <SignOutButton variant="outline" className="w-full justify-center" />
          </div>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
