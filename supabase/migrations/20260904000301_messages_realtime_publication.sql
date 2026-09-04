-- ============================================================
-- WS-MSG-03 — DELIVER MESSAGES IN REALTIME
--
-- components/messaging/chat-window.tsx subscribes to `postgres_changes` INSERT
-- events on `public.messages`. Postgres only emits change events for tables that
-- belong to the `supabase_realtime` publication, and no migration ever added
-- `messages` to it — so unless someone enabled it by hand in the dashboard, the
-- recipient never saw a new message until a full page reload.
--
-- Realtime applies the table's own RLS to every change before delivering it, so
-- adding `messages` here does NOT widen who can read a message: `messages_select`
-- (20260419000004) still scopes delivery to the two match participants (+admin).
-- The sender's own message is appended client-side from the 201 body, so this
-- publication is what wires up the OTHER participant's live receipt.
--
-- Idempotent: re-adding a table already in the publication raises
-- duplicate_object, and a missing publication raises undefined_object; both are
-- downgraded to a notice so a re-run (or a database provisioned without the
-- default Supabase publication) does not abort the migration.
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then
    raise notice 'WS-MSG-03: public.messages is already in supabase_realtime; nothing to do.';
  when undefined_object then
    raise warning 'WS-MSG-03: supabase_realtime publication not present; add public.messages to it from the dashboard.';
end;
$$;
