'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import PasswordStrength from './password-strength'
import Link from 'next/link'
import { ROUTES } from '@/lib/routes'
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions'
import { INTENDED_ROLE_STORAGE_KEY, type SelectableRole } from './intended-role'
import { track } from '@/lib/analytics'

const schema = z.object({
  // Bound both fields client-side (P2): without a max the browser sent 255-char
  // emails and 10k-char passwords and the server rejection surfaced only as a
  // vanishing toast. 254 = RFC 5321; 128 mirrors the server password policy.
  email: z.string().email('Invalid email address').max(254, 'Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one symbol'),
  // CL-5: consent must be an explicit, unticked opt-in. It was previously not
  // collected at all, so no account on the platform had a consent record.
  acceptedPolicies: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }),
  }),
})
type FormValues = z.infer<typeof schema>

interface Props {
  /**
   * M-3/PR-10: the role the visitor picked on the landing page (`?role=`).
   * Remembered across the email-confirmation round trip so the role step is
   * pre-filled rather than asked from scratch.
   */
  role?: SelectableRole | undefined
}

export default function SignUpForm({ role }: Props = {}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Never pre-tick: consent must be an affirmative action (UK GDPR Art. 4(11)).
    defaultValues: { email: '', password: '', acceptedPolicies: false as unknown as true },
  })
  const password = form.watch('password', '')

  // M-6 `signup_started` — the catalogue defines this as "the form was opened",
  // so it belongs on mount, not on submit. `track()` is consent-gated and never
  // throws, so this is inert until the visitor opts in.
  useEffect(() => {
    track('signup_started', { ...(role ? { role } : {}), source: 'signup_form' })
  }, [role])

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const res = await fetch(ROUTES.api.auth.signup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The server rejects a mismatch, so a user can never be bound to
        // policy copy they were not shown.
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Sign-up failed')
        return
      }
      // M-6 `signup_completed` — only after the API confirmed creation (2xx),
      // never on click. No email or password ever reaches the payload.
      //
      // NOTE: the catalogue makes `role` REQUIRED here, so a visitor who
      // reached /auth/signup without a `?role=` cannot be counted — see the
      // reported gap against lib/analytics/events.ts.
      if (role) {
        track('signup_completed', { role })
        try {
          window.localStorage.setItem(INTENDED_ROLE_STORAGE_KEY, role)
        } catch {
          // Storage can be unavailable (private mode); the role step still works.
        }
      }
      router.push(ROUTES.auth.verifyEmail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      {/* noValidate: use react-hook-form's inline, associated errors instead of
          the browser's native validation bubble, which hijacks the email field
          and suppresses every other field's error (P2 a11y). */}
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" maxLength={128} placeholder="••••••••" {...field} />
              </FormControl>
              <PasswordStrength password={password} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptedPolicies"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-2">
                <FormControl>
                  <input
                    id="acceptedPolicies"
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    checked={Boolean(field.value)}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    name={field.name}
                  />
                </FormControl>
                <FormLabel htmlFor="acceptedPolicies" className="text-small font-normal leading-snug">
                  I agree to the{' '}
                  <Link href="/terms" className="underline underline-offset-2">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  .
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </Form>
  )
}
