import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getConversations } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES } from '@/lib/routes'

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Messages · Podium',
  description: 'Your conversations with the brands you have connected with.',
  robots: { index: false, follow: false },
}

export default async function AthleteMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect('/auth')

  const conversations = await getConversations(supabase, user.id)

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <header className="space-y-2">
        <AccentHeading as="h1" className="text-display">Messages</AccentHeading>
        <p className="text-medium text-muted-foreground">Your conversations with brands and agents.</p>
      </header>
      <MatchList
        conversations={conversations}
        basePath={ROUTES.athlete.messages}
        emptyInbox={{
          description:
            'When you accept a request from a brand or agent, your conversation appears here.',
          primaryAction: { label: 'View connection requests', href: ROUTES.athlete.requests },
          secondaryAction: { label: 'Discover brands', href: ROUTES.athlete.discover },
        }}
      />
    </div>
  )
}
