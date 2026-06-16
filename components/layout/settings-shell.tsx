import Link from 'next/link'
import { cn } from '@/lib/utils'

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
        'mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[16rem_1fr]',
        className,
      )}
    >
      <nav aria-label="Settings sections">
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {sections.map((section) => {
            const isActive = section.id === active
            return (
              <li key={section.id}>
                <Link
                  href={`#${section.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'block rounded-[var(--radius)] px-3 py-2 text-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-muted font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {section.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
