-- =============================================================================
-- Closes the documented follow-up left by
-- 20260720006000_stripe_webhook_claim_and_customer_guard.sql
-- =============================================================================
-- That migration added:
--   subscriptions_stripe_customer_id_not_blank
--   subscriptions_stripe_subscription_id_not_blank
-- as NOT VALID, because existing rows could not be inspected from the repository
-- and a failed VALIDATE would have failed the deploy. Its own comment says to
-- run VALIDATE CONSTRAINT once the existing rows have been checked.
--
-- Doing that unconditionally would just move the deploy failure here. Instead
-- each constraint is validated inside its own sub-transaction: if every row
-- already satisfies it (the expected case) the constraint flips to validated and
-- the guarantee becomes retroactive. If a legacy blank-id row exists, the
-- validation is rolled back, a WARNING names the constraint, and the constraint
-- stays NOT VALID — still enforcing every future INSERT/UPDATE, exactly as
-- before. The deploy is never blocked by historical data.
--
-- Idempotent: validating an already-validated constraint is a no-op, so this
-- migration is safe to re-run.
--
-- Blank ids are now also much less likely to appear in the first place: the
-- webhook refuses to write a subscription with no resolvable Stripe customer,
-- and app/api/cron/reconcile-subscriptions re-reads every subscription from
-- Stripe and corrects drift.
-- =============================================================================

do $$
declare
  v_constraint text;
begin
  foreach v_constraint in array array[
    'subscriptions_stripe_customer_id_not_blank',
    'subscriptions_stripe_subscription_id_not_blank'
  ]
  loop
    -- Skip cleanly if an environment predates 20260720006000.
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'subscriptions'
        and c.conname = v_constraint
    ) then
      raise warning 'constraint %.% not present; nothing to validate',
        'public.subscriptions', v_constraint;
      continue;
    end if;

    begin
      execute format(
        'alter table public.subscriptions validate constraint %I', v_constraint
      );
      raise notice 'validated constraint public.subscriptions.%', v_constraint;
    exception when check_violation then
      -- Legacy rows hold a blank Stripe id. Leave the constraint NOT VALID (it
      -- still guards every new write) and surface the row count for repair.
      raise warning
        'constraint % could not be validated: existing subscriptions rows hold a blank Stripe id. The constraint remains NOT VALID and still enforces all new writes. Repair the offending rows, then re-run: alter table public.subscriptions validate constraint %;',
        v_constraint, v_constraint;
    end;
  end loop;
end;
$$;
