-- Scope the participant check to the material's own contest. The previous
-- expression compared ce.contest_id to itself, allowing an entry in any
-- eligible contest to satisfy this policy.
drop policy if exists "Entered participants can read materials after entry closes"
  on public.contest_materials;

create policy "Entered participants can read materials after entry closes"
  on public.contest_materials
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.contest_entries as ce
      join public.contests as c on c.id = ce.contest_id
      where ce.contest_id = contest_materials.contest_id
        and ce.contestant_id = auth.uid()
        and (
          c.entry_deadline < now()
          or (
            select count(*)
            from public.contest_entries as all_entries
            where all_entries.contest_id = c.id
          ) >= coalesce(c.entry_limit, c.max_entries)
        )
    )
  );
