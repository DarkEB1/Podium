import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPaymentHistory } from '@/lib/supabase/payments'
import PaymentForm from '@/components/brand/payment-form'
import { EmptyState } from '@/components/ui/empty-state'
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
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-8 md:px-16">
      <h1 className="text-large font-bold">Payments</h1>

      <section className="space-y-4">
        <h2 className="text-large font-semibold">Initiate a payment</h2>
        <p className="text-medium text-muted-foreground">
          Enter the contract ID from a fully signed deal to initiate a Stripe payment to the athlete or team.
        </p>
        <PaymentForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-large font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon={<Receipt aria-hidden="true" />}
            title="No payments yet"
            description="Once you initiate a payment from a fully signed deal, its history will appear here."
          />
        ) : (
          <ul className="divide-y rounded-xl border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-medium font-medium font-mono">{p.contract_id.slice(0, 8)}…</p>
                  <p className="text-small text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{p.currency} {p.amount.toLocaleString()}</p>
                  <span className={cn(
                    'text-small rounded-full border px-2 py-0.5',
                    p.status === 'succeeded' ? 'border-success/30 bg-success/15 text-success' :
                    p.status === 'failed' ? 'border-destructive/30 bg-destructive/15 text-destructive' :
                    'border-border bg-muted text-muted-foreground'
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
