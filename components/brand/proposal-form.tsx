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
import type { Database } from '@/types/database'

type PayType = Database['public']['Enums']['pay_type']
type ProposalRow = Database['public']['Tables']['proposals']['Row']

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  pay_amount: z.coerce.number().positive('Amount must be positive'),
  pay_type: z.enum(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'] as const).optional(),
  pay_currency: z.string().length(3),
  timeline_start: z.string().optional(),
  timeline_end: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  matchId: string
  onSent: (proposal: ProposalRow) => void
}

const PAY_TYPE_OPTIONS: { value: PayType; label: string }[] = [
  { value: 'flat_fee', label: 'Flat fee' },
  { value: 'monthly_retainer', label: 'Monthly retainer' },
  { value: 'per_post', label: 'Per post' },
  { value: 'revenue_share', label: 'Revenue share' },
]

export default function ProposalForm({ matchId, onSent }: Props) {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', pay_currency: 'GBP' },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/deals/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, ...values }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to send proposal'); return }
      toast.success(copy.toasts.proposalSent)
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
      <p className="text-large mb-4">Send a proposal</p>
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
                <FormControl><Input type="number" min={0} placeholder="5000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="pay_currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl><Input placeholder="GBP" maxLength={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="pay_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Pay type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            {loading ? 'Sending…' : 'Send proposal'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
