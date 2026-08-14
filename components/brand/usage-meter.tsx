interface Props { label: string; used: number; limit: number | null }

/** Presentational usage bar for a single entitlement (requests, listings, messages). */
export function UsageMeter({ label, used, limit }: Props) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  const atCap = limit !== null && used >= limit
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className={atCap ? 'font-medium text-destructive' : 'font-medium'}>
          {limit === null ? 'Unlimited' : `${used} / ${limit}`}
        </span>
      </div>
      {limit !== null ? (
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}
