-- Run after applying the optimized-dashboard migration and its rollback file
-- inside the same outer transaction.

do $$
begin
  if to_regprocedure('public.get_my_contests_dashboard()') is not null then
    raise exception 'rollback left get_my_contests_dashboard behind';
  end if;

  if to_regprocedure('public.get_hosted_contests_dashboard()') is not null then
    raise exception 'rollback left get_hosted_contests_dashboard behind';
  end if;
end;
$$;
