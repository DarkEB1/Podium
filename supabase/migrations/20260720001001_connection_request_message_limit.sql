-- ============================================================
-- PR-8 / SEC-4 — CONNECTION REQUEST MESSAGE LENGTH
--
-- The personalised message on a connection request is capped at 300
-- characters. That cap was only enforced in the UI and in
-- lib/supabase/discovery.ts (`sendConnectionRequest`), so any direct
-- PostgREST call could store an unbounded message. Enforce it in the DB too —
-- the application check stays as the source of the friendly error message.
-- ============================================================

-- Defensive: truncate any pre-existing over-length message so the constraint
-- can be added as VALID. (No production data at time of writing.)
update public.connection_requests
   set message = left(message, 300)
 where char_length(message) > 300;

alter table public.connection_requests
  drop constraint if exists connection_requests_message_max_length;

alter table public.connection_requests
  add constraint connection_requests_message_max_length
  check (char_length(message) <= 300);

comment on constraint connection_requests_message_max_length on public.connection_requests is
  'PR-8/SEC-4: personalised connection-request message is capped at 300 characters. Mirrored in lib/supabase/discovery.ts sendConnectionRequest().';

comment on column public.connection_requests.message is
  'Required personalised note, 300 characters or fewer (enforced by connection_requests_message_max_length).';
