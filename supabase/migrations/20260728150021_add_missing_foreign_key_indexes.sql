-- Indexes identified by the Supabase performance advisor for foreign-key
-- lookups used by messaging and notification workflows.
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

create index if not exists notifications_contest_id_idx
  on public.notifications (contest_id);
