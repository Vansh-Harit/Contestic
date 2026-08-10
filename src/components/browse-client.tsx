'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Clock, Users, ChevronDown, Video } from 'lucide-react'
import { formatINR, daysUntil, getContestPhase, cn } from '@/lib/utils'
import AuthModal from '@/components/auth-modal'
import { InteractiveHoverButton } from '@/components/magicui/interactive-hover-button'
import { ContestStatusBadge } from '@/components/contest-lifecycle'
import type { VisibleContest } from '@/lib/types'
import { useAuth } from '@/components/auth-provider'

type SortOption = 'newest' | 'prize_high' | 'prize_low' | 'ending_soon'

export default function BrowseClient({ initialContests }: { initialContests: VisibleContest[] }) {
  const router = useRouter()
  const { user } = useAuth()
  const [activeCategory, setActiveCategory] = useState('All Categories')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [sortOpen, setSortOpen] = useState(false)
  const prefetchedContests = useRef(new Set<string>())

  const prefetchContest = (contestId: string) => {
    if (prefetchedContests.current.has(contestId)) return
    prefetchedContests.current.add(contestId)
    router.prefetch(`/contest/${contestId}`)
  }

  const categories = ['All Categories', 'Naming', 'Content Writing', 'Design', 'Video Editing', 'Others']

  const categoryMap: Record<string, string> = {
    'All Categories': 'All',
    'Naming': 'Naming',
    'Content Writing': 'Content Writing',
    'Design': 'Design',
    'Video Editing': 'Video Editing',
    'Others': 'Others'
  }

  const hasAnyContests = initialContests.length > 0

  const filteredContests = initialContests
    .filter((c) => {
      const mapped = categoryMap[activeCategory]
      return mapped === 'All' || c.category === mapped
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'prize_high': return b.prize_amount - a.prize_amount
        case 'prize_low': return a.prize_amount - b.prize_amount
        case 'ending_soon': return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest',
    prize_high: 'Prize: High → Low',
    prize_low: 'Prize: Low → High',
    ending_soon: 'Ending Soon'
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Naming': return { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' }
      case 'Content Writing': return { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' }
      case 'Design': return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }
      case 'Video Editing': return { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' }
      case 'Others': return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
      default: return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
    }
  }

  const getCategoryImage = (category: string) => {
    switch (category) {
      case 'Video Editing': return '/category-video-editing.png'
      case 'Content Writing': return '/category-content-writing.png'
      case 'Naming': return '/category-naming.png'
      case 'Design': return '/category-design.png'
      default: return '/category-others.png'
    }
  }

  return (
    <main className="flex-1 flex flex-col font-sans bg-white">
      <div className="w-full px-container-padding-mobile md:px-container-padding-desktop py-8 md:py-10 flex justify-center md:justify-start">
        
        {/* Left-dominant container, matching the Stitch reference width layout */}
        <div className="w-full max-w-[1050px] mx-auto md:ml-[5%] lg:ml-[10%]">

          {/* Hero Banner (contained, rounded, light background) */}
          <section
            style={{
              background: 'linear-gradient(90deg, #F9F8FD 0%, #F4F3FB 100%)',
            }}
            className="relative rounded-2xl overflow-hidden mb-8"
          >
            <div className="flex flex-col md:flex-row items-center justify-between p-8 md:p-12 gap-8">
              {/* Left content */}
              <div className="flex-1 max-w-md z-10">
                <h1 className="text-3xl md:text-[40px] font-heading font-bold text-[#111827] mb-3 leading-[1.15]">
                  Post a creative contest.<br />
                  <span className="text-[#6366F1]">Get the best. Pay for one.</span>
                </h1>
                <p className="text-gray-600 text-body-md mb-8 max-w-sm">
                  Get dozens of unique ideas from talented creators.<br/>
                  Choose the one you love.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => {
                      if (user) {
                        router.push('/post')
                      } else {
                        router.push('/login?next=/post')
                      }
                    }}
                    className="px-6 py-3 bg-[#6366F1] text-white rounded-lg font-bold text-body-sm hover:bg-[#4F46E5] transition-colors cursor-pointer shadow-sm"
                  >
                    Host a Contest Now
                  </button>
                </div>
              </div>

              {/* Right illustration */}
              <div className="hidden md:block absolute right-8 top-1/2 -translate-y-1/2">
                <img
                  src="/hero-trophy.png"
                  alt="Trophy"
                  className="w-[420px] object-contain drop-shadow-sm pointer-events-none"
                />
              </div>
            </div>
          </section>

          {/* Category Filter Bar */}
          <section className="mb-6 flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-1 items-center">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-semibold transition-all border cursor-pointer",
                    activeCategory === cat
                      ? "bg-[#F3F2F8] border-[#6366F1] text-[#6366F1]"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  {cat === 'All Categories' ? (
                    <span className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                      {cat}
                    </span>
                  ) : cat === 'Naming' ? (
                    <span className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                      Brand {cat}
                    </span>
                  ) : cat === 'Content Writing' ? (
                    <span className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      {cat}
                    </span>
                  ) : cat === 'Design' ? (
                    <span className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>
                      {cat}
                    </span>
                  ) : cat === 'Video Editing' ? (
                    <span className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 mb-[1px]" />
                      {cat}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {cat}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-md bg-white hover:border-gray-300 transition-colors cursor-pointer"
              >
                Sort by: <span className="font-semibold text-gray-900">{sortLabels[sortBy]}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", sortOpen && "rotate-180")} />
              </button>

              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSortBy(key)
                        setSortOpen(false)
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer",
                        sortBy === key
                          ? "bg-[#F3F2F8] text-[#6366F1] font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      {sortLabels[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Contest Listings */}
          <section className="flex flex-col gap-4">
            {filteredContests.length > 0 ? (
              filteredContests.map((contest) => {
                const endsIn = daysUntil(contest.deadline)
                const phase = getContestPhase(contest)
                const catColor = getCategoryColor(contest.category)

                return (
                  <div
                    key={contest.id}
                    onClick={() => router.push(`/contest/${contest.id}`)}
                    onMouseEnter={() => prefetchContest(contest.id)}
                    onFocusCapture={() => prefetchContest(contest.id)}
                    onTouchStart={() => prefetchContest(contest.id)}
                    className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl flex flex-col md:flex-row items-stretch overflow-hidden transition-all duration-200 hover:shadow-sm cursor-pointer group"
                  >
                    {/* Category Image */}
                    <div 
                      className="relative flex h-40 w-full shrink-0 items-center justify-center overflow-hidden bg-gray-50 md:h-auto md:w-[200px]"
                      style={{ background: catColor.bg }}
                    >
                      <img 
                        src={getCategoryImage(contest.category)} 
                        alt={contest.category}
                        className="absolute inset-0 h-full w-full object-contain p-3 md:object-cover md:p-0"
                        onError={(e) => {
                          // Fallback if image not provided yet
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>

                    {/* Content Wrapper */}
                    <div className="flex-1 flex flex-col md:flex-row items-start md:items-center p-5 md:p-6 gap-5 md:gap-6 min-w-0">
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          style={{ background: catColor.bg, color: catColor.text }}
                          className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        >
                          {contest.category === 'Naming' ? 'Brand Naming' : contest.category}
                        </span>
                        <ContestStatusBadge phase={phase} className="px-2 py-0.5 text-[10px]" />
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-[#111827] mb-1 group-hover:text-[#6366F1] transition-colors whitespace-normal break-words md:truncate">
                        {contest.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-gray-500 mb-3 line-clamp-none md:line-clamp-1 break-words">
                        {contest.public_summary ?? 
                          (contest.description && contest.description.length > 120 
                            ? contest.description.slice(0, 120) + '...' 
                            : contest.description)}
                      </p>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
                        {phase === 'entry_open' && (
                          <>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {endsIn > 0 ? `${endsIn} day${endsIn !== 1 ? 's' : ''} left` : 'Closing soon'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              {contest.entry_count || 0} entries
                            </span>
                          </>
                        )}

                        {phase === 'submission_open' && (
                          <>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {endsIn > 0 ? `${endsIn} day${endsIn !== 1 ? 's' : ''} left` : 'Closing soon'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              {contest.submission_count || 0} submitted
                            </span>
                          </>
                        )}

                        {phase === 'judging' && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Under review
                          </span>
                        )}

                        <span className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-[#F3F4F6] text-[#374151] rounded text-[10px] font-medium tracking-wide">
                            AI: {contest.ai_policy === 'none' ? 'None' : contest.ai_policy === 'partial' ? 'Partial OK' : 'Allowed'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Right side: Lister + Prize + CTA */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 md:gap-3 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 min-w-[140px]">
                      
                      {/* Lister Profile */}
                      <div className="flex items-center gap-2 md:mb-auto">
                        <span className="text-xs text-gray-500 font-medium truncate max-w-[100px] hidden md:block">
                          {contest.profiles?.full_name || contest.lister_name || 'Anonymous'}
                        </span>
                        {contest.profiles?.avatar_url || contest.lister_avatar ? (
                          <img 
                            src={contest.profiles?.avatar_url ?? contest.lister_avatar ?? undefined}
                            alt={contest.profiles?.full_name || contest.lister_name || 'User'} 
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0 border border-indigo-100">
                            {(contest.profiles?.full_name || contest.lister_name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center md:items-end">
                        <span className="text-xl font-bold text-[#3730A3]">
                          {formatINR(contest.prize_amount)}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                          Prize Amount
                        </span>
                      </div>

                      <InteractiveHoverButton
                        text="View Details"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/contest/${contest.id}`)
                        }}
                      />
                    </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-16 text-center bg-white min-h-[400px]">
                <AlertCircle className="h-10 w-10 text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">
                  {hasAnyContests ? 'No contests found' : 'No contests at the moment'}
                </h3>
                <p className={cn('text-body-sm text-gray-400', hasAnyContests && 'mb-6')}>
                  {hasAnyContests
                    ? 'There are no contests matching your current filters.'
                    : 'New contests will appear here when they go live.'}
                </p>
                {hasAnyContests && (
                  <button
                    onClick={() => setActiveCategory('All Categories')}
                    className="text-[#6366F1] font-bold text-sm underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </main>
  )
}
