-- Launch-critical cron overlap protection and atomic in-app notification
-- idempotency. This migration intentionally leaves the existing notification
-- SELECT policy and authenticated table grants unchanged.

alter table public.notifications
  add column if not exists event_key text;

alter table public.notifications
  add constraint notifications_event_key_length_check
  check (event_key is null or char_length(event_key) between 1 and 255);

create unique index if not exists notifications_user_event_key_unique
  on public.notifications (user_id, event_key)
  where event_key is not null;

comment on column public.notifications.event_key is
  'Server-generated idempotency key. Null marks legacy notifications that are hidden from the notification centre.';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cron_leases (
  name text primary key,
  lease_token uuid not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint cron_leases_name_check
    check (char_length(name) between 1 and 100)
);

alter table private.cron_leases enable row level security;
revoke all on table private.cron_leases
  from public, anon, authenticated, service_role;

create or replace function public.acquire_cron_lease(
  p_name text,
  p_lease_seconds integer default 90
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private, public, pg_temp
as $$
declare
  v_token uuid := gen_random_uuid();
  v_acquired uuid;
begin
  if p_name is null or char_length(p_name) not between 1 and 100 then
    raise exception 'invalid_cron_lease_name' using errcode = '22023';
  end if;

  if p_lease_seconds not between 30 and 600 then
    raise exception 'invalid_cron_lease_duration' using errcode = '22023';
  end if;

  insert into private.cron_leases as leases (
    name,
    lease_token,
    lease_until,
    updated_at
  )
  values (
    p_name,
    v_token,
    clock_timestamp() + make_interval(secs => p_lease_seconds),
    clock_timestamp()
  )
  on conflict (name) do update
    set lease_token = excluded.lease_token,
        lease_until = excluded.lease_until,
        updated_at = excluded.updated_at
    where leases.lease_until <= clock_timestamp()
  returning lease_token into v_acquired;

  return v_acquired;
end;
$$;

create or replace function public.release_cron_lease(
  p_name text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private, public, pg_temp
as $$
declare
  v_deleted_rows bigint;
begin
  delete from private.cron_leases
  where name = p_name
    and lease_token = p_lease_token;

  get diagnostics v_deleted_rows = row_count;
  return v_deleted_rows = 1;
end;
$$;

revoke all on function public.acquire_cron_lease(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.release_cron_lease(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.acquire_cron_lease(text, integer)
  to service_role;
grant execute on function public.release_cron_lease(text, uuid)
  to service_role;

-- Winner and non-winner result notifications are committed with winner
-- selection. Email remains an independently retried side effect.
create or replace function public.select_winner(
  p_contest_id uuid,
  p_submission_id uuid,
  p_contestant_id uuid,
  p_payout_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_prize_amount integer;
  v_contest_title text;
  v_winner_name text;
  v_winner_email text;
  v_winner_upi text;
begin
  select prize_amount, title
    into v_prize_amount, v_contest_title
    from public.contests
    where id = p_contest_id;

  select full_name, email, upi_id
    into v_winner_name, v_winner_email, v_winner_upi
    from public.profiles
    where id = p_contestant_id;

  update public.contests
    set status = 'completed', winner_submission_id = p_submission_id
    where id = p_contest_id;

  update public.submissions
    set status = 'winner'
    where id = p_submission_id;

  update public.submissions
    set status = 'not_selected'
    where contest_id = p_contest_id
      and id != p_submission_id;

  update public.payments
    set payout_status = 'processing', payout_transfer_id = p_payout_id
    where contest_id = p_contest_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    contest_id,
    event_key
  )
  values (
    p_contestant_id,
    'winner',
    'You won!',
    'You won "' || v_contest_title || '". Add your UPI ID so the prize can be transferred.',
    p_contest_id,
    'winner-selected/' || p_contest_id || '/' || p_contestant_id
  )
  on conflict do nothing;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    contest_id,
    event_key
  )
  select
    entries.contestant_id,
    'not_selected',
    'Contest result available',
    'A winner has been selected for "' || v_contest_title || '". You were not selected this time.',
    p_contest_id,
    'winner-not-selected/' || p_contest_id || '/' || entries.contestant_id
  from public.contest_entries as entries
  where entries.contest_id = p_contest_id
    and entries.contestant_id <> p_contestant_id
  on conflict do nothing;

  insert into public.payout_requests (
    contest_id,
    winner_id,
    amount,
    contest_title,
    winner_name,
    winner_email,
    winner_upi,
    status
  )
  values (
    p_contest_id,
    p_contestant_id,
    v_prize_amount,
    v_contest_title,
    coalesce(v_winner_name, 'Unknown'),
    v_winner_email,
    v_winner_upi,
    case
      when v_winner_upi is not null then 'pending_transfer'
      else 'awaiting_upi'
    end
  );
end;
$$;

revoke all on function public.select_winner(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
