import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPaymentHistory } from '@/lib/supabase/payments'
import PaymentForm from '@/components/brand/payment-form'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type PaymentRow = Database['public']['Tables']['payments']['Row']

export default async function BrandPaymentsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getPaymentHistory returns payments array for this user as payer or payee
  const payments = (await getPaymentHistory(supabase, user.id)) as PaymentRow[]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">Payments</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Initiate a payment</h2>
        <p className="text-sm text-muted-foreground">
          Enter the contract ID from a fully signed deal to initiate a Stripe payment to the athlete or team.
        </p>
        <PaymentForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payments yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium font-mono">{p.contract_id.slice(0, 8)}…</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{p.currency} {p.amount.toLocaleString()}</p>
                  <span className={cn(
                    'text-xs rounded-full px-2 py-0.5',
                    p.status === 'succeeded' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    p.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
