-- Run after 20260729151427_authorization_reset.sql in the same transaction.
-- The outer verification harness must issue ROLLBACK after these assertions.

create temporary table authorization_test_users as
select
  id,
  row_number() over (order by created_at, id) as user_number
from public.profiles
order by created_at, id
limit 2;

do $$
begin
  if (select count(*) from authorization_test_users) < 2 then
    raise exception 'authorization assertions require two existing test users';
  end if;
end;
$$;

grant select on authorization_test_users to anon, authenticated, service_role;

create or replace function pg_temp.assert_true(
  condition boolean,
  assertion_name text
)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'authorization assertion failed: %', assertion_name;
  end if;
end;
$$;

create or replace function pg_temp.assert_forbidden(
  statement text,
  assertion_name text
)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
    raise exception 'authorization assertion failed: %', assertion_name;
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

update public.profiles
set role = 'admin'
where id = (
  select id from authorization_test_users where user_number = 2
);

insert into public.contests (
  id, lister_id, title, description, public_summary, category,
  prize_amount, platform_fee, total_charged, max_entries, deadline,
  entry_deadline, entry_limit, entry_window_hours, ai_policy, status
)
select
  stage.id,
  users.id,
  stage.title,
  repeat(stage.title || ' private brief ', 4),
  stage.title || ' public summary',
  'Design',
  50000,
  5000,
  55000,
  10,
  stage.deadline,
  stage.entry_deadline,
  10,
  24,
  'none',
  stage.status
from authorization_test_users users
cross join (
  values
    ('00000000-0000-4000-8000-000000000101'::uuid, 'Draft stage', 'draft', now() + interval '3 days', now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'Entry stage', 'active', now() + interval '3 days', now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'Submit stage', 'active', now() + interval '2 days', now() - interval '1 day'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'Judging stage', 'judging', now() - interval '1 hour', now() - interval '2 days'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'Complete stage', 'completed', now() - interval '2 days', now() - interval '4 days'),
    ('00000000-0000-4000-8000-000000000106'::uuid, 'Cancel stage', 'cancelled', now() - interval '2 days', now() - interval '4 days'),
    ('00000000-0000-4000-8000-000000000107'::uuid, 'Open route stage', 'active', now() + interval '3 days', now() + interval '1 day'),
    ('00000000-0000-4000-8000-000000000108'::uuid, 'Unrelated stage', 'active', now() + interval '3 days', now() + interval '1 day')
) as stage(id, title, status, deadline, entry_deadline)
where users.user_number = 1;

insert into public.contest_materials (
  contest_id, type, label, content
)
select id, 'text', 'Private material', 'private'
from public.contests
where id between
  '00000000-0000-4000-8000-000000000101'::uuid
  and '00000000-0000-4000-8000-000000000108'::uuid;

insert into public.contest_entries (contest_id, contestant_id)
select
  contest_id,
  (select id from authorization_test_users where user_number = 2)
from unnest(array[
  '00000000-0000-4000-8000-000000000102'::uuid,
  '00000000-0000-4000-8000-000000000103'::uuid,
  '00000000-0000-4000-8000-000000000104'::uuid,
  '00000000-0000-4000-8000-000000000105'::uuid,
  '00000000-0000-4000-8000-000000000106'::uuid
]) as contest_id;

insert into public.submissions (
  id, contest_id, contestant_id, content, file_urls, status
)
select
  ('10000000-0000-4000-8000-' || right(contest_id::text, 12))::uuid,
  contest_id,
  (select id from authorization_test_users where user_number = 2),
  'authorization test submission',
  '[]'::jsonb,
  case
    when contest_id = '00000000-0000-4000-8000-000000000105'::uuid
      then 'winner'
    when contest_id = '00000000-0000-4000-8000-000000000106'::uuid
      then 'not_selected'
    else 'submitted'
  end
from unnest(array[
  '00000000-0000-4000-8000-000000000103'::uuid,
  '00000000-0000-4000-8000-000000000104'::uuid,
  '00000000-0000-4000-8000-000000000105'::uuid,
  '00000000-0000-4000-8000-000000000106'::uuid
]) as contest_id;

insert into public.messages (
  conversation_id, sender_id, recipient_id, contest_id, content
)
select
  'authorization-' || contest_id::text,
  (select id from authorization_test_users where user_number = 2),
  (select id from authorization_test_users where user_number = 1),
  contest_id,
  'authorization test message'
from unnest(array[
  '00000000-0000-4000-8000-000000000102'::uuid,
  '00000000-0000-4000-8000-000000000103'::uuid,
  '00000000-0000-4000-8000-000000000104'::uuid
]) as contest_id;

insert into public.payout_requests (
  contest_id, winner_id, amount, contest_title, winner_name,
  winner_email, status
)
select
  '00000000-0000-4000-8000-000000000105'::uuid,
  id,
  50000,
  'Complete stage',
  coalesce(full_name, 'Test winner'),
  email,
  'awaiting_upi'
from public.profiles
where id = (
  select id from authorization_test_users where user_number = 2
);

-- Anonymous: public RPC only, no base-table or profile access.
set local role anon;
select pg_temp.assert_true(
  (select count(*) from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000102'
  )) = 1,
  'anonymous can read an entry-open public summary'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000102'
  )) is null,
  'anonymous cannot read the private brief'
);
select pg_temp.assert_true(
  (select count(*) from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000101'
  )) = 0,
  'anonymous cannot read a draft'
);
select pg_temp.assert_true(
  (select count(*) from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000103'
  )) = 1,
  'anonymous reads a submission-open public summary'
);
select pg_temp.assert_true(
  (select count(*) from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000104'
  )) = 1,
  'anonymous reads a judging public summary'
);
select pg_temp.assert_true(
  (select count(*) from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000105'
  )) = 1,
  'anonymous reads a completed public summary'
);
select pg_temp.assert_true(
  (select count(*) from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000106'
  )) = 1,
  'anonymous reads a cancelled public summary'
);
select pg_temp.assert_forbidden(
  'select * from public.profiles',
  'anonymous profile table read is blocked'
);
select pg_temp.assert_true(
  (select count(*) from public.get_public_profile(
    (select id from authorization_test_users where user_number = 1)
  )) = 1,
  'anonymous can read a specific safe public profile'
);
reset role;

-- Contest creator/reviewer.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from authorization_test_users where user_number = 1),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) from public.contests where id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 8,
  'creator reads own contests at every lifecycle stage'
);
select pg_temp.assert_true(
  (select count(*) from public.contest_entries where contest_id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 5,
  'creator reads entry records for own contests'
);
select pg_temp.assert_true(
  (select count(*) from public.submissions where contest_id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 4,
  'creator reads submissions for own contests'
);
select pg_temp.assert_true(
  (select count(*) from public.messages where contest_id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 3,
  'creator reads own contest conversations'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000102'
  )) is not null,
  'creator reads own private brief'
);
select pg_temp.assert_forbidden(
  $sql$update public.contests set status = 'completed'
    where id = '00000000-0000-4000-8000-000000000102'$sql$,
  'creator cannot mutate contest state directly'
);
select pg_temp.assert_forbidden(
  'select * from public.contest_materials',
  'creator materials use the authorized server path'
);
select pg_temp.assert_forbidden(
  'select * from public.payments',
  'creator cannot read raw payment identifiers'
);
reset role;

-- Entered contestant and administrator/unrelated behavior. The same identity
-- is temporarily marked admin; RLS must grant no extra private-data access.
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select id from authorization_test_users where user_number = 2),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select pg_temp.assert_true(
  (select count(*) from public.profiles) = 1,
  'authenticated users read only their own profile'
);
select pg_temp.assert_true(
  (select count(*) from public.get_public_profile(
    (select id from authorization_test_users where user_number = 1)
  )) = 1,
  'authenticated user can read another safe public profile'
);
select pg_temp.assert_true(
  (select count(*) from public.contests where id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 0,
  'entered/admin/unrelated user cannot read creator base contest rows'
);
select pg_temp.assert_true(
  (select count(*) from public.contest_entries where contest_id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 5,
  'entered contestant reads own entries'
);
select pg_temp.assert_true(
  (select count(*) from public.submissions where contest_id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 4,
  'entered contestant reads own submissions'
);
select pg_temp.assert_true(
  (select count(*) from public.messages where contest_id between
    '00000000-0000-4000-8000-000000000101'::uuid
    and '00000000-0000-4000-8000-000000000108'::uuid) = 3,
  'entered contestant reads only participating conversations'
);
select pg_temp.assert_true(
  (select count(*) from public.payout_requests where contest_id =
    '00000000-0000-4000-8000-000000000105'::uuid) = 1,
  'winner reads own payout status'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000102'
  )) is null,
  'entered contestant cannot read brief during entry-open stage'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000103'
  )) is not null,
  'entered contestant reads brief during submission-open stage'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000104'
  )) is not null,
  'entered contestant reads brief during judging stage'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000105'
  )) is not null,
  'entered contestant reads brief during completed stage'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000106'
  )) is not null,
  'previously revealed contestant brief remains visible after cancellation'
);
select pg_temp.assert_true(
  (select description from public.get_visible_contests(
    '00000000-0000-4000-8000-000000000108'
  )) is null,
  'unrelated administrator gets no private brief'
);
select pg_temp.assert_forbidden(
  $sql$update public.profiles set role = 'admin'
    where id = auth.uid()$sql$,
  'user cannot promote their own role'
);
select pg_temp.assert_forbidden(
  $sql$delete from public.contest_entries
    where contestant_id = auth.uid()$sql$,
  'contestant cannot bypass withdrawal route'
);
select pg_temp.assert_forbidden(
  $sql$insert into public.messages (
    conversation_id, sender_id, recipient_id, content
  ) values ('bypass', auth.uid(), auth.uid(), 'bypass')$sql$,
  'participant cannot bypass chat route'
);
select pg_temp.assert_forbidden(
  $sql$update public.payout_requests set amount = 1
    where winner_id = auth.uid()$sql$,
  'winner cannot mutate payout money fields'
);
select pg_temp.assert_forbidden(
  'select * from public.contest_materials',
  'private materials require the authorized server path'
);
select pg_temp.assert_forbidden(
  $sql$select public.enter_contest_authorized(
    '00000000-0000-4000-8000-000000000107',
    auth.uid()
  )$sql$,
  'authenticated clients cannot execute trusted entry function'
);
reset role;

-- Trusted server function grants and atomic happy paths.
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.enter_contest_authorized(uuid,uuid)',
    'execute'
  ),
  'trusted server can execute atomic entry'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.enter_contest_authorized(uuid,uuid)',
    'execute'
  ),
  'authenticated role cannot execute atomic entry'
);
select pg_temp.assert_true(
  has_function_privilege(
    'anon',
    'public.get_public_profile(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_public_profile(uuid)',
    'execute'
  ),
  'public roles can execute only the narrow profile projection'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.select_winner(uuid,uuid,uuid,text)',
    'execute'
  ),
  'legacy unvalidated winner function is not externally callable'
);

select pg_temp.assert_true(
  public.enter_contest_authorized(
    '00000000-0000-4000-8000-000000000107',
    (select id from authorization_test_users where user_number = 2)
  ) is not null,
  'trusted server enters an eligible contestant'
);

delete from public.submissions
where id = '10000000-0000-4000-8000-000000000103'::uuid;

select pg_temp.assert_true(
  public.create_submission_authorized(
    '00000000-0000-4000-8000-000000000103',
    (select id from authorization_test_users where user_number = 2),
    'atomic submission',
    '[]'::jsonb
  ) is not null,
  'trusted server creates an eligible submission atomically'
);

select public.select_contest_winner(
  '00000000-0000-4000-8000-000000000104',
  '10000000-0000-4000-8000-000000000104',
  (select id from authorization_test_users where user_number = 1),
  'authorization-test'
);

select pg_temp.assert_true(
  (select status from public.contests where id =
    '00000000-0000-4000-8000-000000000104') = 'completed',
  'creator-initiated trusted winner transition completes atomically'
);
