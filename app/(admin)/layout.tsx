import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Athletes', href: '/admin/athletes' },
  { label: 'Brands', href: '/admin/brands' },
  { label: 'Listings', href: '/admin/listings' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Verification', href: '/admin/verification' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'admin') redirect('/403')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6 md:px-16">
          <Link href="/admin/dashboard" className="mr-6 font-heading text-xl font-extrabold tracking-tight text-foreground">
            Podium Admin
          </Link>
          <nav aria-label="Admin navigation" className="flex items-center gap-1">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
