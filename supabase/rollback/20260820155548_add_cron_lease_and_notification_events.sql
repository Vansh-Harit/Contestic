-- Roll back cron leasing and keyed notifications while restoring the previous
-- winner-selection notification behavior.

create or replace function public.select_winner(
  p_contest_id uuid,
  p_submission_id uuid,
  p_contestant_id uuid,
  p_payout_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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
    contest_id
  )
  values (
    p_contestant_id,
    'winner',
    'You won!',
    'You won "' || v_contest_title || '". Our team will contact you within 24-48 working hours to arrange your prize transfer. Make sure to add your UPI ID to receive it faster.',
    p_contest_id
  );

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

drop function if exists public.release_cron_lease(text, uuid);
drop function if exists public.acquire_cron_lease(text, integer);
drop table if exists private.cron_leases;

drop index if exists public.notifications_user_event_key_unique;
alter table public.notifications drop column if exists event_key;
