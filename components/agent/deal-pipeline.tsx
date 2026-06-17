import * as React from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type ContractStatus = Database['public']['Enums']['contract_status']

/**
 * The four agent-facing pipeline stages (spec §6B.1), in display order.
 * These are presentation buckets, distinct from the raw `contract_status`
 * enum — `stageForContractStatus` maps the enum onto them.
 */
export type PipelineStage =
  | 'proposal_sent'
  | 'under_negotiation'
  | 'awaiting_signature'
  | 'completed'

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'under_negotiation', label: 'Under Negotiation' },
  { id: 'awaiting_signature', label: 'Awaiting Signature' },
  { id: 'completed', label: 'Completed' },
]

export interface PipelineDeal {
  id: string
  clientName: string
  brandName: string
  stage: PipelineStage
  updatedAt: string
}

/**
 * Maps a raw `contracts.status` enum value onto a pipeline display stage.
 * Returns `null` for statuses that should not appear in the pipeline
 * (e.g. terminated deals). `draft` is treated as "under negotiation" because
 * the brand/athlete are still agreeing terms before signatures are requested.
 */
export function stageForContractStatus(status: ContractStatus): PipelineStage | null {
  switch (status) {
    case 'draft':
      return 'under_negotiation'
    case 'pending_brand_signature':
    case 'pending_athlete_signature':
      return 'awaiting_signature'
    case 'fully_signed':
      return 'completed'
    case 'terminated':
      return null
    default:
      return null
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  deals: PipelineDeal[]
}

/**
 * DealPipeline — a four-column board grouping the agent's deals by stage
 * (spec §6B.1). Each column shows a heading, a count badge, and a card per
 * deal. Stages are fixed and always rendered so the board reads consistently
 * even when a stage is empty.
 */
export default function DealPipeline({ deals }: Props) {
  if (deals.length === 0) {
    return (
      <EmptyState
        title="No deals in your pipeline"
        description="When your clients receive proposals, they will appear here grouped by stage."
      />
    )
  }

  const byStage = new Map<PipelineStage, PipelineDeal[]>()
  for (const { id } of PIPELINE_STAGES) byStage.set(id, [])
  for (const deal of deals) byStage.get(deal.stage)?.push(deal)

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {PIPELINE_STAGES.map((stage) => {
        const stageDeals = byStage.get(stage.id) ?? []
        return (
          <section
            key={stage.id}
            data-testid={`stage-${stage.id}`}
            aria-labelledby={`stage-${stage.id}-heading`}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3
                id={`stage-${stage.id}-heading`}
                className="font-heading text-medium font-semibold text-foreground"
              >
                {stage.label}
              </h3>
              <span
                aria-label={`${stageDeals.length} deals`}
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-small text-muted-foreground"
              >
                {stageDeals.length}
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {stageDeals.map((deal) => (
                <li
                  key={deal.id}
                  className={cn(
                    'rounded-2xl border border-border bg-card p-4 shadow-sm',
                    'transition-shadow hover:shadow-card'
                  )}
                >
                  <p className="font-medium text-foreground">{deal.brandName}</p>
                  <p className="mt-0.5 text-small text-muted-foreground">{deal.clientName}</p>
                  {formatDate(deal.updatedAt) ? (
                    <p className="mt-2 text-small text-muted-foreground">
                      Updated {formatDate(deal.updatedAt)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
