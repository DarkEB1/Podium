// Temporary panel stubs (build step 2): kicker + headline at spec positions so
// travel, dwell and composition are verifiable before each panel's real build.
export default function PanelStub({
  kicker,
  lines,
  id,
}: {
  kicker: string
  lines: string[]
  id?: string
}) {
  return (
    <section id={id} className="relative h-screen w-screen shrink-0">
      <p
        className="absolute flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[.15em] text-foreground"
        style={{ left: 'var(--margin-x)', top: '12vh' }}
      >
        <span aria-hidden="true" className="inline-block h-[3px] w-5 bg-lime" />
        {kicker}
      </p>
      <h2
        className="absolute font-heading font-extrabold text-foreground"
        style={{
          left: 'var(--margin-x)',
          top: '16vh',
          fontSize: 'var(--display-l)',
          lineHeight: 0.98,
          letterSpacing: '-0.02em',
        }}
      >
        {lines.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </h2>
    </section>
  )
}
