alter table public.profiles
  add column bio text;

alter table public.profiles
  add constraint profiles_bio_length_check
  check (bio is null or char_length(bio) <= 200);

create index if not exists idx_messages_contest
  on public.messages (contest_id);

-- The public projection remains deliberately narrow. Email, role, UPI and
-- payment data stay available only through existing private/server paths.
drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.id, p.full_name, p.avatar_url, p.bio
  from public.profiles as p
  where p.id = p_profile_id;
$$;

revoke all on function public.get_public_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_profile(uuid)
  to anon, authenticated, service_role;

-- A contest conversation must contain exactly the creator and one entrant.
-- Completed/cancelled chat remains hidden during the approved retention period.
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
        and (
          (
            messages.sender_id = c.lister_id
            and exists (
              select 1
              from public.contest_entries as ce
              where ce.contest_id = c.id
                and ce.contestant_id = messages.recipient_id
            )
          )
          or
          (
            messages.recipient_id = c.lister_id
            and exists (
              select 1
              from public.contest_entries as ce
              where ce.contest_id = c.id
                and ce.contestant_id = messages.sender_id
            )
          )
        )
    )
  );
