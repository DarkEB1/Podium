'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import NotificationBell from './notification-bell'
import ThemeToggle from './theme-toggle'

interface NavLink { label: string; href: string }

interface NavShellProps {
  role: 'athlete' | 'team' | 'brand' | 'agent' | 'admin'
  children: React.ReactNode
}

const NAV_LINKS: Record<NavShellProps['role'], NavLink[]> = {
  athlete: [
    { label: 'Dashboard', href: '/athlete/dashboard' },
    { label: 'Discover', href: '/athlete/discover' },
    { label: 'Saved', href: '/athlete/saved' },
    { label: 'Requests', href: '/athlete/requests' },
    { label: 'Messages', href: '/athlete/messages' },
    { label: 'Deals', href: '/athlete/deals' },
  ],
  team: [
    { label: 'Dashboard', href: '/team/dashboard' },
    { label: 'Discover', href: '/team/discover' },
    { label: 'Messages', href: '/team/messages' },
  ],
  brand: [
    { label: 'Dashboard', href: '/brand/dashboard' },
    { label: 'Discover', href: '/brand/discover' },
    { label: 'Listings', href: '/brand/listings' },
    { label: 'Messages', href: '/brand/messages' },
    { label: 'Deals', href: '/brand/deals' },
  ],
  agent: [
    { label: 'Dashboard', href: '/agent/dashboard' },
    { label: 'Clients', href: '/agent/clients' },
    { label: 'Discover', href: '/agent/discover' },
    { label: 'Messages', href: '/agent/messages' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Athletes', href: '/admin/athletes' },
    { label: 'Brands', href: '/admin/brands' },
    { label: 'Listings', href: '/admin/listings' },
    { label: 'Users', href: '/admin/users' },
  ],
}

export default function NavShell({ role, children }: NavShellProps) {
  const pathname = usePathname()
  const links = NAV_LINKS[role]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href={`/${role}/dashboard`} className="mr-4 text-lg font-bold tracking-tight">
            Podium
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  pathname === l.href && 'bg-muted font-semibold'
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Link
              href={`/${role}/settings`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Settings
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
