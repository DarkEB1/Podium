const steps = [
  { n: '01', title: 'Create Profile', body: 'Athletes and teams list for free in minutes. Brands set up a campaign with a subscription.' },
  { n: '02', title: 'Get Discovered', body: 'Browse the marketplace or get found via search. Send a connection request with a personalised message.' },
  { n: '03', title: 'Close Deals', body: 'Negotiate proposals, e-sign contracts, and process payments — all in one place.' },
]

export default function HowItWorks() {
  return (
    <section id="how" className="bg-muted/30 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-3">
              <span className="text-4xl font-black text-muted-foreground/30">{s.n}</span>
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
