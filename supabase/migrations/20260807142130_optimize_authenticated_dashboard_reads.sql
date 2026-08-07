-- Narrow authenticated read projections for dashboard navigation.
--
-- These functions intentionally omit contest briefs, materials, submission
-- attachments, payment identifiers, admin notes, profile email, role and UPI.
-- They are read-only and scoped exclusively to auth.uid().

create or replace function public.get_my_contests_dashboard()
returns table (
  entry_id uuid,
  entered_at timestamptz,
  contest_id uuid,
  lister_id uuid,
  title text,
  category text,
  prize_amount integer,
  contest_status text,
  deadline timestamptz,
  entry_deadline timestamptz,
  entry_limit integer,
  max_entries integer,
  public_summary text,
  winner_submission_id uuid,
  lister_name text,
  lister_avatar text,
  submission_id uuid,
  submission_status text,
  submitted_at timestamptz,
  payout_status text,
  payout_amount integer,
  payout_transferred_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  with viewer as (
    select auth.uid() as id
  ),
  participant_contests as (
    select ce.id as entry_id, ce.entered_at, ce.contest_id
    from public.contest_entries as ce
    where ce.contestant_id = (select id from viewer)

    union all

    -- Preserve visibility for any historical winner row whose entry record no
    -- longer exists. Current lifecycle rules keep entries permanently.
    select s.id, s.submitted_at, s.contest_id
    from public.submissions as s
    where s.contestant_id = (select id from viewer)
      and s.status = 'winner'
      and not exists (
        select 1
        from public.contest_entries as ce
        where ce.contest_id = s.contest_id
          and ce.contestant_id = (select id from viewer)
      )
  )
  select
    pc.entry_id,
    pc.entered_at,
    c.id as contest_id,
    c.lister_id,
    c.title,
    c.category,
    c.prize_amount,
    c.status as contest_status,
    c.deadline,
    c.entry_deadline,
    c.entry_limit,
    c.max_entries,
    c.public_summary,
    c.winner_submission_id,
    p.full_name as lister_name,
    p.avatar_url as lister_avatar,
    s.id as submission_id,
    s.status as submission_status,
    s.submitted_at,
    pr.status as payout_status,
    pr.amount as payout_amount,
    pr.transferred_at as payout_transferred_at,
    coalesce(unread.count, 0)::bigint as unread_count
  from participant_contests as pc
  join public.contests as c on c.id = pc.contest_id
  join public.profiles as p on p.id = c.lister_id
  left join public.submissions as s
    on s.contest_id = c.id
   and s.contestant_id = (select id from viewer)
  left join public.payout_requests as pr
    on pr.contest_id = c.id
   and pr.winner_id = (select id from viewer)
  left join lateral (
    select count(*)
    from public.messages as m
    where m.contest_id = c.id
      and m.recipient_id = (select id from viewer)
      and m.read_at is null
  ) as unread on true
  where (select id from viewer) is not null
  order by pc.entered_at desc;
$$;

comment on function public.get_my_contests_dashboard() is
  'Authenticated contestant dashboard projection scoped to auth.uid(); excludes briefs, materials, attachments and payment identifiers.';

revoke all on function public.get_my_contests_dashboard()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_contests_dashboard()
  to authenticated, service_role;

create or replace function public.get_hosted_contests_dashboard()
returns table (
  id uuid,
  title text,
  status text,
  prize_amount integer,
  entry_count bigint,
  submission_count bigint,
  deadline timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    c.id,
    c.title,
    c.status,
    c.prize_amount,
    (select count(*) from public.contest_entries as ce where ce.contest_id = c.id) as entry_count,
    (select count(*) from public.submissions as s where s.contest_id = c.id) as submission_count,
    c.deadline,
    c.created_at
  from public.contests as c
  where c.lister_id = (select auth.uid())
    and (select auth.uid()) is not null
  order by c.created_at desc;
$$;

comment on function public.get_hosted_contests_dashboard() is
  'Authenticated creator dashboard projection scoped to auth.uid(); excludes briefs, payment identifiers and participant records.';

revoke all on function public.get_hosted_contests_dashboard()
  from public, anon, authenticated, service_role;
grant execute on function public.get_hosted_contests_dashboard()
  to authenticated, service_role;
