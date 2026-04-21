import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import NavShell from '@/components/layout/nav-shell'

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getUser(supabase)

  if (!user) redirect('/auth')
  if (user.role !== 'brand') redirect('/403')

  return <NavShell role="brand">{children}</NavShell>
}
