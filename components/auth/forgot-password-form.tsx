'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({
  email: z.string().email('Invalid email address').max(254, 'Enter a valid email address'),
})
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordForm() {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) })
  const { formState: { isSubmitting, isSubmitSuccessful } } = form

  async function onSubmit(values: FormValues) {
    await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
  }

  if (isSubmitSuccessful) {
    return (
      <Alert>
        <AlertDescription>
          If this email exists, you will receive a reset link. The link expires in 1 hour.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      {/* noValidate: inline associated errors, not the native validation bubble
          that hijacks the email field (P2 a11y). */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </Form>
  )
}
