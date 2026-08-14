import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/supabase/auth'
import { getConversations } from '@/lib/supabase/messaging'
import MatchList from '@/components/messaging/match-list'
import { AccentHeading } from '@/components/ui/accent-heading'
import { ROUTES } from '@/lib/routes'

export const metadata = {
  title: 'Messages · Podium',
  description: 'Your conversations with the brands you have connected with.',
  robots: { index: false, follow: false },
}

export default async function TeamMessagesPage() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) redirect(ROUTES.auth.signIn)

  const conversations = await getConversations(supabase, user.id)

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-12 md:px-16 md:py-16">
      <header className="space-y-2">
        <AccentHeading as="h1" className="text-display">Messages</AccentHeading>
        <p className="text-medium text-muted-foreground">Your conversations with brands.</p>
      </header>
      <MatchList conversations={conversations} basePath={ROUTES.team.messages} />
    </div>
  )
}
