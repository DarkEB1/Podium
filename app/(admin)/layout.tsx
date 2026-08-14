import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Athletes', href: '/admin/athletes' },
  { label: 'Brands', href: '/admin/brands' },
  { label: 'Listings', href: '/admin/listings' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Verification', href: '/admin/verification' },
  { label: 'Trust', href: '/admin/reports' },
  { label: 'Payments', href: '/admin/payments' },
  { label: 'Subscriptions', href: '/admin/subscriptions' },
  { label: 'Audit', href: '/admin/audit' },
  { label: 'Config', href: '/admin/config' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'admin') redirect('/403')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 overflow-hidden px-6 md:px-16">
          <Link href="/admin/dashboard" className="shrink-0 font-heading text-xl font-extrabold tracking-tight text-foreground">
            Podium Admin
          </Link>
          <nav
            aria-label="Admin navigation"
            className="-mx-6 min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-6 md:mx-0 md:overflow-visible md:px-0"
          >
            <div className="flex items-center gap-1">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
