import { redirect } from 'next/navigation'
import NotificationsClient from '@/components/notifications-client'
import { createClient } from '@/lib/supabase/server'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) redirect('/login')

  return <NotificationsClient />
}
