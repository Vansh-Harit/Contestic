-- Security hardening for functions invoked by triggers or trusted server routes.
-- The application invokes select_winner through the Supabase service-role client;
-- anonymous and ordinary authenticated clients must not be able to call it via RPC.

alter function public.select_winner(uuid, uuid, uuid, text)
  set search_path = public, pg_temp;

revoke all on function public.select_winner(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.select_winner(uuid, uuid, uuid, text)
  to service_role;

alter function public.handle_new_user()
  set search_path = public, pg_temp;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

alter function public.update_updated_at()
  set search_path = public, pg_temp;

revoke all on function public.update_updated_at()
  from public, anon, authenticated;
