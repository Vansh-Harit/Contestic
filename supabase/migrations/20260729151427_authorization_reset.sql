-- Contestic authorization reset.
--
-- Public discovery remains available only through get_visible_contests().
-- User-scoped clients retain narrowly scoped reads. All sensitive writes are
-- performed by authenticated application routes using the service-role client.
-- The service-only functions below repeat critical lifecycle checks and lock
-- the contest row so capacity and winner transitions are atomic.

-- Remove policies that permit clients to bypass route-level authorization.
drop policy if exists "Public read" on public.profiles;
drop policy if exists "Own update" on public.profiles;

drop policy if exists "Lister insert" on public.contests;
drop policy if exists "Lister update own" on public.contests;

drop policy if exists "Authenticated users can enter active contests"
  on public.contest_entries;
drop policy if exists "Contestants can withdraw during entry phase"
  on public.contest_entries;

drop policy if exists "Authenticated submit" on public.submissions;

drop policy if exists "Listers can manage own contest materials"
  on public.contest_materials;
drop policy if exists "Entered participants can read materials after entry closes"
  on public.contest_materials;

drop policy if exists "Authenticated send" on public.messages;
drop policy if exists "Recipient mark read" on public.messages;

drop policy if exists "Own update" on public.notifications;
drop policy if exists "Lister read own payments" on public.payments;
drop policy if exists "Winners can add their UPI" on public.payout_requests;

-- Recreate retained read policies with explicit roles and stable auth lookups.
drop policy if exists "Own profile read" on public.profiles;
create policy "Own profile read"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Lister read own" on public.contests;
create policy "Lister read own"
  on public.contests
  for select
  to authenticated
  using ((select auth.uid()) = lister_id);

drop policy if exists "Contestants can view own entries"
  on public.contest_entries;
create policy "Contestants can view own entries"
  on public.contest_entries
  for select
  to authenticated
  using ((select auth.uid()) = contestant_id);

drop policy if exists "Listers can view entries for own contests"
  on public.contest_entries;
create policy "Listers can view entries for own contests"
  on public.contest_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.contests as c
      where c.id = contest_entries.contest_id
        and c.lister_id = (select auth.uid())
    )
  );

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

drop policy if exists "Own read" on public.notifications;
create policy "Own read"
  on public.notifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Winners can view own payout request"
  on public.payout_requests;
create policy "Winners can view own payout request"
  on public.payout_requests
  for select
  to authenticated
  using ((select auth.uid()) = winner_id);

-- Remove broad default Data API privileges, then grant only required reads.
revoke all privileges on table public.profiles
  from public, anon, authenticated;
revoke all privileges on table public.contests
  from public, anon, authenticated;
revoke all privileges on table public.contest_entries
  from public, anon, authenticated;
revoke all privileges on table public.contest_materials
  from public, anon, authenticated;
revoke all privileges on table public.submissions
  from public, anon, authenticated;
revoke all privileges on table public.messages
  from public, anon, authenticated;
revoke all privileges on table public.notifications
  from public, anon, authenticated;
revoke all privileges on table public.payments
  from public, anon, authenticated;
revoke all privileges on table public.payout_requests
  from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.contests to authenticated;
grant select on table public.contest_entries to authenticated;
grant select on table public.submissions to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.payout_requests to authenticated;

-- Keep the legacy view technical-only and read-only.
revoke all privileges on table public.contests_with_counts
  from public, anon, authenticated, service_role;
grant select on table public.contests_with_counts to service_role;

-- Expose only the existing public-facing profile fields. The base table stays
-- own-only so email, role, UPI and other private fields cannot be enumerated.
create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.id, p.full_name, p.avatar_url
  from public.profiles as p
  where p.id = p_profile_id;
$$;

revoke all on function public.get_public_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_profile(uuid)
  to anon, authenticated, service_role;

create or replace function public.enter_contest_authorized(
  p_contest_id uuid,
  p_contestant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_contest public.contests%rowtype;
  v_entry_count bigint;
  v_entry_limit integer;
  v_entry_id uuid;
begin
  select *
    into v_contest
    from public.contests
    where id = p_contest_id
    for update;

  if not found then
    raise exception 'contest_not_found' using errcode = 'P0001';
  end if;
  if v_contest.lister_id = p_contestant_id then
    raise exception 'creator_cannot_enter' using errcode = 'P0001';
  end if;
  if v_contest.status <> 'active' then
    raise exception 'entry_not_open' using errcode = 'P0001';
  end if;
  if v_contest.entry_deadline is not null
     and v_contest.entry_deadline <= now() then
    raise exception 'entry_not_open' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.contest_entries
    where contest_id = p_contest_id
      and contestant_id = p_contestant_id
  ) then
    raise exception 'duplicate_entry' using errcode = 'P0001';
  end if;

  v_entry_limit := coalesce(v_contest.entry_limit, v_contest.max_entries);
  select count(*)
    into v_entry_count
    from public.contest_entries
    where contest_id = p_contest_id;

  if v_entry_count >= v_entry_limit then
    raise exception 'entry_capacity_reached' using errcode = 'P0001';
  end if;

  insert into public.contest_entries (contest_id, contestant_id)
  values (p_contest_id, p_contestant_id)
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

create or replace function public.create_submission_authorized(
  p_contest_id uuid,
  p_contestant_id uuid,
  p_content text,
  p_file_urls jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_contest public.contests%rowtype;
  v_entry_count bigint;
  v_submission_count bigint;
  v_limit integer;
  v_submission_id uuid;
begin
  select *
    into v_contest
    from public.contests
    where id = p_contest_id
    for update;

  if not found then
    raise exception 'contest_not_found' using errcode = 'P0001';
  end if;
  if v_contest.lister_id = p_contestant_id then
    raise exception 'creator_cannot_submit' using errcode = 'P0001';
  end if;
  if v_contest.status <> 'active'
     or v_contest.deadline <= now() then
    raise exception 'submission_not_open' using errcode = 'P0001';
  end if;

  v_limit := coalesce(v_contest.entry_limit, v_contest.max_entries);
  select count(*)
    into v_entry_count
    from public.contest_entries
    where contest_id = p_contest_id;

  if v_contest.entry_deadline is not null then
    if not exists (
      select 1
      from public.contest_entries
      where contest_id = p_contest_id
        and contestant_id = p_contestant_id
    ) then
      raise exception 'contestant_not_entered' using errcode = 'P0001';
    end if;

    if v_contest.entry_deadline > now()
       and v_entry_count < v_limit then
      raise exception 'submission_not_open' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.submissions
    where contest_id = p_contest_id
      and contestant_id = p_contestant_id
  ) then
    raise exception 'duplicate_submission' using errcode = 'P0001';
  end if;

  select count(*)
    into v_submission_count
    from public.submissions
    where contest_id = p_contest_id;

  if v_submission_count >= v_limit then
    raise exception 'submission_capacity_reached' using errcode = 'P0001';
  end if;

  insert into public.submissions (
    contest_id,
    contestant_id,
    content,
    file_urls
  )
  values (
    p_contest_id,
    p_contestant_id,
    p_content,
    coalesce(p_file_urls, '[]'::jsonb)
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

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

revoke all on function public.enter_contest_authorized(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_submission_authorized(
  uuid, uuid, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.select_contest_winner(
  uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

grant execute on function public.enter_contest_authorized(uuid, uuid)
  to service_role;
grant execute on function public.create_submission_authorized(
  uuid, uuid, text, jsonb
) to service_role;
grant execute on function public.select_contest_winner(
  uuid, uuid, uuid, text
) to service_role;

-- The validated wrapper is the only service-role entry point for selection.
revoke execute on function public.select_winner(uuid, uuid, uuid, text)
  from service_role;
