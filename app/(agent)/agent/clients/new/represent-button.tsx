'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

interface Props {
  clientUserId: string
  clientName: string
  /**
   * Which kind of client this is. Previously hardcoded to 'athlete' in the
   * request body, so agents could only ever represent athletes even though
   * `POST /api/profiles/representation` has always accepted 'team' and the
   * product describes agents representing athletes and teams.
   */
  clientRole: 'athlete' | 'team'
  /** Already represented, so the action is shown as done rather than repeated. */
  alreadyLinked: boolean
}

/**
 * Sends the representation request that backs the agent's "Add Client" CTA.
 * Failures are surfaced to the user rather than swallowed.
 */
export default function RepresentButton({
  clientUserId,
  clientName,
  clientRole,
  alreadyLinked,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(alreadyLinked)

  async function request() {
    if (pending || done) return
    setPending(true)
    try {
      const res = await fetch(ROUTES.api.profiles.representation, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_user_id: clientUserId, client_role: clientRole }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      if (!res.ok) {
        toast.error(data.error?.message ?? 'Could not send that representation request.')
        return
      }
      setDone(true)
      toast.success(`Representation request sent to ${clientName}.`)
      router.refresh()
    } catch {
      toast.error('Could not send that representation request. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button type="button" size="sm" variant={done ? 'outline' : 'default'} disabled={pending || done} onClick={request}>
      {done ? 'Request sent' : pending ? 'Sending…' : 'Request to represent'}
    </Button>
  )
}
