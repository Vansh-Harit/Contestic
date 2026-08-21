'use client'

import { useEffect, useRef, useState } from 'react'
import { getContestPhase } from '@/lib/utils'
import { ArrowLeft, Download, ExternalLink, FileText, Inbox, MessageCircle, Trophy } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ContestStatusBadge } from '@/components/contest-lifecycle'
import type { Contest, SubmissionAttachment } from '@/lib/types'
import { captureAnalyticsEvent } from '@/lib/analytics'

const ChatPanel = dynamic(() => import('@/components/chat-panel'), { ssr: false })

type ReviewContest = Pick<
  Contest,
  'id' | 'title' | 'status' | 'deadline' | 'entry_deadline' | 'entry_limit' | 'max_entries' | 'entry_count' | 'winner_submission_id'
>

type ReviewAttachment = SubmissionAttachment

interface ReviewSubmission {
  id: string
  contestant_id: string
  content: string
  submitted_at: string
  file_urls: ReviewAttachment[]
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

export interface ReviewEntrant {
  contestant_id: string
  profiles?: { full_name: string | null; avatar_url: string | null } | null
}

interface SubmissionReviewClientProps {
  contest: ReviewContest
  submissions: ReviewSubmission[]
  userId: string
  entrants?: ReviewEntrant[]
  initialUnreadCounts?: Record<string, number>
}

function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.split(urlRegex).map((part, index) => part.match(urlRegex) ? (
    <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-700 underline hover:text-indigo-900">
      {part}
    </a>
  ) : <span key={index}>{part}</span>)
}

export default function SubmissionReviewClient({
  contest,
  submissions,
  userId,
  entrants = [],
  initialUnreadCounts = {},
}: SubmissionReviewClientProps) {
  const phase = getContestPhase(contest)
  const [activeChat, setActiveChat] = useState<{ recipientId: string; recipientName: string } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState(initialUnreadCounts)
  const [selectedEntrantId, setSelectedEntrantId] = useState<string | null>(null)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const submissionRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (selectedEntrantId && submissionRef.current && window.innerWidth < 1024) {
      submissionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedEntrantId])

  async function handleConfirmWinner() {
    if (!selectedSubmissionId) {
      toast.error('No submission selected')
      return
    }

    setIsConfirming(true)
    try {
      const res = await fetch(`/api/contests/${contest.id}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: selectedSubmissionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? `Failed — status ${res.status}`)
        setIsConfirming(false)
        return
      }

      captureAnalyticsEvent('winner_selected', {
        contest_id: contest.id,
        submission_count: submissions.length,
      })
      toast.success('Winner selected. Submission and chat access is now closed.')
      setConfirmDialogOpen(false)
      setActiveChat(null)
      setSelectedEntrantId(null)
      router.refresh()
    } catch (error) {
      console.error('[Pick Winner] Error:', error)
      toast.error('Network error — try again')
      setIsConfirming(false)
    }
  }

  const hasFileExtension = (
    file: ReviewAttachment,
    extensionPattern: RegExp
  ) => [file.filename, file.key, file.url].some(
    (value) => typeof value === 'string' && extensionPattern.test(value)
  )
  const isImageAttachment = (file: ReviewAttachment) =>
    hasFileExtension(file, /\.(jpg|jpeg|jfif|png|webp|svg)(?:$|[?#])/i)
  const isPdfAttachment = (file: ReviewAttachment) =>
    hasFileExtension(file, /\.pdf(?:$|[?#])/i)
  const accessHasEnded = phase === 'completed' || phase === 'cancelled'
  const selectedSubmission = submissions.find((submission) => submission.contestant_id === selectedEntrantId)

  const renderAttachments = (files: ReviewAttachment[]) => {
    if (!files?.length) return <p className="text-sm text-secondary">No files or external links were attached.</p>

    const images = files.filter((file): file is ReviewAttachment & { url: string } => file.type === 'upload' && !!file.url && isImageAttachment(file))
    const pdfs = files.filter((file): file is ReviewAttachment & { url: string } => file.type === 'upload' && !!file.url && isPdfAttachment(file))
    const driveLinks = files.filter((file): file is ReviewAttachment & { url: string } => file.type === 'drive_link' && !!file.url)

    return (
      <div className="space-y-4">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((file, index) => (
              <button key={index} onClick={() => setLightboxImage(file.url)} className="group text-left">
                <img src={file.url} alt={file.filename} className="h-28 w-28 rounded-lg border border-outline-variant object-cover transition-colors group-hover:border-indigo-400" />
                <span className="mt-1 block max-w-28 truncate text-[11px] text-secondary">{file.filename}</span>
              </button>
            ))}
          </div>
        )}
        {pdfs.map((file, index) => (
          <a key={`pdf-${index}`} href={file.url} download target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100">
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{file.filename}</span>
            <Download className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        ))}
        {driveLinks.map((file, index) => (
          <a key={`link-${index}`} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-sm font-medium text-indigo-800 transition-colors hover:bg-indigo-100">
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{file.filename}</span>
            <span className="ml-auto shrink-0 text-xs">Open link</span>
          </a>
        ))}
      </div>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-container-padding-mobile py-8 font-sans md:px-container-padding-desktop md:py-10">
      <Link href="/dashboard/lister" className="mb-6 flex w-fit items-center gap-2 text-sm font-medium text-secondary transition-colors hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to hosted contests
      </Link>

      <header className="mb-8 rounded-2xl border border-outline-variant bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-700">Review submissions</p>
            <h1 className="mt-1 font-heading text-3xl font-bold text-on-surface md:text-4xl">{contest.title}</h1>
            <p className="mt-2 text-sm text-secondary">{entrants.length} registered entrants · {submissions.length} submissions</p>
          </div>
          <ContestStatusBadge phase={phase} />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <h2 className="px-1 font-heading text-xl font-bold text-on-surface">Entrants</h2>
          {entrants.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
              <Inbox className="mb-3 h-7 w-7 text-gray-400" aria-hidden="true" />
              <p className="font-medium text-on-surface">No registered entrants</p>
              <p className="mt-1 text-sm text-secondary">Entries will appear here when someone joins.</p>
            </div>
          ) : (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:max-h-[65vh] lg:flex-col lg:overflow-y-auto">
              {entrants.map((entrant) => {
                const isSelected = selectedEntrantId === entrant.contestant_id
                const unreadCount = unreadCounts[entrant.contestant_id] || 0
                return (
                  <div key={entrant.contestant_id} className={`flex min-w-[220px] items-center gap-3 rounded-xl border p-3 transition-colors lg:min-w-0 ${isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-outline-variant bg-white hover:bg-gray-50'}`}>
                    {entrant.profiles?.avatar_url ? (
                      <img src={entrant.profiles.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-700">
                        {entrant.profiles?.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${entrant.contestant_id}`} className="block truncate text-sm font-semibold text-on-surface hover:text-primary">
                        {entrant.profiles?.full_name || 'Anonymous'}
                      </Link>
                      <button onClick={() => setSelectedEntrantId(entrant.contestant_id)} disabled={accessHasEnded} className="mt-1 text-xs font-medium text-indigo-700 hover:underline">
                        {accessHasEnded ? 'Access closed' : isSelected ? 'Selected' : 'View submission'}
                      </button>
                    </div>
                    {!accessHasEnded && (
                      <button
                        onClick={() => {
                          setActiveChat({ recipientId: entrant.contestant_id, recipientName: entrant.profiles?.full_name ?? 'Contestant' })
                          setUnreadCounts((previous) => ({ ...previous, [entrant.contestant_id]: 0 }))
                        }}
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-white hover:text-primary"
                        aria-label={`Message ${entrant.profiles?.full_name || 'contestant'}`}
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section ref={submissionRef} className="min-h-[420px] rounded-2xl border border-outline-variant bg-white p-5 shadow-sm md:p-7">
          {!selectedEntrantId ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Inbox className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
              <h2 className="font-heading text-xl font-bold text-on-surface">Select an entrant</h2>
              <p className="mt-1 text-sm text-secondary">Their submission, files and links will appear here.</p>
            </div>
          ) : !selectedSubmission ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Inbox className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
              <h2 className="font-heading text-xl font-bold text-on-surface">No submission yet</h2>
              <p className="mt-1 text-sm text-secondary">This entrant has not submitted work.</p>
            </div>
          ) : (
            <SubmissionDetail
              submission={selectedSubmission}
              isWinner={contest.winner_submission_id === selectedSubmission.id}
              canPickWinner={phase === 'judging' && !contest.winner_submission_id}
              onPickWinner={() => {
                setSelectedSubmissionId(selectedSubmission.id)
                setConfirmDialogOpen(true)
              }}
              renderAttachments={renderAttachments}
            />
          )}
        </section>
      </div>

      {activeChat && !accessHasEnded && (
        <ChatPanel contestId={contest.id} contestStatus={contest.status} recipientId={activeChat.recipientId} recipientName={activeChat.recipientName} currentUserId={userId} currentUserName="You" onClose={() => setActiveChat(null)} />
      )}

      {confirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-6 shadow-xl">
            <h3 className="font-heading text-2xl font-bold text-on-surface">Confirm winner</h3>
            <div className="mt-3 space-y-3 text-sm leading-6 text-secondary">
              <p>Selecting a winner is permanent and cannot be undone.</p>
              <p>All uploaded submission files and access to submission links and chat will be removed after a successful selection. Download anything you need before continuing.</p>
              <p>If the selected work contains a watermark, ask the contestant in chat for the final unwatermarked version before confirming.</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDialogOpen(false)} disabled={isConfirming} className="min-h-11 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-secondary hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirmWinner} disabled={isConfirming} className="min-h-11 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
                {isConfirming ? 'Confirming…' : 'Confirm winner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} className="fixed inset-0 z-[999] flex cursor-zoom-out items-center justify-center bg-black/90 p-4">
          <a href={lightboxImage} download onClick={(event) => event.stopPropagation()} className="absolute right-5 top-5 flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg" title="Download image">
            <Download className="h-4 w-4" aria-hidden="true" />
            Download
          </a>
          <img src={lightboxImage} alt="Full size preview" className="max-h-[90%] max-w-[95%] object-contain" />
        </div>
      )}
    </main>
  )
}

function SubmissionDetail({
  submission,
  isWinner,
  canPickWinner,
  onPickWinner,
  renderAttachments,
}: {
  submission: ReviewSubmission
  isWinner: boolean
  canPickWinner: boolean
  onPickWinner: () => void
  renderAttachments: (files: ReviewAttachment[]) => React.ReactNode
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-outline-variant pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {submission.profiles?.avatar_url ? (
            <img src={submission.profiles.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-700">{submission.profiles?.full_name?.charAt(0) || '?'}</div>
          )}
          <div>
            <Link href={`/profile/${submission.contestant_id}`} className="font-semibold text-on-surface hover:text-primary">{submission.profiles?.full_name || 'Anonymous'}</Link>
            <p className="text-xs text-secondary">Submitted {new Date(submission.submitted_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
          </div>
        </div>
        {isWinner ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800"><Trophy className="h-4 w-4" aria-hidden="true" />Winner</span>
        ) : canPickWinner ? (
          <button onClick={onPickWinner} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"><Trophy className="h-4 w-4" aria-hidden="true" />Pick as winner</button>
        ) : null}
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">Submission description</h3>
        <div className="mt-2 rounded-xl border border-outline-variant bg-gray-50 p-5 text-sm leading-7 text-on-surface">
          {submission.content?.trim() ? renderTextWithLinks(submission.content) : <span className="italic text-secondary">No description was provided.</span>}
        </div>
      </div>
      <div className="mt-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary">Files and links</h3>
        {renderAttachments(submission.file_urls)}
      </div>
    </div>
  )
}
