/**
 * M-2 — This section previously presented fabricated statistics ("2,400+
 * athletes", "£1.2m deals matched", "92% matched in 48h") and three invented
 * testimonials attributed to named people. Presenting invented figures or
 * endorsements as fact breaches the CAP Code (rules 3.1, 3.7, 3.45) and the
 * Consumer Protection from Unfair Trading Regulations 2008, which prohibit
 * fake reviews outright.
 *
 * Every fabricated number, quote and attribution has been removed. This is now
 * a value-proposition section: it says what Podium does and what it costs,
 * which are claims we can actually stand behind pre-launch.
 *
 * RULE FOR FUTURE EDITORS: do not add a statistic, testimonial or client logo
 * here unless it is (a) sourced from the database at request time, or (b)
 * evidenced and dated in writing by the person quoted. "Illustrative" numbers
 * on a live marketing page are still misleading.
 */

const VALUE_PROPS = [
  {
    title: 'Direct, not brokered',
    body: 'Brands and talent deal with each other. No agency in the middle taking a cut of your sponsorship, and no waiting on someone else to pass a message along.',
  },
  {
    title: 'Free for athletes, teams and agents',
    body: 'Listing a profile, appearing in search, messaging brands and signing a deal cost you nothing. Podium is funded by brand subscriptions.',
  },
  {
    title: 'The whole deal in one place',
    body: 'Discovery, proposals, e-signature and payment run through Podium, so the terms you agreed are the terms on record — not scattered across DMs.',
  },
  {
    title: 'Built for UK sport',
    body: 'Grassroots to international, university and academy programmes included. Payments in sterling through Stripe, with a contract record you can hand to your accountant.',
  },
]

export default function SocialProof() {
  return (
    <section id="about" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-16 md:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            What Podium is
          </p>
          <h2 className="mt-6 font-heading text-4xl font-extrabold leading-[1.0] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            A sponsorship market that <span className="text-primary">cuts out</span> the middle.
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
            Podium is new. Rather than quote numbers we haven&apos;t earned yet,
            here is exactly what you get on day one — and what it costs.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {VALUE_PROPS.map(({ title, body }) => (
            <div key={title} className="bg-card p-8">
              <h3 className="font-heading text-xl font-extrabold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          We&apos;ll publish real marketplace figures — profiles listed, deals
          agreed, value matched — once there are enough of them to be meaningful,
          and we&apos;ll source them from the platform rather than from a
          marketing brief.
        </p>
      </div>
    </section>
  )
}
