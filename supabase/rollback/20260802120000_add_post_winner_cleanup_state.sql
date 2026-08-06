drop index if exists public.idx_contests_due_chat_purge;
drop index if exists public.idx_contests_pending_submission_cleanup;

drop policy if exists "Own read" on public.submissions;
create policy "Own read"
  on public.submissions
  for select
  to authenticated
  using ((select auth.uid()) = contestant_id);

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
    )
  );

drop policy if exists "Participants read" on public.messages;
create policy "Participants read"
  on public.messages
  for select
  to authenticated
  using (
    (select auth.uid()) = sender_id
    or (select auth.uid()) = recipient_id
  );

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
end;
$$;

revoke all on function public.select_contest_winner(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.select_contest_winner(uuid, uuid, uuid, text)
  to service_role;

alter table public.contests
  drop constraint if exists contests_submission_cleanup_status_check,
  drop column if exists chat_purged_at,
  drop column if exists chat_purge_after,
  drop column if exists submission_cleanup_completed_at,
  drop column if exists submission_cleanup_status;
