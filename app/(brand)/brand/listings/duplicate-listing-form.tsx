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

const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  athlete_endorsement: 'Athlete endorsement',
  team_sponsorship: 'Team sponsorship',
}

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['athlete_endorsement', 'team_sponsorship'] as const),
  description: z.string().max(2000).optional(),
  sport_required: z.string().optional(),
  level_required: z.string().optional(),
  location: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  source: JobListingRow
}

/**
 * DuplicateListingForm — a POST-only listing form pre-filled from an existing
 * listing. Creating a copy must always create a NEW listing, so unlike the
 * shared edit form this never PATCHes the source. Title is suffixed "(copy)".
 */
export default function DuplicateListingForm({ source }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: `${source.title} (copy)`,
      type: source.type,
      description: source.description ?? '',
      sport_required: source.sport_required ?? '',
      level_required: source.level_required ?? '',
      location: source.location ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/discovery/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // carry over the source's pay terms so the copy is genuinely pre-filled
          pay_type: source.pay_type ?? undefined,
          pay_amount: source.pay_amount ?? undefined,
          pay_currency: source.pay_currency ?? 'GBP',
          contract_duration_months: source.contract_duration_months ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to duplicate listing')
        return
      }
      toast.success('Listing duplicated')
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
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Listing type</FormLabel>
            {/* PM-33: base-ui renders the raw enum value ("athlete_endorsement")
                in the collapsed trigger unless the root is given the value→label
                map, exactly as the main listing form does. */}
            <Select items={LISTING_TYPE_LABEL} onValueChange={field.onChange} defaultValue={field.value}>
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
            <FormLabel>Description <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
            <FormControl><Textarea rows={4} className="resize-none" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="sport_required" render={({ field }) => (
            <FormItem>
              <FormLabel>Sport <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="level_required" render={({ field }) => (
            <FormItem>
              <FormLabel>Level <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="location" render={({ field }) => (
          <FormItem>
            <FormLabel>Location <span className="text-muted-foreground text-small">(optional)</span></FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create copy'}
        </Button>
      </form>
    </Form>
  )
}
