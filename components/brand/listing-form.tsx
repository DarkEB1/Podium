'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type JobListingRow = Database['public']['Tables']['job_listings']['Row']
type ListingType = Database['public']['Enums']['listing_type']
type PayType = Database['public']['Enums']['pay_type']

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['athlete_endorsement', 'team_sponsorship'] as const),
  description: z.string().max(2000).optional(),
  sport_required: z.string().optional(),
  level_required: z.string().optional(),
  location: z.string().optional(),
  is_remote: z.boolean().optional(),
  pay_type: z.enum(['flat_fee', 'monthly_retainer', 'per_post', 'revenue_share'] as const).optional(),
  pay_amount: z.coerce.number().positive('Must be positive').optional(),
  pay_currency: z.string().length(3).optional(),
  contract_duration_months: z.coerce.number().int().min(1).max(36).optional(),
  application_deadline: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props { listing: JobListingRow | null }

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  athlete_endorsement: 'Athlete endorsement',
  team_sponsorship: 'Team sponsorship',
}

const PAY_TYPE_LABEL: Record<PayType, string> = {
  flat_fee: 'Flat fee',
  monthly_retainer: 'Monthly retainer',
  per_post: 'Per post',
  revenue_share: 'Revenue share',
}

export default function ListingForm({ listing }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: listing?.title ?? '',
      type: (listing?.type as ListingType | undefined) ?? 'athlete_endorsement',
      description: listing?.description ?? '',
      sport_required: listing?.sport_required ?? '',
      level_required: listing?.level_required ?? '',
      location: listing?.location ?? '',
      is_remote: listing?.is_remote ?? false,
      pay_type: (listing?.pay_type as PayType | undefined) ?? undefined,
      pay_amount: listing?.pay_amount ?? undefined,
      pay_currency: listing?.pay_currency ?? 'GBP',
      contract_duration_months: listing?.contract_duration_months ?? undefined,
      application_deadline: listing?.application_deadline ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const url = listing
        ? `/api/discovery/listings/${listing.id}`
        : '/api/discovery/listings'
      const method = listing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      toast.success(listing ? 'Listing updated' : 'Listing created')
      router.push('/brand/listings')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl><Input placeholder="Summer 2026 Football Sponsorship" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Listing type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {(Object.entries(LISTING_TYPE_LABEL) as [ListingType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl>
              <Textarea rows={4} className="resize-none" placeholder="Describe what you're looking for…" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="sport_required" render={({ field }) => (
            <FormItem>
              <FormLabel>Sport <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="Football" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="level_required" render={({ field }) => (
            <FormItem>
              <FormLabel>Level <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="Semi-Pro" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="location" render={({ field }) => (
            <FormItem>
              <FormLabel>Location <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input placeholder="London" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="contract_duration_months" render={({ field }) => (
            <FormItem>
              <FormLabel>Duration (months) <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
              <FormControl><Input type="number" min={1} max={36} placeholder="12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="pay_type" render={({ field }) => (
          <FormItem>
            <FormLabel>Pay type <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Select pay type" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {(Object.entries(PAY_TYPE_LABEL) as [PayType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="pay_amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Amount <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
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

        <FormField control={form.control} name="application_deadline" render={({ field }) => (
          <FormItem>
            <FormLabel>Application deadline <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save draft'}
        </Button>
      </form>
    </Form>
  )
}
