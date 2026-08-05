'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

/**
 * Public contact form (posts to /api/contact, which relays via Resend).
 * Field caps mirror FIELD_LIMITS in the route so the user hears about an
 * overlong message while typing, not from a 400 after submitting.
 */

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Your name is required').max(100, 'Name must be 100 characters or fewer'),
  email: z.string().trim().email('Enter a valid email address').max(254),
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little more. Messages need at least 10 characters')
    .max(2000, 'Message must be 2000 characters or fewer'),
  // Honeypot — hidden from humans, filled by naive bots.
  website: z.string().max(200).optional(),
})

type ContactValues = z.infer<typeof contactSchema>

export default function ContactForm() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', message: '', website: '' },
  })

  const messageLength = form.watch('message').length

  async function onSubmit(values: ContactValues) {
    setSending(true)
    setServerError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = (await res.json()) as { error?: { message?: string } }
      if (!res.ok) {
        setServerError(data.error?.message ?? 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
    } catch {
      setServerError('Something went wrong. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-card p-8 text-center shadow-card"
      >
        <h2 className="font-heading text-large font-bold text-foreground">Message sent</h2>
        <p className="mt-2 text-medium text-muted-foreground">
          Thanks for getting in touch. We read everything and reply as quickly as we can.
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input maxLength={100} autoComplete="name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" maxLength={254} autoComplete="email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="message" render={({ field }) => (
          <FormItem>
            <FormLabel>Message</FormLabel>
            <FormControl>
              <Textarea rows={6} maxLength={2000} className="resize-none" {...field} />
            </FormControl>
            <div className="flex justify-between">
              <FormMessage />
              <p className="ml-auto text-small text-muted-foreground">{messageLength}/2000</p>
            </div>
          </FormItem>
        )} />
        {/* Honeypot: visually removed and skipped by keyboard and screen
            readers; bots that fill every field give themselves away. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...form.register('website')}
          />
        </div>

        {serverError ? (
          <p role="alert" className="text-small text-destructive">{serverError}</p>
        ) : null}

        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? 'Sending…' : 'Send message'}
        </Button>
      </form>
    </Form>
  )
}
