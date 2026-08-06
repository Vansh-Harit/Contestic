-- Exact rollback for 20260729151427_authorization_reset.sql.
-- Apply only as a coordinated rollback before reverting application routes.

drop function if exists public.select_contest_winner(
  uuid, uuid, uuid, text
);
drop function if exists public.create_submission_authorized(
  uuid, uuid, text, jsonb
);
drop function if exists public.enter_contest_authorized(uuid, uuid);
drop function if exists public.get_public_profile(uuid);

grant execute on function public.select_winner(uuid, uuid, uuid, text)
  to service_role;

revoke all privileges on table public.contests_with_counts
  from public, anon, authenticated, service_role;
grant all privileges on table public.contests_with_counts to service_role;

grant all privileges on table public.profiles
  to anon, authenticated;
grant all privileges on table public.contest_entries
  to anon, authenticated;
grant all privileges on table public.contest_materials
  to anon, authenticated;
grant all privileges on table public.submissions
  to anon, authenticated;
grant all privileges on table public.messages
  to anon, authenticated;
grant all privileges on table public.notifications
  to anon, authenticated;
grant all privileges on table public.payments
  to anon, authenticated;
grant all privileges on table public.payout_requests
  to anon, authenticated;

revoke all privileges on table public.contests
  from public, anon, authenticated;
grant select, insert, update on table public.contests
  to authenticated;

drop policy if exists "Own profile read" on public.profiles;
create policy "Public read"
  on public.profiles for select
  using (true);
create policy "Own update"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Lister read own" on public.contests;
create policy "Lister read own"
  on public.contests for select to authenticated
  using ((select auth.uid()) = lister_id);
create policy "Lister insert"
  on public.contests for insert to authenticated
  with check ((select auth.uid()) = lister_id);
create policy "Lister update own"
  on public.contests for update to authenticated
  using ((select auth.uid()) = lister_id)
  with check ((select auth.uid()) = lister_id);

drop policy if exists "Contestants can view own entries"
  on public.contest_entries;
drop policy if exists "Listers can view entries for own contests"
  on public.contest_entries;
create policy "Authenticated users can enter active contests"
  on public.contest_entries for insert
  with check (
    auth.uid() = contestant_id
    and auth.uid() <> (
      select lister_id from public.contests
      where id = contest_entries.contest_id
    )
    and exists (
      select 1 from public.contests
      where id = contest_entries.contest_id
        and status = 'active'
        and (
          entry_deadline is null
          or entry_deadline > now()
        )
    )
  );
create policy "Contestants can view own entries"
  on public.contest_entries for select
  using (auth.uid() = contestant_id);
create policy "Contestants can withdraw during entry phase"
  on public.contest_entries for delete
  using (auth.uid() = contestant_id);
create policy "Listers can view entries for own contests"
  on public.contest_entries for select
  using (
    exists (
      select 1 from public.contests
      where id = contest_entries.contest_id
        and lister_id = auth.uid()
    )
  );

create policy "Listers can manage own contest materials"
  on public.contest_materials for all
  using (
    exists (
      select 1 from public.contests
      where id = contest_materials.contest_id
        and lister_id = auth.uid()
    )
  );
create policy "Entered participants can read materials after entry closes"
  on public.contest_materials for select to authenticated
  using (
    exists (
      select 1
      from public.contest_entries ce
      join public.contests c on c.id = ce.contest_id
      where ce.contest_id = contest_materials.contest_id
        and ce.contestant_id = auth.uid()
        and (
          c.entry_deadline < now()
          or (
            select count(*)
            from public.contest_entries all_entries
            where all_entries.contest_id = c.id
          ) >= coalesce(c.entry_limit, c.max_entries)
        )
    )
  );

drop policy if exists "Own read" on public.submissions;
drop policy if exists "Lister read contest submissions"
  on public.submissions;
create policy "Authenticated submit"
  on public.submissions for insert
  with check (
    auth.uid() = contestant_id
    and auth.uid() <> (
      select lister_id from public.contests
      where id = submissions.contest_id
    )
    and exists (
      select 1 from public.contests
      where id = submissions.contest_id
        and status = 'active'
        and deadline > now()
    )
  );
create policy "Lister read contest submissions"
  on public.submissions for select
  using (
    exists (
      select 1 from public.contests
      where id = submissions.contest_id
        and lister_id = auth.uid()
    )
  );
create policy "Own read"
  on public.submissions for select
  using (auth.uid() = contestant_id);

drop policy if exists "Participants read" on public.messages;
create policy "Authenticated send"
  on public.messages for insert
  with check (auth.uid() = sender_id);
create policy "Participants read"
  on public.messages for select
  using (
    auth.uid() = sender_id
    or auth.uid() = recipient_id
  );
create policy "Recipient mark read"
  on public.messages for update
  using (auth.uid() = recipient_id);

drop policy if exists "Own read" on public.notifications;
create policy "Own read"
  on public.notifications for select
  using (auth.uid() = user_id);
create policy "Own update"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Lister read own payments"
  on public.payments for select
  using (
    exists (
      select 1 from public.contests
      where id = payments.contest_id
        and lister_id = auth.uid()
    )
  );

drop policy if exists "Winners can view own payout request"
  on public.payout_requests;
create policy "Winners can add their UPI"
  on public.payout_requests for update
  using (auth.uid() = winner_id)
  with check (auth.uid() = winner_id);
create policy "Winners can view own payout request"
  on public.payout_requests for select
  using (auth.uid() = winner_id);
