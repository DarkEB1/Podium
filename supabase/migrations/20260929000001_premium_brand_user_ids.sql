-- Unlimited-plan perks that athletes must be able to SEE: the "Verified brand"
-- badge and "Featured to athletes in your area" (pricing rework 2026-09-29).
--
-- Both perks are a function of the brand's subscription, but `subscriptions`
-- is readable only by its own brand (and admins) under RLS, so an athlete's
-- session cannot annotate the listings feed by querying it. This SECURITY
-- DEFINER helper answers exactly one narrow question, "which of these brand
-- users are on an active top-tier plan?", and nothing else: no amounts, no
-- Stripe ids, no period dates. Callers pass the brand user_ids already on
-- the page they are rendering, so it cannot enumerate subscribers either.
--
-- Tier 3 is the top tier in lib/entitlements/index.ts (UNLIMITED_TIER). The
-- statuses mirror ACTIVE_STATUSES in lib/supabase/entitlements.ts.

create or replace function public.premium_brand_user_ids(p_user_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct bp.user_id
  from public.subscriptions s
  join public.brand_profiles bp on bp.id = s.brand_id
  where bp.user_id = any (p_user_ids)
    and s.tier >= 3
    and s.status in ('active', 'trialing');
$$;

comment on function public.premium_brand_user_ids(uuid[]) is
  'Subset of the given brand user_ids on an active/trialing top-tier (Unlimited) subscription. Powers the athlete-facing Verified brand badge and Featured rail.';

revoke all on function public.premium_brand_user_ids(uuid[]) from public;
grant execute on function public.premium_brand_user_ids(uuid[]) to authenticated, service_role;
