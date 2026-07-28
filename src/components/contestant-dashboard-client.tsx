'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatINR } from '@/lib/utils'
import { Search, MessageCircle, Trophy, Clock, Settings, LayoutGrid, CheckCircle, Send, Award } from 'lucide-react'
import ChatPanel from '@/components/chat-panel'
import toast from 'react-hot-toast'

const SIDEBAR_TABS = [
  { key: 'all', label: 'All Submissions', icon: LayoutGrid },
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
  contestsWithStatus: any[]
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
  const [activeChat, setActiveChat] = useState<{ contestId: string; contestStatus: string; recipientId: string; recipientName: string } | null>(null)
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
    <div className="flex min-h-[calc(100vh-80px)] bg-white font-sans">
      {/* Left Sidebar */}
      <aside className="w-[220px] border-r border-gray-200 bg-white flex flex-col shrink-0">
        {/* Nav Tabs */}
        <nav className="flex-1 px-3 py-6 flex flex-col gap-1">
          {SIDEBAR_TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left w-full ${
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

          <div className="border-t border-gray-100 my-3" />

          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
        </nav>

        {/* Stats in sidebar */}
        {stats.totalEntered > 0 && (
          <div className="px-4 py-4 border-t border-gray-100 flex flex-col gap-2">
            <SidebarStat label="Entered" value={stats.totalEntered} />
            <SidebarStat label="Submitted" value={stats.totalSubmitted} />
            <SidebarStat label="Won" value={stats.totalWon} highlight />
            <SidebarStat label="Earned" value={formatINR(stats.totalEarned)} highlight={stats.totalEarned > 0} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top bar with search */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/20 transition-colors placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 px-8 py-6 overflow-y-auto">
          {/* UPI Banner for winners */}
          {contestsWithStatus.filter(item => item.payout?.status === 'awaiting_upi').length > 0 && (
            <div className="mb-6 flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
              <div>
                <p className="font-bold text-amber-800 text-sm">
                  🏆 You have {contestsWithStatus.filter(item => item.payout?.status === 'awaiting_upi').length} prize(s) waiting!
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  Add your UPI ID to receive your prize money
                </p>
              </div>
              <AddUpiButton />
            </div>
          )}

          {/* Page heading */}
          <h1 className="text-2xl font-bold text-gray-900 mb-6">My Submissions</h1>

          {/* Empty state */}
          {stats.totalEntered === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Award className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">
                No submissions yet
              </p>
              <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                You haven&apos;t participated in any contests yet. Browse open contests and enter one to get started!
              </p>
              <Link
                href="/"
                className="inline-block bg-[#6366F1] text-white font-bold text-sm px-6 py-3 rounded-lg hover:bg-[#4F46E5] transition-colors"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
function SidebarStat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-[#6366F1]' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}

/* ─── Submission Card ─── */
function SubmissionCard({
  item, onNavigate, onSubmit, onChat, unreadCount = 0
}: {
  item: any
  onNavigate: (id: string) => void
  onSubmit: (id: string) => void
  onChat?: (chatData: any) => void
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
    <div className={`bg-white border rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow ${
      submission?.status === 'winner' ? 'border-gray-400' : 'border-gray-200'
    }`}>
      {/* Top section */}
      <div>
        <h3
          className="text-[15px] font-bold text-gray-900 mb-1 cursor-pointer hover:text-[#6366F1] transition-colors leading-snug"
          onClick={() => onNavigate(contest.id)}
        >
          {contest.title}
        </h3>
        <p className="text-xs text-gray-400 mb-3">Contest</p>

        {/* Status */}
        <div className="mb-3">
          <span className="text-xs text-gray-500">Status: </span>
          <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
        </div>

        {/* Countdown Timer */}
        <CountdownTimer deadline={contest.deadline} />

        {/* Payout status for winners */}
        {payout && (
          <div className="mt-3 text-xs text-[#6366F1] font-medium bg-white border border-gray-300 rounded-md px-3 py-2">
            💸 {payout.status === 'awaiting_upi' && 'Add UPI to claim prize'}
            {payout.status === 'pending_transfer' && 'Prize transfer in progress (24-48 hrs)'}
            {payout.status === 'transferred' && 'Prize sent ✓'}
          </div>
        )}
      </div>

      {/* Bottom section — actions */}
      <div className="mt-4 flex flex-col gap-2">
        {/* Submit Work button if submission window open and not submitted */}
        {phase === 'submission_open' && !submission && (
          <button
            onClick={() => onSubmit(contest.id)}
            className="w-full bg-amber-400 text-gray-900 font-bold text-sm py-2.5 rounded-lg hover:bg-amber-500 transition-colors cursor-pointer"
          >
            Submit Work →
          </button>
        )}

        {/* Add UPI for winners */}
        {payout?.status === 'awaiting_upi' && (
          <AddUpiButton />
        )}

        {/* View Details — always shown */}
        <button
          onClick={() => onNavigate(contest.id)}
          className="w-full bg-[#6366F1] text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-[#4F46E5] transition-colors cursor-pointer"
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
              className="w-full flex items-center justify-center gap-2 border border-[#6366F1] text-[#6366F1] font-medium text-sm py-2 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
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
function CountdownTimer({ deadline }: { deadline: string | null }) {
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
        <p className="text-xs text-gray-900 font-mono font-semibold">00 days 00:00:00</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Timer</p>
      </div>
    )
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <p className="text-xs text-gray-900 font-mono font-semibold" suppressHydrationWarning>
        {pad(timeLeft.days)} days {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">Countdown Timer</p>
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
        className="bg-amber-400 text-gray-900 font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-amber-500 transition-colors cursor-pointer whitespace-nowrap"
      >
        Add UPI →
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999]">
          <div className="bg-white rounded-2xl p-7 w-[360px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/20 mb-4"
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
                className="flex-1 py-2.5 bg-[#6366F1] text-white rounded-lg text-sm font-bold hover:bg-[#4F46E5] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
