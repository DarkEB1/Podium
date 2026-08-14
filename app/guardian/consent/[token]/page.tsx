import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { getConsentTokenStatus } from '@/lib/supabase/guardian'
import GuardianConsentAccept from '@/components/guardian/consent-accept'

export const metadata: Metadata = {
  title: 'Guardian consent · Podium',
  // A capability link that should never be indexed or followed.
  robots: { index: false, follow: false },
}

// The token identifies one athlete's guardian. Validation is non-mutating here;
// consent is only recorded when the guardian confirms via the POST action.
export default async function GuardianConsentPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()
  const status = await getConsentTokenStatus(admin, token)

  return (
    <main className="mx-auto max-w-xl px-6 py-12 md:py-16">
      <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
        Guardian consent
      </h1>

      {status.status === 'valid' ? (
        <div className="mt-6 space-y-5 text-medium leading-relaxed text-muted-foreground">
          <p>
            {status.athleteName} is under 18 and has a Podium account to find sponsorship and brand
            deals. As their parent or guardian, your consent is required before they can sign any
            agreement or receive any payment.
          </p>
          <p>
            By confirming below you agree to act as their guardian for contract and payment purposes
            on Podium. You can withdraw consent later by contacting us.
          </p>
          <GuardianConsentAccept token={token} athleteName={status.athleteName} />
        </div>
      ) : (
        <div className="mt-6 space-y-4 text-medium leading-relaxed text-muted-foreground">
          {status.status === 'consumed' && (
            <p>This consent has already been recorded. No further action is needed.</p>
          )}
          {status.status === 'expired' && (
            <p>
              This consent link has expired. Please ask the athlete to send a new consent request
              from their Podium settings.
            </p>
          )}
          {status.status === 'invalid' && (
            <p>This consent link is not valid. Please check the link in your email and try again.</p>
          )}
        </div>
      )}
    </main>
  )
}
