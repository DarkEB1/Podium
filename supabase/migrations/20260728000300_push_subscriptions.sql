-- ============================================================
-- Push notifications — subscription storage (spec §7)
--
-- notification_channel already includes 'push' and dispatchNotification records
-- a push log, but there was no transport and nowhere to keep a browser's Web
-- Push subscription. This table holds one row per (user, browser endpoint). The
-- actual send (VAPID + RFC 8291) lives in lib/push and no-ops until VAPID keys
-- are configured, so this is safe to ship ahead of the keys.
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,     -- the push service URL for this browser
  p256dh     text not null,            -- the client public key (base64url)
  auth       text not null,            -- the client auth secret (base64url)
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Web Push subscriptions, one per browser endpoint. Keys are the client-side public material only; delivery is VAPID-authenticated from lib/push.';

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions; the service role (delivery) reads all.
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete
  using (user_id = auth.uid());
