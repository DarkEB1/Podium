const STEPS = [
  { n: '01', title: 'Build your profile', copy: 'Stats, story, goals — five minutes, free forever.' },
  { n: '02', title: 'Get discovered', copy: 'Brands search by sport, region and audience.' },
  { n: '03', title: 'Sign and get paid', copy: 'Agree terms and get paid through Podium, protected.' },
]

export default function WhatWeDoPanel() {
  return (
    <section aria-labelledby="wwd-heading" id="what-we-do" className="flex h-full flex-col justify-end px-6 pb-[26vh] pt-24 md:px-16">
      <h2 id="wwd-heading" className="mb-8 font-heading text-large font-extrabold text-foreground">
        Three steps up
      </h2>
      <ol className="max-w-2xl space-y-4">
        {STEPS.map((s, i) => {
          // The last slab is the panel's one full-saturation lime element
          // (the others are tints) — its text needs the dedicated
          // lime-foreground ink, not text-foreground, because tints darken in
          // dark mode while foreground lightens (see components/ui/contrast.test.ts).
          const isLast = i === STEPS.length - 1
          return (
            <li
              key={s.n}
              // Fallen-domino slabs: widths step up like the podium on its side.
              className="flex items-center gap-5 rounded-[4px_4px_4px_16px] bg-lime-tint-1 px-6 py-4 last:bg-lime"
              style={{ width: `${70 + i * 15}%` }}
            >
              <span
                className={`font-mono text-small uppercase tracking-[.15em] ${isLast ? 'text-lime-foreground' : 'text-foreground'}`}
              >
                {s.n}
              </span>
              <span>
                <span className={`block text-medium font-bold ${isLast ? 'text-lime-foreground' : 'text-foreground'}`}>
                  {s.title}
                </span>
                <span
                  className={`block text-small font-light ${isLast ? 'text-lime-foreground' : 'text-muted-foreground'}`}
                >
                  {s.copy}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
