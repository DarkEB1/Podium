const ROLES = [
  { name: 'Athletes', copy: 'Free forever. Get discovered and get backed.', height: 'h-72', lime: true },
  { name: 'Teams & clubs', copy: 'Fund the season, from grassroots up.', height: 'h-56', lime: false },
  { name: 'Brands', copy: 'Find the right partners, agree terms, pay safely.', height: 'h-44', lime: false },
]

export default function RolesPanel() {
  return (
    <section aria-labelledby="roles-heading" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      <h2 id="roles-heading" className="mb-8 font-heading text-large font-extrabold text-foreground">
        Who&rsquo;s on the podium
      </h2>
      <div className="flex max-w-3xl items-end gap-4">
        {ROLES.map((r) => (
          <div
            key={r.name}
            className={`relative flex-1 overflow-hidden rounded-xl border border-border bg-card p-5 ${r.height} ${
              r.lime ? 'pt-8' : ''
            }`}
          >
            {r.lime && (
              // The panel's one full-saturation lime element: a filled cap, not a
              // border — lime is a fill colour only (spec: colour rules), and at
              // ~1.2:1 against the card a hairline border would be near-invisible
              // where a solid block still reads clearly.
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-3 bg-lime" />
            )}
            <span className="block font-heading text-medium font-extrabold text-foreground">{r.name}</span>
            <span className="mt-2 block text-small font-light text-muted-foreground">{r.copy}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
