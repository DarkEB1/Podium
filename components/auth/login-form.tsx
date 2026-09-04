'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import Link from 'next/link'
import { ROUTES, ROLE_DASHBOARD as ROLE_HOME } from '@/lib/routes'
import type { Database } from '@/types/database'

type UserRole = Database['public']['Enums']['user_role']

const ROLE_DASHBOARD: Partial<Record<UserRole, string>> = {
  ...ROLE_HOME,
  admin: '/admin/dashboard',
}

const schema = z.object({
  // Bounds match signup / the server caps (P2): 254 = RFC 5321, 128 = password
  // policy. Prevents a 10k-char field being POSTed only to bounce as a toast.
  email: z.string().email('Invalid email address').max(254, 'Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long'),
})
type FormValues = z.infer<typeof schema>

/**
 * WS-INFRA P2 — the return-to target from `?next=`. Middleware sets it when it
 * bounces a deep-linking signed-out visitor to sign-in. Only a same-origin
 * absolute path is honoured: protocol-relative (`//host`), absolute URLs and a
 * target back inside the auth flow are all rejected, so a crafted `next` cannot
 * turn sign-in into an open redirect or a loop.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  if (raw === ROUTES.auth.signIn || raw.startsWith('/auth/')) return null
  return raw
}

function nextFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  return safeNextPath(new URLSearchParams(window.location.search).get('next'))
}

export default function LoginForm() {
  const router = useRouter()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { formState: { isSubmitting } } = form

  async function onSubmit(values: FormValues) {
    let res: Response
    try {
      res = await fetch(ROUTES.api.auth.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    } catch {
      // Offline / DNS failure / server unreachable — `fetch` rejects with
      // "Failed to fetch". Without this the promise rejected unhandled and the
      // user saw nothing at all (P2).
      toast.error('Could not reach the server. Check your connection and try again.')
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error?.message ?? 'Login failed')
      return
    }
    const { user } = data
    if (!user) {
      toast.error('Login failed, please try again')
      return
    }
    if (!user.role || !user.role_locked_at) {
      // A role-less user must pick a role before anything else, so the return-to
      // is deliberately not honoured here.
      router.push(ROUTES.auth.roleSelect)
    } else {
      const next = nextFromLocation()
      router.push(next ?? ROLE_DASHBOARD[user.role as UserRole] ?? ROUTES.home)
    }
  }

  return (
    <Form {...form}>
      {/* noValidate: inline associated errors, not the native validation bubble
          that hijacks the email field and hides the other errors (P2 a11y). */}
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
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link href={ROUTES.auth.forgotPassword} className="text-small text-muted-foreground hover:underline">
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input type="password" autoComplete="current-password" maxLength={128} placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  )
}
