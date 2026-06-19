'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Compass,
  Handshake,
  LayoutList,
  MessageSquare,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import NotificationBell from './notification-bell'
import ThemeToggle from './theme-toggle'

type Role = 'athlete' | 'brand' | 'team' | 'agent'

interface NavShellProps {
  role: Role
  children: React.ReactNode
}

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

interface RoleCta {
  label: string
  href: string
}

// Exactly four top-level items per role (spec §2.5). GL3 may refine wording;
// the shape (4 items + role CTA + bottom nav + breadcrumbs) is fixed here.
const NAV_ITEMS: Record<Role, NavItem[]> = {
  athlete: [
    { label: 'Discover', href: '/athlete/discover', icon: Compass },
    { label: 'Messages', href: '/athlete/messages', icon: MessageSquare },
    { label: 'Deals', href: '/athlete/deals', icon: Handshake },
    { label: 'Profile', href: '/athlete/profile', icon: User },
  ],
  brand: [
    { label: 'Discover', href: '/brand/discover', icon: Compass },
    { label: 'Listings', href: '/brand/listings', icon: LayoutList },
    { label: 'Deals', href: '/brand/deals', icon: Handshake },
    { label: 'Messages', href: '/brand/messages', icon: MessageSquare },
  ],
  team: [
    { label: 'Discover', href: '/team/discover', icon: Compass },
    { label: 'Listings', href: '/team/listings', icon: LayoutList },
    { label: 'Messages', href: '/team/messages', icon: MessageSquare },
    { label: 'Profile', href: '/team/profile', icon: User },
  ],
  agent: [
    { label: 'Discover', href: '/agent/discover', icon: Compass },
    { label: 'Clients', href: '/agent/clients', icon: Users },
    { label: 'Messages', href: '/agent/messages', icon: MessageSquare },
    { label: 'Profile', href: '/agent/profile', icon: User },
  ],
}

// Persistent, role-appropriate primary action shown top-right (and last in
// the mobile bottom nav slot is the CTA-equivalent destination).
const ROLE_CTA: Record<Role, RoleCta> = {
  athlete: { label: 'Edit Profile', href: '/athlete/profile/edit' },
  brand: { label: 'Post a Listing', href: '/brand/listings/new' },
  team: { label: 'Post a Listing', href: '/team/listings/new' },
  agent: { label: 'Add Client', href: '/agent/clients/new' },
}

function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function humanise(segment: string): string {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function NavShell({ role, children }: NavShellProps) {
  const pathname = usePathname()
  const items = NAV_ITEMS[role]
  const cta = ROLE_CTA[role]

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((segment, i) => ({
    label: humanise(segment),
    href: `/${segments.slice(0, i + 1).join('/')}`,
  }))

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 md:px-16">
          <Link
            href={`/${role}/discover`}
            className="mr-6 font-heading text-xl font-extrabold tracking-tight text-foreground"
          >
            Podium
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {items.map((item) => {
              const active = isActiveHref(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    active && 'bg-primary/10 font-semibold text-primary',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Link
              href={cta.href}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}
            >
              {cta.label}
            </Link>
          </div>
        </div>
        {crumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mx-auto hidden max-w-7xl px-6 pb-3 md:block md:px-16"
          >
            <ol className="flex items-center gap-1 text-small text-muted-foreground">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1
                return (
                  <li key={crumb.href} className="flex items-center gap-1">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {isLast ? (
                      <span aria-current="page" className="text-foreground">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-foreground">
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}
      </header>

      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom navigation: the four top-level destinations as icons. */}
      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        {items.map((item) => {
          const active = isActiveHref(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-2 text-small',
                active
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
