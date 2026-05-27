import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPendingCount, getAllAthleteProfiles, getAllBrandProfiles, getAllUsers } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const adminClient = createAdminClient()

  const [pending, athletes, brands, users] = await Promise.all([
    getPendingCount(adminClient),
    getAllAthleteProfiles(adminClient),
    getAllBrandProfiles(adminClient),
    getAllUsers(adminClient),
  ])

  const totalPending = pending.athletes + pending.brands

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and pending approvals</p>
      </div>

      {totalPending > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-4">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            {totalPending} profile{totalPending !== 1 ? 's' : ''} awaiting approval
          </p>
          <div className="mt-2 flex gap-3">
            {pending.athletes > 0 && (
              <Link href="/admin/athletes?status=pending_review" className={cn(buttonVariants({ size: 'sm' }))}>
                Review athletes ({pending.athletes})
              </Link>
            )}
            {pending.brands > 0 && (
              <Link href="/admin/brands?status=pending_approval" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
                Review brands ({pending.brands})
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Athletes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{athletes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {athletes.filter((a) => a.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{brands.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {brands.filter((b) => b.status === 'active').length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalPending}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/athletes" className={cn(buttonVariants({ variant: 'outline' }), 'h-auto py-4 flex-col gap-1')}>
          <span className="font-semibold">Manage Athletes</span>
          <span className="text-xs text-muted-foreground">{athletes.length} profiles</span>
        </Link>
        <Link href="/admin/brands" className={cn(buttonVariants({ variant: 'outline' }), 'h-auto py-4 flex-col gap-1')}>
          <span className="font-semibold">Manage Brands</span>
          <span className="text-xs text-muted-foreground">{brands.length} profiles</span>
        </Link>
        <Link href="/admin/users" className={cn(buttonVariants({ variant: 'outline' }), 'h-auto py-4 flex-col gap-1')}>
          <span className="font-semibold">All Users</span>
          <span className="text-xs text-muted-foreground">{users.length} accounts</span>
        </Link>
      </div>
    </div>
  )
}
