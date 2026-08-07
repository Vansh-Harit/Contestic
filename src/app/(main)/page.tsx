import BrowseClient from '@/components/browse-client'
import { getCachedVisibleContests } from '@/lib/public-contests'

export const revalidate = 60

export default async function BrowseContestsPage() {
  const contests = await getCachedVisibleContests()
  return <BrowseClient initialContests={contests} />
}
