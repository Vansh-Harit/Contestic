import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { PLATFORM_FEE_PERCENT } from './constants'
import { Contest } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(paise / 100)

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100)

export const paiseToRupees = (paise: number) => paise / 100

export const calcPlatformFee = (prizePaise: number) =>
  Math.round((prizePaise * PLATFORM_FEE_PERCENT) / 100)

export const calcTotal = (prizePaise: number) =>
  prizePaise + calcPlatformFee(prizePaise)

export const truncate = (str: string, n: number) =>
  str.length > n ? str.slice(0, n) + '...' : str

export const daysUntil = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export type ContestPhase = 'entry_open' | 'entry_closed' | 'submission_open' | 'judging' | 'completed' | 'cancelled'

export function getContestPhase(
  contest: Contest
): ContestPhase {
  if (contest.status === 'completed') return 'completed'
  if (contest.status === 'cancelled') return 'cancelled'
  if (contest.status === 'judging') return 'judging'
  if (contest.status !== 'active') return 'entry_open'

  const now = new Date()
  const entryDeadline = contest.entry_deadline
    ? new Date(contest.entry_deadline)
    : null
  const effectiveLimit = contest.entry_limit ?? contest.max_entries
  const entryCount = contest.entry_count ?? 0
  const entryFull = entryCount >= effectiveLimit
  const entryExpired = entryDeadline ? now > entryDeadline : false

  if (!entryExpired && !entryFull) return 'entry_open'

  const submissionDeadline = new Date(contest.deadline)
  if (now < submissionDeadline) return 'submission_open'
  return 'judging'
}

export function getChatChannelName(contestId: string, userId1: string, userId2: string): string {
  const [a, b] = [userId1, userId2].sort()
  return `contest-${contestId}-${a}-${b}`
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}
