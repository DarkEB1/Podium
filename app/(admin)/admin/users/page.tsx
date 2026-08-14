import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getAllUsers } from '@/lib/supabase/admin'
import { AccentHeading } from '@/components/ui/accent-heading'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const adminClient = createAdminClient()
  const users = await getAllUsers(adminClient)

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin · Users</p>
        <AccentHeading as="h1" className="text-display">Users</AccentHeading>
        <p className="max-w-[46ch] text-medium text-muted-foreground">{users.length} accounts</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Verified</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2 capitalize">{u.role ?? 'Not set'}</td>
                <td className="px-4 py-2">
                  <span className={u.email_verified ? 'text-success' : 'text-muted-foreground'}>
                    {u.email_verified ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No users found.</p>
        )}
      </div>
    </div>
  )
}
