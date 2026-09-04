-- WS-ADMIN / reports — a user could file the same report over and over, and
-- each duplicate landed in the moderation queue a human reads. There was no
-- uniqueness constraint on the reports table.
--
-- These partial unique indexes allow only ONE open (pending or under_review)
-- report per (reporter, target). A previously resolved/dismissed report does not
-- block a fresh one, so a repeat offender can still be reported again later. The
-- insert path maps the resulting 23505 to a 409 DUPLICATE_REPORT.

create unique index if not exists reports_one_open_per_user_target
  on public.reports (reporter_id, reported_user_id)
  where reported_user_id is not null and status in ('pending', 'under_review');

create unique index if not exists reports_one_open_per_message_target
  on public.reports (reporter_id, reported_message_id)
  where reported_message_id is not null and status in ('pending', 'under_review');
