-- Corrective migration: add unique constraint to prevent duplicate pending connection requests.
-- A partial index (status = 'pending') allows re-requesting after withdrawal or decline.
create unique index connection_requests_unique_pending_pair
  on public.connection_requests (sender_id, recipient_id)
  where status = 'pending';
