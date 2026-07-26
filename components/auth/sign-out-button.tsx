'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

interface Props {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  /** Hide the label on small screens (used in the dense app header). */
  labelHiddenOnMobile?: boolean
}

/**
 * PR-15 — the sign-out control. Available to every role: rendered in the app
 * header (`components/layout/nav-shell.tsx`) and on every settings page
 * (`components/layout/settings-shell.tsx`). Calls the logout route, which
 * clears the Supabase session, then returns the user to the public home page.
 *
 * A full document navigation (rather than the router) is deliberate: it drops
 * every cached signed-in RSC payload along with the session.
 */
export default function SignOutButton({
  variant = 'ghost',
  size = 'sm',
  className,
  labelHiddenOnMobile = false,
}: Props) {
  const [pending, setPending] = useState(false)

  async function signOut() {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch(ROUTES.api.auth.logout, { method: 'POST' })
      if (!res.ok) throw new Error('logout failed')
      const data = (await res.json().catch(() => ({}))) as { redirectTo?: string }
      window.location.assign(data.redirectTo ?? ROUTES.home)
    } catch {
      toast.error('Could not sign you out. Please try again.')
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={signOut}
      disabled={pending}
      {...(className ? { className } : {})}
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className={labelHiddenOnMobile ? 'hidden sm:inline' : undefined}>
        {pending ? 'Signing out…' : 'Sign out'}
      </span>
    </Button>
  )
}
