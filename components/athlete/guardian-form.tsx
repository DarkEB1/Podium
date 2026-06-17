'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const guardianSchema = z.object({
  guardian_name: z.string().min(1, 'Guardian name is required'),
  guardian_relationship: z.string().min(1, 'Relationship is required'),
  guardian_email: z.string().email('Valid email required'),
  guardian_phone: z.string().min(7, 'Phone number required'),
})

export type GuardianValues = z.infer<typeof guardianSchema>

interface Props {
  initialValues: GuardianValues
  loading: boolean
  onSubmit: (values: GuardianValues) => void
}

export default function GuardianForm({ initialValues, loading, onSubmit }: Props) {
  const form = useForm<GuardianValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: initialValues,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-medium text-muted-foreground">
          Because you are under 18, a parent or guardian must be registered for contract and payment purposes.
        </p>
        <FormField control={form.control} name="guardian_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Guardian full name</FormLabel>
            <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="guardian_relationship" render={({ field }) => (
          <FormItem>
            <FormLabel>Relationship</FormLabel>
            <FormControl><Input placeholder="Parent / Legal guardian" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="guardian_email" render={({ field }) => (
          <FormItem>
            <FormLabel>Guardian email</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="guardian_phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Guardian phone</FormLabel>
            <FormControl><Input type="tel" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Next →'}
        </Button>
      </form>
    </Form>
  )
}
