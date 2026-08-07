-- Run after 20260807142130_optimize_authenticated_dashboard_reads.sql inside
-- an outer transaction. The verification harness must issue ROLLBACK.

do $$
begin
  if to_regprocedure('public.get_my_contests_dashboard()') is null then
    raise exception 'get_my_contests_dashboard is missing';
  end if;

  if to_regprocedure('public.get_hosted_contests_dashboard()') is null then
    raise exception 'get_hosted_contests_dashboard is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_my_contests_dashboard()',
    'execute'
  ) then
    raise exception 'anon can execute contestant dashboard projection';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_hosted_contests_dashboard()',
    'execute'
  ) then
    raise exception 'anon can execute hosted dashboard projection';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_contests_dashboard()',
    'execute'
  ) then
    raise exception 'authenticated cannot execute contestant dashboard projection';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_hosted_contests_dashboard()',
    'execute'
  ) then
    raise exception 'authenticated cannot execute hosted dashboard projection';
  end if;

  if exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_my_contests_dashboard',
        'get_hosted_contests_dashboard'
      )
      and (
        p.prosecdef is not true
        or not coalesce(p.proconfig, '{}'::text[]) @> array[
          'search_path=pg_catalog, public, pg_temp'
        ]
      )
  ) then
    raise exception 'dashboard projection security configuration is unsafe';
  end if;
end;
$$;

-- Contract check: sensitive values must not be part of either RPC result.
do $$
declare
  sensitive_name text;
begin
  select output_name
  into sensitive_name
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  cross join lateral unnest(p.proargnames) as names(output_name)
  where n.nspname = 'public'
    and p.proname in (
      'get_my_contests_dashboard',
      'get_hosted_contests_dashboard'
    )
    and output_name = any (array[
      'description',
      'materials',
      'file_url',
      'file_urls',
      'razorpay_order_id',
      'razorpay_payment_id',
      'winner_upi',
      'admin_note',
      'email',
      'role'
    ])
  limit 1;

  if sensitive_name is not null then
    raise exception 'dashboard projection exposes sensitive column: %', sensitive_name;
  end if;
end;
$$;

create temporary table dashboard_read_test_users as
select
  id,
  email,
  coalesce(full_name, 'Test user') as full_name,
  row_number() over (order by created_at, id) as user_number
from public.profiles
order by created_at, id
limit 2;

do $$
begin
  if (select count(*) from dashboard_read_test_users) < 2 then
    raise exception 'dashboard assertions require two existing test users';
  end if;
end;
$$;

grant select on dashboard_read_test_users to authenticated;

create or replace function pg_temp.assert_dashboard(
  condition boolean,
  assertion_name text
)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'dashboard assertion failed: %', assertion_name;
  end if;
end;
$$;

insert into public.contests (
  id, lister_id, title, description, public_summary, category,
  prize_amount, platform_fee, total_charged, max_entries, deadline,
  entry_deadline, entry_limit, entry_window_hours, ai_policy, status
)
select
  stage.id,
  creator.id,
  stage.title,
  repeat(stage.title || ' private brief ', 4),
  stage.title || ' public summary',
  'Design',
  50000,
  1250,
  51250,
  10,
  stage.deadline,
  stage.entry_deadline,
  10,
  24,
  'none',
  stage.status
from dashboard_read_test_users as creator
cross join (
  values
    ('00000000-0000-4000-8000-000000000201'::uuid, 'Read draft stage', 'draft', now() + interval '3 days', now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'Read entry stage', 'active', now() + interval '3 days', now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'Read submit stage', 'active', now() + interval '2 days', now() - interval '1 day'),
    ('00000000-0000-4000-8000-000000000204'::uuid, 'Read judging stage', 'judging', now() - interval '1 hour', now() - interval '2 days'),
    ('00000000-0000-4000-8000-000000000205'::uuid, 'Read completed stage', 'completed', now() - interval '2 days', now() - interval '4 days'),
    ('00000000-0000-4000-8000-000000000206'::uuid, 'Read cancelled stage', 'cancelled', now() - interval '2 days', now() - interval '4 days'),
    ('00000000-0000-4000-8000-000000000207'::uuid, 'Read unrelated stage', 'active', now() + interval '3 days', now() + interval '1 day')
) as stage(id, title, status, deadline, entry_deadline)
where creator.user_number = 1;

insert into public.contest_entries (contest_id, contestant_id)
select
  fixture.contest_id,
  contestant.id
from dashboard_read_test_users as contestant
cross join unnest(array[
  '00000000-0000-4000-8000-000000000201'::uuid,
  '00000000-0000-4000-8000-000000000202'::uuid,
  '00000000-0000-4000-8000-000000000203'::uuid,
  '00000000-0000-4000-8000-000000000204'::uuid,
  '00000000-0000-4000-8000-000000000205'::uuid,
  '00000000-0000-4000-8000-000000000206'::uuid
]) as fixture(contest_id)
where contestant.user_number = 2;

-- Creator projection: only the creator receives all of their fixture rows.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from dashboard_read_test_users where user_number = 1),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select pg_temp.assert_dashboard(
  (select count(*) from public.get_hosted_contests_dashboard()
    where id between
      '00000000-0000-4000-8000-000000000201'::uuid and
      '00000000-0000-4000-8000-000000000207'::uuid) = 7,
  'creator sees hosted contests at every lifecycle stage'
);
select pg_temp.assert_dashboard(
  (select count(*) from public.get_my_contests_dashboard()
    where contest_id between
      '00000000-0000-4000-8000-000000000201'::uuid and
      '00000000-0000-4000-8000-000000000207'::uuid) = 0,
  'creator does not receive unrelated contestant dashboard rows'
);
reset role;

-- Contestant projection: entered contests are visible at every stage, while
-- the unrelated contest and creator dashboard remain inaccessible.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from dashboard_read_test_users where user_number = 2),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select pg_temp.assert_dashboard(
  (select count(*) from public.get_my_contests_dashboard()
    where contest_id between
      '00000000-0000-4000-8000-000000000201'::uuid and
      '00000000-0000-4000-8000-000000000207'::uuid) = 6,
  'contestant sees only entered contests across lifecycle stages'
);
select pg_temp.assert_dashboard(
  not exists (
    select 1 from public.get_my_contests_dashboard()
    where contest_id = '00000000-0000-4000-8000-000000000207'::uuid
  ),
  'contestant cannot see an unrelated contest in private projection'
);
select pg_temp.assert_dashboard(
  (select count(*) from public.get_hosted_contests_dashboard()
    where id between
      '00000000-0000-4000-8000-000000000201'::uuid and
      '00000000-0000-4000-8000-000000000207'::uuid) = 0,
  'contestant cannot see another creator hosted dashboard'
);
reset role;
