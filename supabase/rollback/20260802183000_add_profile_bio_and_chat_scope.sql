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

drop index if exists public.idx_messages_contest;

drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_profile_id uuid)
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

alter table public.profiles
  drop constraint if exists profiles_bio_length_check,
  drop column if exists bio;
