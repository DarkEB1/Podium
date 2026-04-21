'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const schema = z.object({
  contractId: z.string().min(1, 'Contract ID is required').uuid('Must be a valid contract ID'),
})
type FormValues = z.infer<typeof schema>

export default function PaymentForm() {
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit({ contractId }: FormValues) {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error?.message ?? 'Failed to initiate payment'); return }
      toast.success('Payment intent created. Proceed to complete payment.')
      form.reset()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <FormField control={form.control} name="contractId" render={({ field }) => (
          <FormItem>
            <FormLabel>Contract ID</FormLabel>
            <FormControl>
              <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Processing…' : 'Initiate payment'}
        </Button>
      </form>
    </Form>
  )
}
