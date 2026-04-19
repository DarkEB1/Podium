-- notification_prefs are stored as JSONB on each profile table.
-- This table logs every notification sent across all three channels.

create table public.notification_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  -- e.g. 'connection_request_received', 'match_accepted', 'proposal_received', 'payment_received'
  event_type text not null,
  channel    public.notification_channel not null,
  title      text not null,
  body       text not null,
  metadata   jsonb not null default '{}',
  sent_at    timestamptz not null default now(),
  -- read_at is only relevant for in_app channel
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_logs enable row level security;

-- Users see only their own notifications
create policy "notification_logs_select"
  on public.notification_logs for select
  using (user_id = auth.uid());

-- INSERT is service-role only (notification dispatch system)
-- No UPDATE, no DELETE from client
