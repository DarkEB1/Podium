const stats = [
  { value: '10,000+', label: 'Athletes & Teams' },
  { value: '500+', label: 'Brand Partners' },
  { value: '£2M+', label: 'Deals Closed' },
  { value: '48h', label: 'Avg. Response Time' },
]

export default function SocialProof() {
  return (
    <section id="about" className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-8 text-center sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
