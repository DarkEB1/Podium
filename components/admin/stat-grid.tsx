/** A simple label/value stat grid for the admin overview pages. */
export default function StatGrid({ stats }: { stats: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-small text-muted-foreground">{s.label}</p>
          <p className="mt-1 font-heading text-large font-bold text-foreground">{s.value}</p>
        </div>
      ))}
    </div>
  )
}
