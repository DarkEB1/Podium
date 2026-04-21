'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { Database } from '@/types/database'

type BrandRow = Database['public']['Tables']['brand_profiles']['Row']

const schema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(100),
  trading_name: z.string().max(100).optional(),
  headquarters_city: z.string().optional(),
  headquarters_country: z.string().optional(),
  website_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Must be a valid LinkedIn URL').optional().or(z.literal('')),
  description: z.string().max(2000).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props { profile: BrandRow }

export default function BrandSettingsForm({ profile }: Props) {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: profile.company_name ?? '',
      trading_name: profile.trading_name ?? '',
      headquarters_city: profile.headquarters_city ?? '',
      headquarters_country: profile.headquarters_country ?? '',
      website_url: profile.website_url ?? '',
      linkedin_url: profile.linkedin_url ?? '',
      description: profile.description ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to save'); return }
      toast.success('Settings saved')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField control={form.control} name="company_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Company name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="trading_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Trading name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="headquarters_city" render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="headquarters_country" render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="website_url" render={({ field }) => (
          <FormItem>
            <FormLabel>Website <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="url" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="linkedin_url" render={({ field }) => (
          <FormItem>
            <FormLabel>LinkedIn <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input type="url" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>About your brand <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl>
              <Textarea rows={4} className="resize-none" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
    </Form>
  )
}
