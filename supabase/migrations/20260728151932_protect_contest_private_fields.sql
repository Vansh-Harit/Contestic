-- Public contest discovery is an explicit, narrow API. Sensitive payment
-- fields are never returned, and the full brief is returned only to the
-- contest owner or an entered participant after the entry phase closes.
create or replace function public.get_visible_contests(
  p_contest_id uuid default null
)
returns table (
  id uuid,
  lister_id uuid,
  title text,
  public_summary text,
  description text,
  category text,
  prize_amount integer,
  max_entries integer,
  deadline timestamptz,
  entry_deadline timestamptz,
  entry_limit integer,
  entry_window_hours integer,
  ai_policy text,
  status text,
  winner_submission_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  submission_count bigint,
  entry_count bigint,
  lister_name text,
  lister_avatar text,
  profiles jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    c.id,
    c.lister_id,
    c.title,
    c.public_summary,
    case
      when (select auth.uid()) = c.lister_id
        or (
          (select auth.uid()) is not null
          and exists (
            select 1
            from public.contest_entries as own_entry
            where own_entry.contest_id = c.id
              and own_entry.contestant_id = (select auth.uid())
          )
          and (
            c.entry_deadline <= now()
            or counts.entry_count >= coalesce(c.entry_limit, c.max_entries)
          )
        )
      then c.description
      else null
    end as description,
    c.category,
    c.prize_amount,
    c.max_entries,
    c.deadline,
    c.entry_deadline,
    c.entry_limit,
    c.entry_window_hours,
    c.ai_policy,
    c.status,
    c.winner_submission_id,
    c.created_at,
    c.updated_at,
    counts.submission_count,
    counts.entry_count,
    p.full_name as lister_name,
    p.avatar_url as lister_avatar,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url
    ) as profiles
  from public.contests as c
  join public.profiles as p on p.id = c.lister_id
  cross join lateral (
    select
      (select count(*) from public.submissions as s where s.contest_id = c.id) as submission_count,
      (select count(*) from public.contest_entries as ce where ce.contest_id = c.id) as entry_count
  ) as counts
  where c.status in ('active', 'judging', 'completed', 'cancelled')
    and (p_contest_id is null or c.id = p_contest_id);
$$;

revoke all on function public.get_visible_contests(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_visible_contests(uuid)
  to anon, authenticated, service_role;

-- The legacy counts view remains available to trusted cron/server code only.
-- security_invoker makes the view obey the invoking role's RLS behavior.
alter view public.contests_with_counts set (security_invoker = true);
revoke all on public.contests_with_counts from public, anon, authenticated;
grant select on public.contests_with_counts to service_role;

-- Direct contest-table reads are owner-only. Public/participant reads use the
-- narrow function above, while trusted server routes use the service role.
drop policy if exists "Public read active" on public.contests;
drop policy if exists "Lister read own" on public.contests;
drop policy if exists "Lister insert" on public.contests;
drop policy if exists "Lister update own" on public.contests;

create policy "Lister read own"
  on public.contests
  for select
  to authenticated
  using ((select auth.uid()) = lister_id);

create policy "Lister insert"
  on public.contests
  for insert
  to authenticated
  with check ((select auth.uid()) = lister_id);

create policy "Lister update own"
  on public.contests
  for update
  to authenticated
  using ((select auth.uid()) = lister_id)
  with check ((select auth.uid()) = lister_id);

revoke all on public.contests from anon;
revoke all on public.contests from authenticated;
grant select, insert, update on public.contests to authenticated;
