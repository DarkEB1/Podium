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
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginForm() {
  const router = useRouter()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { formState: { isSubmitting } } = form

  async function onSubmit(values: FormValues) {
    const res = await fetch(ROUTES.api.auth.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
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
      router.push(ROUTES.auth.roleSelect)
    } else {
      router.push(ROLE_DASHBOARD[user.role as UserRole] ?? ROUTES.home)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
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
                <Input type="password" autoComplete="current-password" placeholder="••••••••" {...field} />
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
