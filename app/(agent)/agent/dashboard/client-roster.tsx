'use client'

import { toast } from 'sonner'

import ClientTable, { type AgentClientRow } from '@/components/agent/client-table'

interface Props {
  clients: AgentClientRow[]
  /** Server action that revokes the agent's representation link. */
  onRevoke: (linkId: string) => Promise<void>
}

/**
 * ClientRoster — thin client wrapper that binds the dashboard's revoke server
 * action to the presentational ClientTable, turning success/failure into a
 * toast. Keeps the dashboard page itself a server component.
 */
export default function ClientRoster({ clients, onRevoke }: Props) {
  async function handleRevoke(linkId: string) {
    try {
      await onRevoke(linkId)
      toast.success('Client access revoked.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke access.')
    }
  }

  return <ClientTable clients={clients} onRevoke={handleRevoke} />
}
