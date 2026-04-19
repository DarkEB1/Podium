create table public.messages (
  id                    uuid primary key default gen_random_uuid(),
  match_id              uuid not null references public.matches(id) on delete cascade,
  sender_id             uuid not null references public.users(id) on delete cascade,
  content_type          public.message_type not null,
  text_content          text,
  attachment_url        text,
  attachment_size_bytes bigint,
  attachment_mime_type  text,
  -- Stores structured data for proposal_card, esignature_request, payment_confirmation types
  metadata              jsonb not null default '{}',
  is_deleted            boolean not null default false,
  deleted_at            timestamptz,
  sent_at               timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Only match participants see messages; deleted messages visible to admin only
create policy "messages_select"
  on public.messages for select
  using (
    (
      public.is_match_participant(match_id)
      and (is_deleted = false or public.is_admin())
    )
    or public.is_admin()
  );

-- Match participant can insert IF:
--   - the match has proposal_sent = true (free-text unlocked), OR
--   - this message IS the proposal card (unlocks the conversation)
create policy "messages_insert"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_match_participant(match_id)
    and (
      content_type = 'proposal_card'
      or exists (
        select 1 from public.matches
        where id = match_id
        and proposal_sent = true
      )
    )
  );

-- Sender can soft-delete only (is_deleted and deleted_at fields)
create policy "messages_update"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (
    sender_id = auth.uid()
    -- Only allow updating soft-delete fields
    and is_deleted = true
  );
