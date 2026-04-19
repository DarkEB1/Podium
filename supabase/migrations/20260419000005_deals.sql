-- ============================================================
-- PROPOSALS
-- ============================================================

create table public.proposals (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references public.matches(id) on delete cascade,
  sender_id          uuid not null references public.users(id) on delete cascade,
  -- NULL for initial proposal; set to parent for counter-proposals
  parent_proposal_id uuid references public.proposals(id),
  status             public.proposal_status not null default 'pending',
  title              text not null,
  deliverables       jsonb not null default '{}',
  pay_amount         numeric not null,
  pay_currency       text not null default 'GBP',
  pay_type           public.pay_type not null,
  timeline_start     date,
  timeline_end       date,
  usage_rights       jsonb,
  additional_terms   text,
  responded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger set_proposals_updated_at
  before update on public.proposals
  for each row execute procedure public.set_updated_at();

alter table public.proposals enable row level security;

create policy "proposals_select"
  on public.proposals for select
  using (
    public.is_match_participant(match_id)
    or public.is_admin()
  );

-- Only brands (sender is the brand in the match) can create proposals
create policy "proposals_insert"
  on public.proposals for insert
  with check (
    sender_id = auth.uid()
    and public.is_match_participant(match_id)
  );

-- Recipient can accept/decline/counter; sender can withdraw
create policy "proposals_update"
  on public.proposals for update
  using (public.is_match_participant(match_id))
  with check (public.is_match_participant(match_id));

-- ============================================================
-- CONTRACTS
-- ============================================================

create table public.contracts (
  id                    uuid primary key default gen_random_uuid(),
  proposal_id           uuid not null references public.proposals(id),
  match_id              uuid not null references public.matches(id),
  brand_id              uuid not null references public.users(id),
  athlete_or_team_id    uuid not null references public.users(id),
  agent_id              uuid references public.users(id),
  status                public.contract_status not null default 'draft',
  document_url          text,
  brand_signed_at       timestamptz,
  brand_signer_ip       text,
  brand_signer_device   text,
  athlete_signed_at     timestamptz,
  athlete_signer_ip     text,
  athlete_signer_device text,
  agent_signed_at       timestamptz,
  agent_signer_ip       text,
  esignature_provider   text,
  esignature_envelope_id text,
  locked_at             timestamptz,
  terminated_at         timestamptz,
  termination_reason    text,
  -- Set by trigger: locked_at + 7 years (legal retention requirement)
  retain_until          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Trigger: when locked_at is set, compute retain_until = locked_at + 7 years
create or replace function public.set_contract_retain_until()
returns trigger
language plpgsql
as $$
begin
  if new.locked_at is not null and old.locked_at is null then
    new.retain_until = new.locked_at + interval '7 years';
  end if;
  return new;
end;
$$;

create trigger contracts_set_retain_until
  before update of locked_at on public.contracts
  for each row execute procedure public.set_contract_retain_until();

create trigger set_contracts_updated_at
  before update on public.contracts
  for each row execute procedure public.set_updated_at();

alter table public.contracts enable row level security;

create policy "contracts_select"
  on public.contracts for select
  using (
    brand_id = auth.uid()
    or athlete_or_team_id = auth.uid()
    or agent_id = auth.uid()
    or public.is_admin()
  );

-- Contracts are written by service role only (e-signature webhook handler)
-- No client INSERT or UPDATE policies — service role bypasses RLS
-- No DELETE ever
