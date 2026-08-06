-- Contestic database baseline (historical migration version preserved).
--
-- Reconstructed read-only from the Contestic Supabase catalog on 2026-07-30.
-- Supabase-managed auth and storage tables are intentionally not recreated.
-- The complete pre-hardening structure is kept in this earliest recorded
-- migration so a blank project can be reconstructed. The following historical
-- marker migrations preserve the live project's recorded migration versions.
-- Later migrations apply the authorization hardening currently present live.

create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  upi_id text,
  is_admin boolean default false,
  role text default 'user'::text,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_role_check
    check (role = any (array['user'::text, 'admin'::text]))
);

comment on column public.profiles.upi_id is
  'UPI ID collected from contestant when they win a contest. Used by admin to manually transfer prize money.';
comment on column public.profiles.is_admin is
  'Flag for platform admin access. Only checked client-side for UI visibility; all actual admin gates remain server-side.';

create table public.contests (
  id uuid not null default gen_random_uuid(),
  lister_id uuid not null,
  title text not null,
  description text not null,
  category text not null,
  prize_amount integer not null,
  platform_fee integer not null,
  total_charged integer not null,
  max_entries integer not null default 50,
  deadline timestamptz not null,
  ai_policy text not null default 'partial'::text,
  status text not null default 'draft'::text,
  razorpay_order_id text,
  razorpay_payment_id text,
  winner_submission_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_deadline timestamptz,
  entry_limit integer,
  public_summary text,
  entry_window_hours integer default 24,
  constraint contests_pkey primary key (id),
  constraint contests_lister_id_fkey
    foreign key (lister_id) references public.profiles(id) on delete cascade,
  constraint contests_razorpay_order_id_key unique (razorpay_order_id),
  constraint contests_razorpay_payment_id_key unique (razorpay_payment_id),
  constraint contests_ai_policy_check
    check (ai_policy = any (array['none'::text, 'partial'::text, 'allowed'::text])),
  constraint contests_category_check
    check (category = any (array[
      'Naming'::text,
      'Content Writing'::text,
      'Design'::text,
      'Video Editing'::text,
      'Others'::text
    ])),
  constraint contests_description_check check (char_length(description) >= 50),
  constraint contests_entry_limit_check
    check (entry_limit >= 10 and entry_limit <= 100),
  constraint contests_entry_window_hours_check
    check (entry_window_hours = any (array[24, 48])),
  constraint contests_max_entries_check
    check (max_entries >= 10 and max_entries <= 100),
  constraint contests_prize_amount_check check (prize_amount >= 50000),
  constraint contests_status_check
    check (status = any (array[
      'draft'::text,
      'active'::text,
      'judging'::text,
      'completed'::text,
      'cancelled'::text
    ])),
  constraint contests_title_check
    check (char_length(title) >= 10 and char_length(title) <= 100),
  constraint entry_before_submission
    check (entry_deadline is null or entry_deadline < deadline)
);

comment on column public.contests.entry_deadline is
  'When the entry/registration period closes. Must be before submission deadline.';
comment on column public.contests.entry_limit is
  'Max number of participants who can register. Defaults to max_entries if null.';
comment on column public.contests.public_summary is
  'Short public teaser (max 200 chars) visible to everyone before entering. Full description only visible to entered participants after entry closes.';
comment on column public.contests.entry_window_hours is
  '24 or 48 hours. Entry deadline is auto-calculated as payment_captured_at + this value. Lister does not set entry_deadline manually.';

create table public.contest_entries (
  id uuid not null default gen_random_uuid(),
  contest_id uuid not null,
  contestant_id uuid not null,
  entered_at timestamptz not null default now(),
  constraint contest_entries_pkey primary key (id),
  constraint contest_entries_contest_id_contestant_id_key
    unique (contest_id, contestant_id),
  constraint contest_entries_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete cascade,
  constraint contest_entries_contestant_id_fkey
    foreign key (contestant_id) references public.profiles(id) on delete cascade
);

create table public.contest_materials (
  id uuid not null default gen_random_uuid(),
  contest_id uuid not null,
  type text not null,
  label text not null,
  content text not null,
  display_order integer default 0,
  created_at timestamptz not null default now(),
  constraint contest_materials_pkey primary key (id),
  constraint contest_materials_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete cascade,
  constraint contest_materials_type_check
    check (type = any (array['link'::text, 'text'::text]))
);

comment on column public.contest_materials.type is
  'link = external URL (Drive, Dropbox, WeTransfer), text = written instructions or additional context';
comment on column public.contest_materials.label is
  'Display name shown to participant. E.g. Raw Footage Scene 1, Brand Guidelines, Additional Instructions';

create table public.submissions (
  id uuid not null default gen_random_uuid(),
  contest_id uuid not null,
  contestant_id uuid not null,
  content text not null,
  file_url text,
  status text not null default 'submitted'::text,
  submitted_at timestamptz not null default now(),
  file_urls jsonb default '[]'::jsonb,
  constraint submissions_pkey primary key (id),
  constraint submissions_contest_id_contestant_id_key
    unique (contest_id, contestant_id),
  constraint submissions_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete cascade,
  constraint submissions_contestant_id_fkey
    foreign key (contestant_id) references public.profiles(id) on delete cascade,
  constraint submissions_status_check
    check (status = any (array[
      'submitted'::text,
      'winner'::text,
      'not_selected'::text
    ]))
);

comment on column public.submissions.file_urls is
  'Array of objects: [{type: "upload"|"drive_link", url: string, filename: string, size_bytes: number}]. Uploaded files use R2 URLs, drive_link type uses raw URL user pasted.';

create table public.messages (
  id uuid not null default gen_random_uuid(),
  conversation_id text not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  contest_id uuid,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_sender_id_fkey
    foreign key (sender_id) references public.profiles(id) on delete cascade,
  constraint messages_recipient_id_fkey
    foreign key (recipient_id) references public.profiles(id) on delete cascade,
  constraint messages_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete set null,
  constraint messages_content_check
    check (char_length(content) >= 1 and char_length(content) <= 1000)
);

create table public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  message text not null,
  contest_id uuid,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint notifications_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete set null
);

create table public.payments (
  id uuid not null default gen_random_uuid(),
  contest_id uuid not null,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  amount integer not null,
  platform_fee integer not null,
  prize_amount integer not null,
  payment_status text not null default 'pending'::text,
  payout_status text not null default 'pending'::text,
  payout_transfer_id text,
  created_at timestamptz not null default now(),
  constraint payments_pkey primary key (id),
  constraint payments_contest_id_key unique (contest_id),
  constraint payments_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete cascade,
  constraint payments_payment_status_check
    check (payment_status = any (array[
      'pending'::text,
      'captured'::text,
      'failed'::text,
      'refunded'::text
    ])),
  constraint payments_payout_status_check
    check (payout_status = any (array[
      'pending'::text,
      'processing'::text,
      'completed'::text,
      'failed'::text
    ]))
);

create table public.payout_requests (
  id uuid not null default gen_random_uuid(),
  contest_id uuid not null,
  winner_id uuid not null,
  amount integer not null,
  contest_title text not null,
  winner_name text not null,
  winner_email text not null,
  winner_upi text,
  status text not null default 'awaiting_upi'::text,
  admin_note text,
  created_at timestamptz not null default now(),
  transferred_at timestamptz,
  constraint payout_requests_pkey primary key (id),
  constraint payout_requests_contest_id_key unique (contest_id),
  constraint payout_requests_contest_id_fkey
    foreign key (contest_id) references public.contests(id) on delete cascade,
  constraint payout_requests_winner_id_fkey
    foreign key (winner_id) references public.profiles(id) on delete cascade,
  constraint payout_requests_status_check
    check (status = any (array[
      'awaiting_upi'::text,
      'pending_transfer'::text,
      'transferred'::text,
      'failed'::text
    ]))
);

comment on column public.payout_requests.winner_upi is
  'UPI ID provided by winner after being selected. Admin sends prize to this ID.';
comment on column public.payout_requests.admin_note is
  'Admin adds UTR number or transaction reference after sending payment.';
comment on column public.payout_requests.transferred_at is
  'Timestamp when admin confirmed the transfer was made.';

create index idx_contest_entries_contest
  on public.contest_entries using btree (contest_id);
create index idx_contest_entries_contestant
  on public.contest_entries using btree (contestant_id);
create index idx_contest_materials_contest
  on public.contest_materials using btree (contest_id, display_order);
create index idx_contests_category
  on public.contests using btree (category);
create index idx_contests_deadline
  on public.contests using btree (deadline);
create index idx_contests_lister
  on public.contests using btree (lister_id);
create index idx_contests_status
  on public.contests using btree (status);
create index idx_messages_contest
  on public.messages using btree (contest_id);
create index idx_messages_conversation
  on public.messages using btree (conversation_id);
create index idx_messages_recipient
  on public.messages using btree (recipient_id)
  where read_at is null;
create index idx_notifications_user_unread
  on public.notifications using btree (user_id)
  where read = false;
create index idx_payout_requests_status
  on public.payout_requests using btree (status);
create index idx_payout_requests_winner
  on public.payout_requests using btree (winner_id);
create index idx_submissions_contest
  on public.submissions using btree (contest_id);
create index idx_submissions_contestant
  on public.submissions using btree (contestant_id);

alter table public.profiles enable row level security;
alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
alter table public.contest_materials enable row level security;
alter table public.submissions enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.payout_requests enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.select_winner(
  p_contest_id uuid,
  p_submission_id uuid,
  p_contestant_id uuid,
  p_payout_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prize_amount integer;
  v_contest_title text;
  v_winner_name text;
  v_winner_email text;
  v_winner_upi text;
begin
  select prize_amount, title
    into v_prize_amount, v_contest_title
    from public.contests
    where id = p_contest_id;

  select full_name, email, upi_id
    into v_winner_name, v_winner_email, v_winner_upi
    from public.profiles
    where id = p_contestant_id;

  update public.contests
    set status = 'completed', winner_submission_id = p_submission_id
    where id = p_contest_id;

  update public.submissions
    set status = 'winner'
    where id = p_submission_id;

  update public.submissions
    set status = 'not_selected'
    where contest_id = p_contest_id
      and id != p_submission_id;

  update public.payments
    set payout_status = 'processing', payout_transfer_id = p_payout_id
    where contest_id = p_contest_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    contest_id
  )
  values (
    p_contestant_id,
    'winner',
    'You won!',
    'You won "' || v_contest_title || '". Our team will contact you within 24-48 working hours to arrange your prize transfer. Make sure to add your UPI ID to receive it faster.',
    p_contest_id
  );

  insert into public.payout_requests (
    contest_id,
    winner_id,
    amount,
    contest_title,
    winner_name,
    winner_email,
    winner_upi,
    status
  )
  values (
    p_contest_id,
    p_contestant_id,
    v_prize_amount,
    v_contest_title,
    coalesce(v_winner_name, 'Unknown'),
    v_winner_email,
    v_winner_upi,
    case
      when v_winner_upi is not null then 'pending_transfer'
      else 'awaiting_upi'
    end
  );
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger contests_updated_at
  before update on public.contests
  for each row execute function public.update_updated_at();

create view public.contests_with_counts as
select
  c.id,
  c.lister_id,
  c.title,
  c.public_summary,
  c.description,
  c.category,
  c.prize_amount,
  c.platform_fee,
  c.total_charged,
  c.max_entries,
  c.deadline,
  c.entry_deadline,
  c.entry_limit,
  c.entry_window_hours,
  c.ai_policy,
  c.status,
  c.razorpay_order_id,
  c.razorpay_payment_id,
  c.winner_submission_id,
  c.created_at,
  c.updated_at,
  count(distinct s.id) as submission_count,
  count(distinct e.id) as entry_count,
  p.full_name as lister_name,
  p.avatar_url as lister_avatar
from public.contests as c
left join public.submissions as s on s.contest_id = c.id
left join public.contest_entries as e on e.contest_id = c.id
left join public.profiles as p on p.id = c.lister_id
group by c.id, p.full_name, p.avatar_url;

-- Supabase creates broad Data API default grants for new public objects.
-- Establish explicit service access here; the later authorization migration
-- grants only the narrow authenticated reads required by the application.
revoke all privileges on all tables in schema public
  from public, anon, authenticated;
grant all privileges on table
  public.profiles,
  public.contests,
  public.contest_entries,
  public.contest_materials,
  public.submissions,
  public.messages,
  public.notifications,
  public.payments,
  public.payout_requests
to service_role;
grant select on table public.contests_with_counts to service_role;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.update_updated_at()
  from public, anon, authenticated;
revoke all on function public.select_winner(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.update_updated_at() to service_role;
grant execute on function public.select_winner(uuid, uuid, uuid, text)
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  307200,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
