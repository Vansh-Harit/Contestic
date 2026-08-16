'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { formatINR } from '@/lib/utils'
import type { ContestPhase } from '@/lib/utils'
import { CountdownTimer } from '@/components/countdown-timer'
import { ContestLifecycle, ContestStatusBadge } from '@/components/contest-lifecycle'
import { AlertCircle, Lock, ExternalLink, MessageCircle, Clock, Trophy, Share2, Users } from 'lucide-react'
import AuthModal from '@/components/auth-modal'
import toast from 'react-hot-toast'
import type { VisibleContest } from '@/lib/types'
import { captureAnalyticsEvent } from '@/lib/analytics'

const SubmitDialog = dynamic(
  () => import('@/components/submit-dialog').then((module) => module.SubmitDialog),
  { ssr: false }
)
const ChatPanel = dynamic(() => import('@/components/chat-panel'), { ssr: false })

export interface ContestMaterial {
  id?: string
  type: 'link' | 'text'
  label: string
  content: string
}

type ContestDetail = VisibleContest & {
  submissions?: Array<{ count: number }>
}

interface ContestDetailClientProps {
  contest: ContestDetail
  user: { id: string } | null
  hasSubmitted: boolean
  hasEntered: boolean
  phase: ContestPhase
  canSeeMaterials: boolean
  materials: ContestMaterial[]
  initialUnreadCount?: number
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

export default function ContestDetailClient({
  contest,
  user,
  hasSubmitted: initialHasSubmitted,
  hasEntered: initialHasEntered,
  phase: initialPhase,
  canSeeMaterials,
  materials,
  initialUnreadCount = 0,
}: ContestDetailClientProps) {
  const router = useRouter()
  const [hasSubmitted, setHasSubmitted] = useState(initialHasSubmitted)
  const [hasEntered, setHasEntered] = useState(initialHasEntered)
  const [phase] = useState(initialPhase)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [enterLoading, setEnterLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  const isLister = user?.id === contest.lister_id
  const entryLimit = contest.entry_limit ?? contest.max_entries
  const entryCount = contest.entry_count ?? 0
  const availableSlots = Math.max(0, entryLimit - entryCount)
  const submissionCount = contest.submission_count ?? contest.submissions?.[0]?.count ?? 0

  useEffect(() => {
    captureAnalyticsEvent('contest_viewed', {
      contest_id: contest.id,
      category: contest.category,
      phase,
      viewer_relationship: !user
        ? 'anonymous'
        : isLister
          ? 'host'
          : hasEntered
            ? 'entrant'
            : 'authenticated',
    })
  }, [contest.category, contest.id, hasEntered, isLister, phase, user])

  const handleEnterContest = async () => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }

    setEnterLoading(true)
    try {
      const res = await fetch(`/api/contests/${contest.id}/enter`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to enter contest')
      } else {
        setHasEntered(true)
        captureAnalyticsEvent('contest_entered', {
          contest_id: contest.id,
          category: contest.category,
        })
        toast.success('You have entered the contest', { position: 'top-center' })
        toast('You can now ask the host questions if needed.', {
          duration: 6000,
          position: 'top-right',
        })
        router.refresh()
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setEnterLoading(false)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: contest.title, url: window.location.href }).catch(console.error)
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard')
    }
  }

  const renderMaterials = () => (
    <div className="mt-6 space-y-3">
      {materials.map((material, index) => (
        <div key={material.id || index} className="rounded-xl border border-outline-variant bg-gray-50 p-5">
          <h3 className="mb-2 font-semibold text-on-surface">{material.label}</h3>
          {material.type === 'link' ? (
            <>
              <a
                href={material.content}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Open material <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-2 max-w-md truncate text-xs text-secondary">{material.content}</p>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">{material.content}</p>
          )}
        </div>
      ))}
    </div>
  )

  const renderPrimaryAction = () => {
    const disabledClass = 'min-h-11 rounded-lg border border-outline-variant bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600'
    const primaryClass = 'min-h-11 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700'

    if (isLister) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled className={disabledClass}>You are the host</button>
          <Link
            href={`/dashboard/lister/contest/${contest.id}`}
            className={primaryClass}
          >
            View submissions
          </Link>
        </div>
      )
    }

    if (phase === 'entry_open') {
      if (hasEntered) return <button disabled className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700">Entry confirmed</button>

      return (
        <div>
          <button onClick={handleEnterContest} disabled={enterLoading} className={primaryClass}>
            {enterLoading ? 'Entering…' : 'Enter contest'}
          </button>
          <p className="mt-2 max-w-xs text-xs leading-5 text-secondary">Entry is final and cannot be withdrawn.</p>
        </div>
      )
    }

    if (phase === 'submission_open') {
      if (!hasEntered) return <button disabled className={disabledClass}>Entry period closed</button>
      if (hasSubmitted) return <button disabled className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700">Submission received</button>

      return (
        <button
          onClick={() => {
            if (!user) {
              setAuthModalOpen(true)
              return
            }
            captureAnalyticsEvent('submission_started', {
              contest_id: contest.id,
              category: contest.category,
            })
            setSubmitDialogOpen(true)
          }}
          className={primaryClass}
        >
          Submit your work
        </button>
      )
    }

    if (phase === 'judging') return <button disabled className="min-h-11 rounded-lg border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800">Under review</button>
    return <button disabled className={disabledClass}>Contest closed</button>
  }

  const fullBriefLocked = (!hasEntered && phase !== 'entry_open' && !isLister) || (phase === 'entry_open' && !isLister)

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 font-sans md:px-8 md:py-10">
      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm">
        <div className="grid sm:grid-cols-[180px_1fr] lg:grid-cols-[180px_1fr_auto]">
          <div className="relative hidden min-h-[190px] overflow-hidden bg-indigo-50 sm:block">
            <img src={getCategoryImage(contest.category)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>

          <div className="min-w-0 p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {contest.category}
              </span>
              <ContestStatusBadge phase={phase} />
            </div>
            <h1 className="max-w-3xl font-heading text-3xl font-bold leading-tight text-on-surface md:text-4xl">
              {contest.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary md:text-base">
              {contest.public_summary || contest.description || ''}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {renderPrimaryAction()}
              <button
                onClick={handleShare}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-gray-50"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share
              </button>
            </div>
          </div>

          <div className="border-t border-outline-variant bg-[#F8F7FF] p-6 sm:col-span-2 lg:col-span-1 lg:min-w-[250px] lg:border-l lg:border-t-0 lg:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-secondary">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Prize
            </div>
            <p className="mt-2 text-3xl font-bold text-indigo-700">{formatINR(contest.prize_amount)}</p>
            <div className="mt-6 border-t border-indigo-100 pt-5">
              {phase === 'entry_open' ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-secondary">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Entry closes <span className="font-semibold text-on-surface">{contest.entry_deadline ? <CountdownTimer deadline={contest.entry_deadline} /> : 'soon'}</span></span>
                  </div>
                  {hasEntered && (
                    <div className="flex items-start gap-2 text-secondary">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Submission deadline <span className="font-semibold text-on-surface"><CountdownTimer deadline={contest.deadline} /></span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-secondary">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span><span className="font-semibold text-on-surface">{availableSlots}</span> of {entryLimit} slots available</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-secondary">
                  {(phase === 'submission_open' || hasEntered) && (
                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Submission deadline <span className="font-semibold text-on-surface"><CountdownTimer deadline={contest.deadline} /></span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span><span className="font-semibold text-on-surface">{submissionCount}</span> submissions</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-outline-variant bg-gray-50 px-6 py-5 md:px-8">
          <ContestLifecycle phase={phase} />
        </div>
      </section>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm md:p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">Public brief</p>
            <h2 className="font-heading text-2xl font-bold text-on-surface">Overview</h2>
            <article className="mt-4 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant md:text-base">
              {contest.public_summary || contest.description}
            </article>
          </section>

          <section className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Full brief and materials</p>
            {fullBriefLocked ? (
              <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-6 py-10 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600">
                  <Lock className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-on-surface">Unlocks after the entry period ends</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-secondary">
                  Only contestants who entered before the cutoff receive the full brief and materials during the submission period.
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <article className="whitespace-pre-wrap text-sm leading-7 text-on-surface-variant md:text-base">
                  {contest.description}
                </article>
                {canSeeMaterials && materials.length > 0 && renderMaterials()}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary">Hosted by</p>
            <div className="flex items-center gap-3">
              {contest.profiles?.avatar_url ? (
                <img className="h-11 w-11 rounded-full object-cover" src={contest.profiles.avatar_url} alt="" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
                  {contest.profiles?.full_name?.charAt(0).toUpperCase() || 'H'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${contest.lister_id}`} className="block truncate font-semibold text-on-surface hover:text-primary">
                  {contest.profiles?.full_name || 'Contest host'}
                </Link>
                <p className="text-xs text-secondary">View public profile</p>
              </div>
              {!isLister && hasEntered && contest.status !== 'completed' && contest.status !== 'cancelled' && (
                <button
                  onClick={() => { setChatOpen(true); setUnreadCount(0) }}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant text-secondary transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                  aria-label="Chat with contest host"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-on-surface">AI policy</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${contest.ai_policy === 'none' ? 'bg-red-50 text-red-700' : contest.ai_policy === 'partial' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                {contest.ai_policy === 'none' ? 'Not allowed' : contest.ai_policy === 'partial' ? 'Limited use' : 'Allowed'}
              </span>
            </div>
            <div className="mt-3 flex items-start gap-3 text-sm leading-6 text-secondary">
              <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                {contest.ai_policy === 'none'
                  ? 'Generative AI is not allowed for this contest and may result in disqualification.'
                  : contest.ai_policy === 'partial'
                    ? 'AI may support brainstorming or outlining, but the final work must be substantially human-created.'
                    : 'AI assistance is permitted for this contest.'}
              </p>
            </div>
          </section>
        </aside>
      </div>

      <SubmitDialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        contestId={contest.id}
        aiPolicy={contest.ai_policy}
        category={contest.category}
        onSuccess={() => setHasSubmitted(true)}
      />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {chatOpen && user && !isLister && hasEntered && contest.status !== 'completed' && contest.status !== 'cancelled' && (
        <ChatPanel
          contestId={contest.id}
          contestStatus={contest.status}
          recipientId={contest.lister_id}
          recipientName={contest.profiles?.full_name ?? 'Host'}
          currentUserId={user.id}
          currentUserName="You"
          onClose={() => { setChatOpen(false); setUnreadCount(0) }}
        />
      )}
    </main>
  )
}
