'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import toast from 'react-hot-toast'

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
  userId: string
}

const SIDEBAR_TABS = [
  { key: 'active', label: 'Active Contests' },
  { key: 'past', label: 'Past Winners' },
  { key: 'drafts', label: 'Drafts' },
]

export default function ListerDashboardClient({ contests, userId }: ListerDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('active')
  const [draft, setDraft] = useState<any | null>(null)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('contestic_contest_draft')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Date.now() - parsed.timestamp < 172800000) {
          setDraft(parsed)
        } else {
          localStorage.removeItem('contestic_contest_draft')
        }
      } catch (e) {
        console.error(e)
      }
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
    <div className="flex min-h-[calc(100vh-80px)] bg-white font-sans">
      {/* Left Sidebar - Purple */}
      <aside className="w-[240px] bg-[#6366F1] flex flex-col shrink-0 text-white">
        {/* Nav Tabs */}
        <nav className="flex-1 px-4 py-8 flex flex-col gap-2">
          {SIDEBAR_TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center px-4 py-3 rounded-lg text-[15px] font-medium transition-all cursor-pointer text-left w-full ${
                  isActive
                    ? 'bg-white/20 border border-white/30 shadow-sm'
                    : 'hover:bg-white/10 text-white/90'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="px-10 py-10">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-[26px] font-bold text-gray-900">
              {activeTab === 'active' 
                ? 'Your Active Contests' 
                : activeTab === 'past' 
                  ? 'Past Winners' 
                  : 'Your Drafts'}
            </h1>
            <Link href="/post" onClick={() => localStorage.removeItem('contestic_contest_draft')}>
              <button className="bg-[#6366F1] text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-[#4F46E5] transition-colors flex items-center gap-2 cursor-pointer shadow-sm">
                <PlusCircle className="h-4 w-4" />
                <span>Host a Contest</span>
              </button>
            </Link>
          </div>

          {/* Table Container */}
          <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-[2fr_1fr_1fr_120px] gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">Contest Title</div>
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">
                {activeTab === 'drafts' ? 'Category' : 'Entries Received'}
              </div>
              <div className="font-bold text-[13px] text-gray-900 uppercase tracking-wide">Time Remaining</div>
              <div></div>
            </div>

            {/* List Rows */}
            {activeTab === 'drafts' ? (
              draft ? (
                <div className="flex flex-col">
                  <div className="grid grid-cols-[2fr_1fr_1fr_120px] gap-4 px-6 py-4 items-center">
                    <div className="text-[15px] text-gray-800 font-medium line-clamp-1 pr-4">
                      {draft.formData?.title || 'Untitled Contest'}
                    </div>
                    
                    <div className="text-[14px] text-gray-600">
                      {draft.formData?.category || 'N/A'}
                    </div>
                    
                    <div className="text-[14px] text-gray-600">
                      <DraftCountdownText timestamp={draft.timestamp} />
                    </div>
                    
                    <div className="flex justify-end">
                      <Link href="/post?load_draft=true">
                        <button className="bg-[#6366F1] text-white px-4 py-2 rounded-lg font-semibold text-[13px] hover:bg-[#4F46E5] transition-colors cursor-pointer w-full shadow-sm">
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
                    You don't have any drafts in progress.
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
                      className={`grid grid-cols-[2fr_1fr_1fr_120px] gap-4 px-6 py-4 items-center ${
                        isLast ? '' : 'border-b border-gray-100'
                      }`}
                    >
                      <div className="text-[15px] text-gray-800 font-medium line-clamp-1 pr-4">
                        {contest.title}
                      </div>
                      
                      <div className="text-[14px] text-gray-600">
                        {contest.entry_count ?? 0} entries
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
                          <button className="bg-[#6366F1] text-white px-4 py-2 rounded-lg font-semibold text-[13px] hover:bg-[#4F46E5] transition-colors cursor-pointer w-full shadow-sm">
                            View Details
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
                    <button className="bg-[#6366F1] text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-[#4F46E5] transition-colors shadow-sm">
                      Host your first contest
                    </button>
                  </Link>
                )}
              </div>
            )}
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
