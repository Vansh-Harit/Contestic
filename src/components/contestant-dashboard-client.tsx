'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { formatINR } from '@/lib/utils'
import { Search, MessageCircle, Trophy, Clock, Settings, LayoutGrid, CheckCircle, Send, Award, WalletCards } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ContestPhase } from '@/lib/utils'
import type { ContestStatus } from '@/lib/types'

const ChatPanel = dynamic(() => import('@/components/chat-panel'), { ssr: false })

export interface DashboardContest {
  id: string
  lister_id: string
  title: string
  prize_amount: number
  status: ContestStatus
  deadline: string
  entry_deadline: string | null
  entry_limit: number | null
  max_entries: number
  entry_count?: number
  category?: string
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export interface DashboardSubmission {
  id: string
  contest_id: string
  status: string
}

interface DashboardPayout {
  status: string
}

interface ChatTarget {
  contestId: string
  contestStatus: string
  recipientId: string
  recipientName: string
}

export interface ContestantDashboardItem {
  entryId: string
  enteredAt?: string
  contest: DashboardContest
  phase: ContestPhase
  submission: DashboardSubmission | null
  payout: DashboardPayout | null
}

const SIDEBAR_TABS = [
  { key: 'all', label: 'All contests', icon: LayoutGrid },
  { key: 'active', label: 'Active', icon: Clock },
  { key: 'submitted', label: 'Submitted', icon: Send },
  { key: 'won', label: 'Won', icon: Trophy },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
]

export default function ContestantDashboardClient({ 
  contestsWithStatus, 
  stats,
  userId,
  initialUnreadCounts
}: {
  contestsWithStatus: ContestantDashboardItem[]
  stats: { 
    totalEntered: number
    totalSubmitted: number
    totalWon: number
    totalEarned: number 
  }
  userId: string
  initialUnreadCounts?: Record<string, number>
}) {
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeChat, setActiveChat] = useState<ChatTarget | null>(null)
  const [unreadCounts, setUnreadCounts] = useState(initialUnreadCounts || {})
  const router = useRouter()

  const filtered = useMemo(() => {
    let items = contestsWithStatus

    // Filter by tab
    if (activeTab === 'active') {
      items = items.filter(item => item.phase === 'entry_open' || item.phase === 'submission_open')
    } else if (activeTab === 'submitted') {
      items = items.filter(item => !!item.submission)
    } else if (activeTab === 'won') {
      items = items.filter(item => item.submission?.status === 'winner')
    } else if (activeTab === 'completed') {
      items = items.filter(item => item.phase === 'completed' || item.phase === 'cancelled')
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(item =>
        item.contest?.title?.toLowerCase().includes(q) ||
        item.contest?.category?.toLowerCase().includes(q)
      )
    }

    return items
  }, [contestsWithStatus, activeTab, searchQuery])

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-white font-sans md:flex-row">
      {/* Left Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-gray-50 md:w-[220px] md:border-b-0 md:border-r">
        <div className="px-4 pt-5 md:px-5 md:pt-8">
          <p className="font-heading text-xl font-bold text-on-surface">My contests</p>
        </div>
        {/* Nav Tabs */}
        <nav className="flex flex-1 gap-1 overflow-x-auto px-3 py-4 md:flex-col md:overflow-visible md:py-6">
          {SIDEBAR_TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors md:w-full ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#6366F1] font-semibold'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}

          <div className="my-3 hidden border-t border-gray-200 md:block" />

          <Link
            href="/settings"
            className="flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
        </nav>

      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top bar with search */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 md:px-8">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
          {/* UPI Banner for winners */}
          {contestsWithStatus.filter(item => item.payout?.status === 'awaiting_upi').length > 0 && (
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Payment details are needed for {contestsWithStatus.filter(item => item.payout?.status === 'awaiting_upi').length} prize payout(s).
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Add your UPI ID so the prize transfer can be prepared.
                  </p>
                </div>
              </div>
              <AddUpiButton />
            </div>
          )}

          {/* Page heading */}
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold text-gray-900">My contests</h1>
            <p className="mt-1 text-sm text-secondary">Track contests you entered and the next action for each one.</p>
          </div>

          {/* Empty state */}
          {stats.totalEntered === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Award className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                No contests yet
              </p>
              <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                You haven&apos;t entered a contest yet. Browse open contests to get started.
              </p>
              <Link
                href="/"
                className="inline-block rounded-lg bg-primary-container px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Browse Contests
              </Link>
            </div>
          )}

          {/* Cards grid */}
          {stats.totalEntered > 0 && (
            <>
              {filtered.length === 0 ? (
                <p className="text-gray-400 text-center py-16 text-sm">
                  No contests match this filter
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {filtered.map(item => (
                    <SubmissionCard
                      key={item.entryId}
                      item={item}
                      onNavigate={(id) => router.push(`/contest/${id}`)}
                      onSubmit={(id) => router.push(`/contest/${id}#submit`)}
                      onChat={(chatData) => {
                        setActiveChat(chatData)
                        setUnreadCounts(prev => ({ ...prev, [chatData.contestId]: 0 }))
                      }}
                      unreadCount={unreadCounts[item.contest.id] || 0}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Chat Panel */}
      {activeChat && (
        <ChatPanel
          contestId={activeChat.contestId}
          contestStatus={activeChat.contestStatus}
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          currentUserId={userId}
          currentUserName="You"
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  )
}

/* ─── Sidebar Stat ─── */
/* ─── Submission Card ─── */
function SubmissionCard({
  item, onNavigate, onSubmit, onChat, unreadCount = 0
}: {
  item: ContestantDashboardItem
  onNavigate: (id: string) => void
  onSubmit: (id: string) => void
  onChat?: (chatData: ChatTarget) => void
  unreadCount?: number
}) {
  const { contest, phase, submission, payout } = item

  const getStatus = () => {
    if (submission?.status === 'winner') return { label: 'Won', color: 'text-amber-600', bg: 'bg-amber-50' }
    if (submission?.status === 'not_selected') return { label: 'Not Selected', color: 'text-gray-500', bg: 'bg-gray-50' }
    if (submission) {
      if (phase === 'judging') return { label: 'Under Review', color: 'text-indigo-600', bg: 'bg-indigo-50' }
      return { label: 'Submitted', color: 'text-emerald-600', bg: 'bg-emerald-50' }
    }
    if (phase === 'submission_open') return { label: 'Not submitted yet', color: 'text-red-500', bg: 'bg-red-50' }
    if (phase === 'entry_open') return { label: 'Entry open', color: 'text-sky-600', bg: 'bg-sky-50' }
    return { label: '—', color: 'text-gray-400', bg: 'bg-gray-50' }
  }

  const status = getStatus()

  return (
    <div className="flex min-h-[340px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      {/* Top section */}
      <div>
        <h3
          className="cursor-pointer font-heading text-2xl font-bold leading-tight text-gray-900 transition-colors hover:text-primary"
          onClick={() => onNavigate(contest.id)}
        >
          {contest.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
          <span>{contest.category || 'Creative contest'}</span>
          {contest.profiles?.full_name && (
            <>
              <span aria-hidden="true">·</span>
              <span>Hosted by {contest.profiles.full_name}</span>
            </>
          )}
        </div>

        {/* Status */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.color} ${status.bg}`}>{status.label}</span>
          <span className="text-lg font-bold text-indigo-700">{formatINR(contest.prize_amount || 0)}</span>
        </div>

        <div className="mt-5 rounded-xl border border-outline-variant bg-gray-50 p-4">
          {phase === 'entry_open' ? (
            <CountdownTimer deadline={contest.entry_deadline} label="Entry closes in" />
          ) : phase === 'submission_open' ? (
            <CountdownTimer deadline={contest.deadline} label="Submission deadline" />
          ) : phase === 'judging' ? (
            <>
              <p className="text-sm font-semibold text-amber-800">Judging in progress</p>
              <p className="mt-1 text-xs text-secondary">The host is reviewing submitted work.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-on-surface">{phase === 'cancelled' ? 'Contest cancelled' : 'Contest completed'}</p>
              <p className="mt-1 text-xs text-secondary">This contest is no longer accepting submissions.</p>
            </>
          )}
        </div>

        {/* Payout status for winners */}
        {payout && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
            <WalletCards className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {payout.status === 'awaiting_upi' && 'Add UPI details to receive the prize.'}
            {payout.status === 'pending_transfer' && 'Prize transfer in progress (24-48 hrs)'}
            {payout.status === 'transferred' && 'Prize payment has been sent.'}
          </div>
        )}
      </div>

      {/* Bottom section — actions */}
      <div className="mt-4 flex flex-col gap-2">
        {/* Submit Work button if submission window open and not submitted */}
        {phase === 'submission_open' && !submission && (
          <button
            onClick={() => onSubmit(contest.id)}
            className="w-full rounded-lg bg-primary-container py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Submit work
          </button>
        )}

        {/* Add UPI for winners */}
        {payout?.status === 'awaiting_upi' && (
          <AddUpiButton />
        )}

        {/* View Details — always shown */}
        <button
          onClick={() => onNavigate(contest.id)}
          className="w-full rounded-lg bg-primary-container py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          View Details
        </button>

        {/* Chat button */}
        {onChat && (contest.status === 'active' || contest.status === 'judging') && (
          <div className="relative w-full">
            <button
              onClick={() => onChat({
                contestId: contest.id,
                contestStatus: contest.status,
                recipientId: contest.lister_id,
                recipientName: contest.profiles?.full_name ?? 'Lister'
              })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-300 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </button>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Countdown Timer ─── */
function CountdownTimer({ deadline, label }: { deadline: string | null; label: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)

  useEffect(() => {
    if (!deadline) return

    function calcTime() {
      const diff = new Date(deadline!).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      const seconds = Math.floor((diff / 1000) % 60)
      setTimeLeft({ days, hours, minutes, seconds })
    }

    calcTime()
    const interval = setInterval(calcTime, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  if (!deadline || !timeLeft) {
    return (
      <div>
        <p className="text-sm font-semibold text-gray-700">Calculating…</p>
        <p className="mt-1 text-xs text-secondary">{label}</p>
      </div>
    )
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <p className="font-mono text-base font-semibold text-gray-900" suppressHydrationWarning>
        {pad(timeLeft.days)} days {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </p>
      <p className="mt-1 text-xs text-secondary">{label}</p>
    </div>
  )
}

/* ─── Add UPI Button + Modal ─── */
function AddUpiButton() {
  const [open, setOpen] = useState(false)
  const [upi, setUpi] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!upi.includes('@') || upi.length < 5) {
      toast.error('Enter a valid UPI ID (e.g. name@upi)')
      return
    }
    setSaving(true)
    const res = await fetch('/api/profile/upi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upi_id: upi.trim() })
    })
    if (res.ok) {
      toast.success('UPI saved! Prize transfer will begin shortly.')
      setOpen(false)
      window.location.reload()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to save UPI')
    }
    setSaving(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        Add UPI
      </button>

      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[380px] rounded-2xl border border-outline-variant bg-white p-6 shadow-xl">
            <h3 className="mb-1 font-heading text-xl font-bold text-gray-900">
              Add your UPI ID
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              Your prize will be transferred to this UPI ID within 24-48 working hours.
            </p>
            <input
              type="text"
              value={upi}
              onChange={e => setUpi(e.target.value)}
              placeholder="yourname@upi"
              className="mb-4 min-h-11 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-primary-container py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                {saving ? 'Saving...' : 'Save UPI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
