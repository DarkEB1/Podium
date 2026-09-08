-- SHA-256 (hex) of the final signed PDF stored at contracts.document_url, so a
-- downloaded document can be verified against the record. document_url,
-- esignature_provider and esignature_envelope_id already exist on the table.

alter table public.contracts
  add column if not exists document_hash text;

comment on column public.contracts.document_hash is
  'Lowercase hex SHA-256 of the signed PDF at document_url; set by finalizeContractDocument().';
