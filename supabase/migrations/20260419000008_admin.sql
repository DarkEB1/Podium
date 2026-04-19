-- ============================================================
-- REPORTS (user-submitted content/profile reports)
-- ============================================================

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid references public.users(id) on delete set null,
  reported_message_id uuid references public.messages(id) on delete set null,
  reason           public.report_reason not null,
  detail           text,
  status           public.report_status not null default 'pending',
  admin_notes      text,
  resolved_by      uuid references public.users(id),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint reports_must_have_target
    check (reported_user_id is not null or reported_message_id is not null)
);

create trigger set_reports_updated_at
  before update on public.reports
  for each row execute procedure public.set_updated_at();

alter table public.reports enable row level security;

-- Reporter sees own reports; admin sees all
create policy "reports_select"
  on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

-- Any authenticated user can file a report
create policy "reports_insert"
  on public.reports for insert
  with check (reporter_id = auth.uid());

-- Only admin updates reports (status, resolution)
create policy "reports_update"
  on public.reports for update
  using (public.is_admin());

-- ============================================================
-- AUDIT LOGS (append-only — no UPDATE or DELETE ever)
-- ============================================================

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  -- NULL for system-generated actions (cron jobs, webhooks)
  actor_id    uuid references public.users(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid not null,
  metadata    jsonb not null default '{}',
  ip_address  text,
  created_at  timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Admin-only read; service role INSERT only; no UPDATE or DELETE from any role
create policy "audit_logs_select"
  on public.audit_logs for select
  using (public.is_admin());

-- No client INSERT policy — service role only
-- No UPDATE policy
-- No DELETE policy
