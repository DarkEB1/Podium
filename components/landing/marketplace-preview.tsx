const SAMPLE_CARDS = [
  { id: 1, name: 'James R.', sport: 'Football', level: 'Semi-Pro', followers: '12.4K', location: 'London' },
  { id: 2, name: 'Sofia M.', sport: 'Athletics', level: 'Amateur', followers: '8.1K', location: 'Manchester' },
  { id: 3, name: 'City FC Academy', sport: 'Football', level: 'Grassroots', followers: '5.2K', location: 'Birmingham' },
  { id: 4, name: 'Priya K.', sport: 'Tennis', level: 'Professional', followers: '31K', location: 'Bristol' },
  { id: 5, name: 'Marcus T.', sport: 'Basketball', level: 'Semi-Pro', followers: '9.7K', location: 'Leeds' },
  { id: 6, name: 'North United U21', sport: 'Football', level: 'Amateur', followers: '2.3K', location: 'Sheffield' },
]

export default function MarketplacePreview() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-4 text-center text-3xl font-bold">Browse the Talent Pool</h2>
        <p className="mb-10 text-center text-muted-foreground">
          Over 10,000 athletes and teams ready to partner with brands like yours.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_CARDS.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                  {c.name[0]}
                </div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.location}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.sport}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.level}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.followers} followers</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
