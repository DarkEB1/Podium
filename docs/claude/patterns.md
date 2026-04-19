# Patterns — Podium

## Server Component Data Fetch
```typescript
// app/(athlete)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getAthleteProfile } from '@/lib/supabase/profiles'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const profile = await getAthleteProfile(supabase, user.id)
  return <Dashboard profile={profile} />
}
```

## Supabase Query Pattern
```typescript
// lib/supabase/profiles.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function getAthleteProfile(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from('athlete_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`getAthleteProfile: ${error.message}`)
  return data
}
```

## Realtime Subscription (Client Component)
```typescript
// components/messaging/chat-messages.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ChatMessages({ connectionId }: { connectionId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${connectionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `connection_id=eq.${connectionId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [connectionId, supabase])

  return <ul>{messages.map((m) => <li key={m.id}>{m.content}</li>)}</ul>
}
```

## Stripe Webhook Handler Pattern
```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // handle event.type here
  return NextResponse.json({ received: true })
}
```

## Migration File Pattern
```sql
-- supabase/migrations/20260419120000_create_athlete_profiles.sql
create table public.athlete_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.athlete_profiles enable row level security;

create policy "Athletes can view their own profile"
  on public.athlete_profiles for select
  using (auth.uid() = user_id);

create policy "Athletes can update their own profile"
  on public.athlete_profiles for update
  using (auth.uid() = user_id);
```
