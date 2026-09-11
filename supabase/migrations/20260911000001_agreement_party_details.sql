-- Agreement identity fields: postal addresses + a brand's signing
-- representative. These fill the only Section 1 blanks of the vetted sponsorship
-- agreement that had no schema source. All nullable and additive, so existing
-- rows and already-signed contracts are unaffected (the PDF omits blank lines).

alter table public.brand_profiles
  add column if not exists registered_address text,
  add column if not exists representative_name text,
  add column if not exists representative_title text;

alter table public.athlete_profiles
  add column if not exists address text;

alter table public.team_profiles
  add column if not exists registered_address text;

comment on column public.brand_profiles.representative_name is
  'Name of the individual signing the sponsorship agreement for the brand.';
comment on column public.brand_profiles.representative_title is
  'Title of the brand''s signing representative (e.g. Marketing Director).';
