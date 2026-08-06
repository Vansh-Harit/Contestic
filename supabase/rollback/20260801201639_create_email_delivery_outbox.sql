revoke all on function public.claim_due_email_deliveries(integer)
  from public, anon, authenticated, service_role;
drop function if exists public.claim_due_email_deliveries(integer);

revoke all privileges on table public.email_deliveries
  from public, anon, authenticated, service_role;
drop table if exists public.email_deliveries;
