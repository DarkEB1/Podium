'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { SPRING } from '@/lib/motion/springs'
import { buttonVariants } from '@/components/ui/button'
import SignOutButton from '@/components/auth/sign-out-button'
import {
  bottomNavForRole,
  buildBreadcrumbs,
  ctaForRole,
  homeForRole,
  isActiveHref,
  navItemsForRole,
  type NavRole,
} from '@/lib/nav/config'
import NotificationBell from './notification-bell'
import ThemeToggle from './theme-toggle'
import PodiumMark from '@/components/brand/podium-mark'
import {
  BreadcrumbLabelProvider,
  useBreadcrumbLabelOverride,
} from './breadcrumb-label'

interface NavShellProps {
  role: NavRole
  children: React.ReactNode
}

/**
 * NavShell — the signed-in application shell for all four roles.
 *
 * Navigation data comes from `lib/nav/config.ts` (which sources every href
 * from `lib/routes.ts`); the shell never declares its own hrefs, so a nav item
 * cannot drift out of sync with the routes that actually exist (B-4).
 *
 * The default export wraps the shell in `BreadcrumbLabelProvider` so any page
 * inside `children` can register a display name for its final breadcrumb (a
 * dynamic-route page whose last path segment is an opaque id would otherwise
 * fall back to the generic label `buildBreadcrumbs` derives).
 */
export default function NavShell({ role, children }: NavShellProps) {
  return (
    <BreadcrumbLabelProvider>
      <NavShellInner role={role}>{children}</NavShellInner>
    </BreadcrumbLabelProvider>
  )
}

function NavShellInner({ role, children }: NavShellProps) {
  const pathname = usePathname()
  const items = navItemsForRole(role)
  const bottomItems = bottomNavForRole(role)
  const cta = ctaForRole(role)
  const lastLabel = useBreadcrumbLabelOverride(pathname)
  const crumbs = buildBreadcrumbs(pathname, { lastLabel })

  // H3: the active indicator is a shared-layout element (`layoutId`) so it
  // physically slides between items. Reduced-motion users get the indicator
  // without travel (duration 0 => Framer cross-fades in place, no slide).
  const reduced = useReducedMotion()
  const indicatorTransition = reduced ? { duration: 0 } : SPRING.snappy

  // DASH1: the wordmark links to the role's dashboard (its home), not the first
  // nav item — that is what keeps the dashboard reachable and un-orphaned.
  const home = homeForRole(role)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 md:px-16">
          <Link
            href={home}
            className="mr-6 inline-flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight text-foreground"
          >
            <PodiumMark height={20} limeTop className="text-foreground" />
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
                    'relative',
                    active && 'font-semibold text-primary',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
                      transition={indicatorTransition}
                    />
                  )}
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
            {/* PR-15: sign out is reachable from every page, for every role. */}
            <SignOutButton labelHiddenOnMobile />
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
        {bottomItems.map((item) => {
          const active = isActiveHref(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-1 py-2 text-small',
                active
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                  transition={indicatorTransition}
                />
              )}
              <Icon className="size-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
