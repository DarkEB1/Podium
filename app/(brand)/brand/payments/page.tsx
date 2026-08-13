import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getPaymentHistory } from '@/lib/supabase/payments'
import { formatMinorAmount } from '@/lib/money'
import { EmptyState } from '@/components/ui/empty-state'
import { AccentHeading } from '@/components/ui/accent-heading'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

/**
 * M-1 — an authenticated route. `robots.ts` already disallows it, but a crawler
 * that follows a shared link never reads robots.txt, so say it here too.
 */
export const metadata: Metadata = {
  title: 'Payments · Podium',
  description: 'Your Podium invoices, payouts and payment history.',
  robots: { index: false },
}


type PaymentRow = Database['public']['Tables']['payments']['Row']

export default async function BrandPaymentsPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  // getPaymentHistory returns payments array for this user as payer or payee
  const payments = (await getPaymentHistory(supabase, user.id)) as PaymentRow[]

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-16 md:px-16 md:py-16">
      <header className="space-y-3">
        <AccentHeading as="h1" className="text-display">Payments</AccentHeading>
        <p className="text-medium text-muted-foreground">
          Review your payment history.
        </p>
      </header>

      {/*
        ST-8: this section used to offer an "Initiate payment" form. It created
        a Stripe PaymentIntent, threw away the clientSecret it got back, and
        told the brand "payment intent created" — but no card entry step exists
        anywhere in the app (no Stripe Elements, and the publishable key is
        documented as unused), so the charge could never be completed. It left
        an unconfirmed intent at Stripe and a permanently pending payments row,
        while both parties believed a payment was under way.

        Saying nothing is better than saying something false. The section
        returns when card entry actually exists.
      */}
      <section className="space-y-4">
        <h2 className="text-large">Paying a deal</h2>
        <p className="text-medium text-muted-foreground">
          In-app card payments are not switched on yet. Settle signed deals
          directly with the athlete or team for now, and get in touch if you
          need a hand.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-large">Payment history</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon={<Receipt aria-hidden="true" />}
            title="No payments yet"
            description="Once you initiate a payment from a fully signed deal, its history will appear here."
          />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-medium font-medium font-mono text-foreground">{p.contract_id.slice(0, 8)}…</p>
                  <p className="text-small text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  {/* payments.amount is Stripe MINOR units, so it must never
                      be rendered raw: a £50,000 deal read "GBP 5000000". */}
                  <p className="font-semibold text-foreground">{formatMinorAmount(p.amount, p.currency)}</p>
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
