-- Per-signer audit records for the in-house e-signature flow.
-- One row per party per contract. Written by the service role only (mirrors
-- public.contracts, which has no client write policy); readable by the
-- contract's participants and admins.

create table public.contract_signatures (
  id                   uuid primary key default gen_random_uuid(),
  contract_id          uuid not null references public.contracts(id) on delete restrict,
  signer_role          text not null check (signer_role in ('brand', 'athlete', 'agent')),
  signer_user_id       uuid not null references public.users(id),
  typed_name           text not null,
  signature_image_path text,
  consent_text         text not null,
  signer_ip            text,
  signer_device        text,
  signed_at            timestamptz not null,
  signature_hash       text not null,
  created_at           timestamptz not null default now(),
  unique (contract_id, signer_role)
);

comment on table public.contract_signatures is
  'Audit record of each party''s electronic signature on a contract (in-house SES). Service-role writes only; participants + admin read.';

alter table public.contract_signatures enable row level security;

-- Participants of the parent contract, or an admin, may read the signatures.
create policy contract_signatures_select on public.contract_signatures
  for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.contracts c
      where c.id = contract_signatures.contract_id
        and (
          c.brand_id = auth.uid()
          or c.athlete_or_team_id = auth.uid()
          or c.agent_id = auth.uid()
        )
    )
  );

-- No INSERT/UPDATE/DELETE policy: writes are service-role only.
