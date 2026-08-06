'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ContestFormData } from '@/lib/types'
import { formatINR } from '@/lib/utils'
import { ContestStatusBadge } from '@/components/contest-lifecycle'

interface Contest {
  id: string
  title: string
  status: string
  prize_amount: number | null
  entry_count: number | null
  submission_count: number | null
  deadline: string | null
  created_at: string
}

interface ListerDashboardClientProps {
  contests: Contest[]
}

const SIDEBAR_TABS = [
  { key: 'active', label: 'Active and judging' },
  { key: 'past', label: 'Completed' },
  { key: 'drafts', label: 'Drafts' },
]

export default function ListerDashboardClient({ contests }: ListerDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('active')
  const [draft, setDraft] = useState<{
    timestamp: number
    formData?: Partial<ContestFormData>
  } | null>(null)
  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      const saved = localStorage.getItem('contestic_contest_draft')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Date.now() - parsed.timestamp < 172800000) {
            setDraft(parsed)
          } else {
            localStorage.removeItem('contestic_contest_draft')
          }
        } catch (error) {
          console.error(error)
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredContests = useMemo(() => {
    if (activeTab === 'active') {
      return contests.filter(c => c.status === 'active' || c.status === 'judging')
    }
    if (activeTab === 'past') {
      return contests.filter(c => c.status === 'completed')
    }
    return []
  }, [contests, activeTab])

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-white font-sans md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-outline-variant bg-gray-50 md:w-[220px] md:border-b-0 md:border-r">
        {/* Nav Tabs */}
        <div className="px-4 pt-5 md:px-5 md:pt-8">
          <p className="font-heading text-xl font-bold text-on-surface">Hosted contests</p>
        </div>
        <nav className="flex flex-1 gap-2 overflow-x-auto px-4 py-4 md:flex-col md:overflow-visible md:px-3 md:py-6">
          {SIDEBAR_TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex min-h-10 shrink-0 items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors md:w-full ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="px-4 py-8 md:px-8 lg:px-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-sm text-secondary">Manage the contests you have created.</p>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
              {activeTab === 'active' 
                ? 'Active and judging'
                : activeTab === 'past' 
                  ? 'Completed contests'
                  : 'Draft contests'}
              </h1>
            </div>
            <Link href="/post" onClick={() => localStorage.removeItem('contestic_contest_draft')}>
              <button className="flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                <PlusCircle className="h-4 w-4" />
                <span>Host a Contest</span>
              </button>
            </Link>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="min-w-[820px]">
            {/* Header Row */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 border-b border-gray-200 bg-gray-50 px-6 py-3">
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">Contest Title</div>
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">
                {activeTab === 'drafts' ? 'Category' : 'Entries Received'}
              </div>
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">Prize</div>
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">Time Remaining</div>
              <div></div>
            </div>

            {/* List Rows */}
            {activeTab === 'drafts' ? (
              draft ? (
                <div className="flex flex-col">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] items-center gap-4 px-6 py-4">
                    <div className="text-[15px] text-gray-800 font-medium line-clamp-1 pr-4">
                      {draft.formData?.title || 'Untitled Contest'}
                    </div>
                    
                    <div className="text-[14px] text-gray-600">
                      {draft.formData?.category || 'N/A'}
                    </div>
                    <div className="text-[14px] font-medium text-gray-700">
                      {draft.formData?.prize_amount_inr ? `₹${draft.formData.prize_amount_inr.toLocaleString('en-IN')}` : 'Not set'}
                    </div>
                    
                    <div className="text-[14px] text-gray-600">
                      <DraftCountdownText timestamp={draft.timestamp} />
                    </div>
                    
                    <div className="flex justify-end">
                      <Link href="/post?load_draft=true">
                        <button className="w-full rounded-lg bg-primary-container px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                          Continue
                        </button>
                      </Link>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-secondary font-medium">
                    <span>This will be saved as a draft for 2 days.</span>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('contestic_contest_draft')
                        setDraft(null)
                        toast.success('Draft discarded.')
                      }}
                      className="text-red-500 hover:text-red-700 cursor-pointer font-bold"
                    >
                      Discard Draft
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                  <p className="text-gray-500 font-medium mb-4">
                    You don&apos;t have any drafts in progress.
                  </p>
                </div>
              )
            ) : filteredContests.length > 0 ? (
              <div className="flex flex-col">
                {filteredContests.map((contest, i) => {
                  const isLast = i === filteredContests.length - 1
                  return (
                    <div 
                      key={contest.id} 
                      className={`grid grid-cols-[2fr_1fr_1fr_1fr_120px] items-center gap-4 px-6 py-4 ${
                        isLast ? '' : 'border-b border-gray-100'
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <div className="line-clamp-1 text-[15px] font-medium text-gray-800">{contest.title}</div>
                        <ContestStatusBadge
                          phase={contest.status === 'judging' ? 'judging' : contest.status === 'completed' ? 'completed' : 'active'}
                          className="mt-1.5 px-2 py-0.5 text-[10px]"
                        />
                      </div>
                      
                      <div className="text-[14px] text-gray-600">
                        {contest.entry_count ?? 0} entries
                      </div>
                      <div className="text-[14px] font-semibold text-indigo-700">
                        {contest.prize_amount == null ? 'Not set' : formatINR(contest.prize_amount)}
                      </div>
                      
                      <div className="text-[14px] text-gray-600">
                        {contest.status === 'completed' ? (
                          'Completed'
                        ) : (
                          <CountdownText deadline={contest.deadline} />
                        )}
                      </div>
                      
                      <div className="flex justify-end">
                        <Link href={`/dashboard/lister/contest/${contest.id}`}>
                          <button className="w-full rounded-lg bg-primary-container px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                            {contest.status === 'judging' ? 'Review' : 'View'}
                          </button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                <p className="text-gray-500 font-medium mb-4">
                  {activeTab === 'active' 
                    ? "You don't have any active contests right now." 
                    : "You haven't completed any contests yet."}
                </p>
                {activeTab === 'active' && (
                  <Link href="/post" onClick={() => localStorage.removeItem('contestic_contest_draft')}>
                    <button className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                      Host your first contest
                    </button>
                  </Link>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/* ─── Simple Text Countdown ─── */
function CountdownText({ deadline }: { deadline: string | null }) {
  const [text, setText] = useState(!deadline ? 'No deadline' : 'Loading...')

  useEffect(() => {
    if (!deadline) return

    function calcTime() {
      const diff = new Date(deadline!).getTime() - Date.now()
      if (diff <= 0) {
        setText('Ended')
        return
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((diff / (1000 * 60)) % 60)
      
      if (days > 0) {
        setText(`${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`)
      } else if (hours > 0) {
        setText(`${hours} hour${hours > 1 ? 's' : ''}, ${minutes} min${minutes > 1 ? 's' : ''}`)
      } else {
        setText(`${minutes} minute${minutes > 1 ? 's' : ''}`)
      }
    }

    calcTime()
    const interval = setInterval(calcTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [deadline])

  return <span suppressHydrationWarning>{text}</span>
}

function DraftCountdownText({ timestamp }: { timestamp: number }) {
  const [text, setText] = useState('Calculating...')

  useEffect(() => {
    function calcTime() {
      const elapsed = Date.now() - timestamp
      const remainingMs = 172800000 - elapsed // 2 days in ms
      if (remainingMs <= 0) {
        setText('Expired')
        return
      }

      const hours = Math.floor(remainingMs / (1000 * 60 * 60))
      const minutes = Math.floor((remainingMs / (1000 * 60)) % 60)

      if (hours >= 24) {
        const days = Math.floor(hours / 24)
        const remHours = hours % 24
        setText(`${days}d ${remHours}h left`)
      } else if (hours > 0) {
        setText(`${hours}h ${minutes}m left`)
      } else {
        setText(`${minutes}m left`)
      }
    }

    calcTime()
    const interval = setInterval(calcTime, 60000)
    return () => clearInterval(interval)
  }, [timestamp])

  return <span suppressHydrationWarning>{text}</span>
}
