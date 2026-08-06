-- Run after applying the authorization migration and its rollback script in
-- the same outer transaction.

do $$
begin
  if to_regprocedure(
    'public.enter_contest_authorized(uuid,uuid)'
  ) is not null then
    raise exception 'rollback left enter_contest_authorized behind';
  end if;
  if to_regprocedure(
    'public.create_submission_authorized(uuid,uuid,text,jsonb)'
  ) is not null then
    raise exception 'rollback left create_submission_authorized behind';
  end if;
  if to_regprocedure(
    'public.select_contest_winner(uuid,uuid,uuid,text)'
  ) is not null then
    raise exception 'rollback left select_contest_winner behind';
  end if;
  if to_regprocedure(
    'public.get_public_profile(uuid)'
  ) is not null then
    raise exception 'rollback left get_public_profile behind';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.select_winner(uuid,uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'rollback did not restore select_winner service grant';
  end if;
  if not has_table_privilege(
    'authenticated',
    'public.profiles',
    'update'
  ) then
    raise exception 'rollback did not restore legacy profile update grant';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Public read'
  ) then
    raise exception 'rollback did not restore legacy profile policy';
  end if;
end;
$$;
