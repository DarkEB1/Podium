'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ROUTES, ROLE_ONBOARDING as ROLE_ONBOARDING_ROUTES } from '@/lib/routes'
import { clearIntendedRole, readIntendedRole, type SelectableRole } from './intended-role'
import { track } from '@/lib/analytics'

const ROLES: { id: SelectableRole; title: string; description: string; badge: string }[] = [
  {
    id: 'athlete',
    title: 'Athlete',
    description: 'List yourself, get discovered by brands and agents. Always free.',
    badge: 'Free forever',
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Find sponsors for your team or club. Always free.',
    badge: 'Free forever',
  },
  {
    id: 'brand',
    title: 'Brand / Sponsor',
    description: 'Search athletes and teams, send connection requests. Subscription required.',
    badge: 'Subscription',
  },
  {
    id: 'agent',
    title: 'Agent',
    description: 'Represent athletes and teams, broker deals. Always free.',
    badge: 'Free forever',
  },
]

const ROLE_ONBOARDING: Record<SelectableRole, string> = ROLE_ONBOARDING_ROUTES

interface Props {
  /** Role chosen on the landing page (`/auth/signup?role=…`), pre-selected here. */
  initialRole?: SelectableRole | undefined
}

export default function RoleSelectForm({ initialRole }: Props = {}) {
  const router = useRouter()
  const [selected, setSelected] = useState<SelectableRole | null>(initialRole ?? null)
  const [loading, setLoading] = useState(false)

  // M-3/PR-10: the landing-page choice is stashed before the email round trip,
  // so recover it here when the URL no longer carries it.
  useEffect(() => {
    if (initialRole) return
    const remembered = readIntendedRole()
    if (remembered) setSelected(remembered)
  }, [initialRole])

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    try {
      const res = await fetch(ROUTES.api.auth.role, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Failed to set role')
        return
      }
      // M-6 `role_selected` — after the API persisted the role, not on the
      // card click, so an abandoned or rejected choice is never counted.
      track('role_selected', { role: selected })
      clearIntendedRole()
      router.push(ROLE_ONBOARDING[selected])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map((role) => (
          <button
            key={role.id}
            data-role={role.id}
            type="button"
            aria-pressed={selected === role.id}
            onClick={() => setSelected(role.id)}
            className={cn(
              'relative rounded-2xl border p-5 text-left transition-all',
              selected === role.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-foreground/50'
            )}
          >
            <span className="mb-1 block font-heading text-medium font-semibold text-foreground">{role.title}</span>
            <span className="block text-small text-muted-foreground">{role.description}</span>
            <span className="mt-3 inline-block rounded-full bg-muted px-2.5 py-0.5 text-small font-medium text-muted-foreground">
              {role.badge}
            </span>
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!selected || loading}
        aria-busy={loading}
        onClick={handleConfirm}
      >
        {loading ? 'Confirming…' : 'Confirm role'}
      </Button>
    </div>
  )
}
