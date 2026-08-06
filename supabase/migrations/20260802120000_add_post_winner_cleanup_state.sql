-- Track post-winner R2 cleanup and delayed chat retention without exposing a
-- new Data API table. Existing completed contests remain not_required so this
-- migration never schedules historical objects for deletion.
alter table public.contests
  add column submission_cleanup_status text not null default 'not_required',
  add column submission_cleanup_completed_at timestamptz,
  add column chat_purge_after timestamptz,
  add column chat_purged_at timestamptz;

alter table public.contests
  add constraint contests_submission_cleanup_status_check
  check (submission_cleanup_status in ('not_required', 'pending', 'completed'));

create index idx_contests_pending_submission_cleanup
  on public.contests (updated_at)
  where submission_cleanup_status = 'pending';

create index idx_contests_due_chat_purge
  on public.contests (chat_purge_after)
  where chat_purge_after is not null and chat_purged_at is null;

-- Completed contests retain submission rows and external links for records,
-- but neither contestants nor creators may retrieve them through the Data API.
drop policy if exists "Own read" on public.submissions;
create policy "Own read"
  on public.submissions
  for select
  to authenticated
  using (
    (select auth.uid()) = contestant_id
    and exists (
      select 1
      from public.contests as c
      where c.id = submissions.contest_id
        and c.status not in ('completed', 'cancelled')
    )
  );

drop policy if exists "Lister read contest submissions"
  on public.submissions;
create policy "Lister read contest submissions"
  on public.submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.contests as c
      where c.id = submissions.contest_id
        and c.lister_id = (select auth.uid())
        and c.status not in ('completed', 'cancelled')
    )
  );

-- Chat rows remain available to the trusted server for 90-day dispute
-- retention, while direct participant reads stop as soon as the contest ends.
drop policy if exists "Participants read" on public.messages;
create policy "Participants read"
  on public.messages
  for select
  to authenticated
  using (
    ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id)
    and exists (
      select 1
      from public.contests as c
      where c.id = messages.contest_id
        and c.status not in ('completed', 'cancelled')
    )
  );

-- Winner selection and cleanup scheduling are committed atomically. The R2
-- deletion itself remains an external, retryable operation.
create or replace function public.select_contest_winner(
  p_contest_id uuid,
  p_submission_id uuid,
  p_actor_id uuid,
  p_payout_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_contest public.contests%rowtype;
  v_contestant_id uuid;
begin
  select *
    into v_contest
    from public.contests
    where id = p_contest_id
    for update;

  if not found then
    raise exception 'contest_not_found' using errcode = 'P0001';
  end if;
  if v_contest.lister_id <> p_actor_id then
    raise exception 'winner_actor_not_creator' using errcode = 'P0001';
  end if;
  if v_contest.status <> 'judging' then
    raise exception 'winner_selection_not_open' using errcode = 'P0001';
  end if;
  if v_contest.winner_submission_id is not null then
    raise exception 'winner_already_selected' using errcode = 'P0001';
  end if;

  select contestant_id
    into v_contestant_id
    from public.submissions
    where id = p_submission_id
      and contest_id = p_contest_id
    for update;

  if not found then
    raise exception 'submission_not_in_contest' using errcode = 'P0001';
  end if;

  perform public.select_winner(
    p_contest_id,
    p_submission_id,
    v_contestant_id,
    p_payout_id
  );

  update public.contests
  set submission_cleanup_status = 'pending',
      submission_cleanup_completed_at = null,
      chat_purge_after = now() + interval '90 days',
      chat_purged_at = null
  where id = p_contest_id;
end;
$$;

revoke all on function public.select_contest_winner(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.select_contest_winner(uuid, uuid, uuid, text)
  to service_role;
