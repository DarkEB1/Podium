'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { copy } from '@/lib/copy'
import { track } from '@/lib/analytics'
import { PROPOSAL_TITLE_MAX } from '@/lib/limits'
import {
  SUPPORTED_CURRENCIES,
  PROPOSAL_AMOUNT_MIN,
  PROPOSAL_AMOUNT_MAX,
} from '@/lib/deals-validation'
import type { Database } from '@/types/database'

type PayType = Database['public']['Enums']['pay_type']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

const schema = z
  .object({
    // From lib/limits so the form and the route cannot drift apart.
    title: z.string().min(1, 'Title is required').max(PROPOSAL_TITLE_MAX),
    // DP-5: bounded and 2dp, matching lib/deals-validation on the server.
    pay_amount: z.coerce
      .number()
      .min(PROPOSAL_AMOUNT_MIN, `Amount must be at least ${PROPOSAL_AMOUNT_MIN}`)
      .max(PROPOSAL_AMOUNT_MAX, `Amount must be ${PROPOSAL_AMOUNT_MAX.toLocaleString()} or less`)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
        'Amount cannot have more than two decimal places'
      ),
    // Required: POST /api/deals/proposals rejects a missing pay_type with its own
    // internal string ("match_id, title, pay_amount, and pay_type are required"),
    // which surfaced to the user as a toast. Catch it inline, in their words.
    pay_type: z.enum(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'] as const, {
      message: 'Select a pay type',
    }),
    // WS-DEAL-04: only GBP/USD/EUR are billable.
    pay_currency: z.enum(SUPPORTED_CURRENCIES),
    timeline_start: z.string().optional(),
    timeline_end: z.string().optional(),
  })
  // DP-10: end cannot precede start.
  .refine(
    (v) => !v.timeline_start || !v.timeline_end || v.timeline_end >= v.timeline_start,
    { path: ['timeline_end'], message: 'End date cannot be before the start date' }
  )
type FormValues = z.infer<typeof schema>

interface Props {
  /** Send mode: the match to send a brand-authored proposal into. */
  matchId?: string
  /**
   * Counter mode (WS-DEAL-01): the id of the pending proposal being countered.
   * When set, the form posts to the counter endpoint instead of a fresh send,
   * and no match_id is needed (the RPC derives it from the parent).
   */
  parentProposalId?: string
  onSent: (proposal: ProposalRow) => void
}

const CURRENCY_OPTIONS: { value: (typeof SUPPORTED_CURRENCIES)[number]; label: string }[] =
  SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))

const PAY_TYPE_OPTIONS: { value: PayType; label: string }[] = [
  { value: 'flat_fee', label: 'Flat fee' },
  { value: 'monthly_retainer', label: 'Monthly retainer' },
  { value: 'per_post', label: 'Per post' },
  { value: 'revenue_share', label: 'Revenue share' },
]

export default function ProposalForm({ matchId, parentProposalId, onSent }: Props) {
  const [loading, setLoading] = useState(false)
  const isCounter = parentProposalId !== undefined
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', pay_currency: 'GBP' },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const url = isCounter
        ? `/api/deals/proposals/${parentProposalId}/counter`
        : '/api/deals/proposals'
      const payload = isCounter ? values : { match_id: matchId, ...values }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error?.message ?? (isCounter ? 'Failed to send counter-offer' : 'Failed to send proposal'))
        return
      }
      // M-6 `proposal_sent` — after the 201, never on submit.
      track('proposal_sent', { role: isCounter ? 'counter' : 'brand' })
      toast.success(isCounter ? 'Counter-offer sent' : copy.toasts.proposalSent)
      form.reset()
      onSent(data as ProposalRow)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-border pt-6">
      <p className="text-large mb-4">{isCounter ? 'Send a counter-offer' : 'Send a proposal'}</p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl><Input placeholder="Summer 2026 Endorsement Deal" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="pay_amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl><Input type="number" min={PROPOSAL_AMOUNT_MIN} step="0.01" placeholder="5000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="pay_currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select
                  items={CURRENCY_OPTIONS}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="GBP" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="pay_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Pay type</FormLabel>
              {/* base-ui renders the raw value in the collapsed trigger unless
                  the root is given the value→label map. */}
              <Select items={PAY_TYPE_OPTIONS} onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select pay type" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAY_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="timeline_start" render={({ field }) => (
              <FormItem>
                <FormLabel>Start date <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="timeline_end" render={({ field }) => (
              <FormItem>
                <FormLabel>End date <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending…' : isCounter ? 'Send counter-offer' : 'Send proposal'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
