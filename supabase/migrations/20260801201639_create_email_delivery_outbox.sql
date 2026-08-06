-- Task 8: durable, service-only email delivery outbox.
-- Business routes enqueue one row per idempotency key. Scheduled processing
-- claims due rows with row locks so concurrent workers cannot send one delivery
-- twice. The table is deliberately inaccessible to browser roles because it
-- contains recipient addresses and compact template data.

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_type text not null,
  contest_id uuid references public.contests(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_deliveries_idempotency_key_length
    check (char_length(idempotency_key) between 1 and 200),
  constraint email_deliveries_event_type
    check (event_type in (
      'contest_live',
      'entry_confirmed',
      'submission_open',
      'entry_closed_lister',
      'new_submission',
      'empty_contest_refund',
      'judging_open',
      'admin_judging_overdue',
      'winner_selected',
      'winner_not_selected',
      'admin_payout_required',
      'payout_transferred'
    )),
  constraint email_deliveries_payload_size
    check (octet_length(payload::text) <= 8192)
);

create index if not exists email_deliveries_due_idx
  on public.email_deliveries (status, next_attempt_at, created_at)
  where status in ('pending', 'processing', 'failed');

create index if not exists email_deliveries_contest_idx
  on public.email_deliveries (contest_id);

alter table public.email_deliveries enable row level security;

revoke all privileges on table public.email_deliveries
  from public, anon, authenticated;
grant select, insert, update, delete on table public.email_deliveries
  to service_role;

create or replace function public.claim_due_email_deliveries(
  p_limit integer default 25
)
returns setof public.email_deliveries
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  return query
  with candidates as (
    select delivery.id
    from public.email_deliveries as delivery
    where (
        (
          delivery.status in ('pending', 'failed')
          and delivery.attempts < delivery.max_attempts
          and (
            delivery.next_attempt_at is null
            or delivery.next_attempt_at <= now()
          )
        )
        or (
          delivery.status = 'processing'
          and delivery.locked_at < now() - interval '10 minutes'
        )
      )
    order by delivery.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  update public.email_deliveries as delivery
  set status = 'processing',
      attempts = case
        when delivery.status = 'processing' then delivery.attempts
        else delivery.attempts + 1
      end,
      locked_at = now(),
      updated_at = now(),
      last_error = null
  from candidates
  where delivery.id = candidates.id
  returning delivery.*;
end;
$$;

revoke all on function public.claim_due_email_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_email_deliveries(integer)
  to service_role;
