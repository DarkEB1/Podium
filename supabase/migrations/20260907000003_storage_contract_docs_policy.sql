-- Signed contract documents live under docs/contracts/<contractId>/… (NOT under
-- an owner uid folder), so the existing owner/can_read_user_folder policies do
-- not grant read. This policy grants read to the contract's participants,
-- independent of match status: a signed contract must stay downloadable to the
-- parties for its retention window even if the match later deactivates.

create policy select_contract_docs on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'docs'
    and (storage.foldername(name))[1] = 'contracts'
    and exists (
      select 1 from public.contracts c
      where c.id::text = (storage.foldername(name))[2]
        and (
          c.brand_id = auth.uid()
          or c.athlete_or_team_id = auth.uid()
          or c.agent_id = auth.uid()
        )
    )
  );
