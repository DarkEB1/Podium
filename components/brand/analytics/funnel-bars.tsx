interface FunnelBarsProps {
  requestsSent: number
  accepted: number
  messaged: number
}

interface Stage {
  label: string
  value: number
}

/**
 * FunnelBars — horizontal outreach funnel: requests sent -> accepted ->
 * messaged. Each bar's width is proportional to `requestsSent` (the top of
 * the funnel), with the raw count labelled on every stage.
 */
export function FunnelBars({ requestsSent, accepted, messaged }: FunnelBarsProps) {
  const stages: Stage[] = [
    { label: 'Requests sent', value: requestsSent },
    { label: 'Accepted', value: accepted },
    { label: 'Messaged', value: messaged },
  ]
  const max = Math.max(1, requestsSent)

  return (
    <ul className="space-y-4">
      {stages.map((stage) => {
        const pct = Math.min(100, Math.round((stage.value / max) * 100))
        return (
          <li key={stage.label}>
            <div className="mb-1.5 flex items-center justify-between text-small">
              <span className="text-muted-foreground">{stage.label}</span>
              <span className="font-medium text-foreground">{stage.value}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
