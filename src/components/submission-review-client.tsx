'use client'

import { useState, useEffect, useRef } from 'react'
import { getContestPhase } from '@/lib/utils'
import { Inbox, ArrowLeft, Trophy, MessageCircle, ExternalLink, Download, Image as ImageIcon, FileText } from 'lucide-react'
import Link from 'next/link'
import ChatPanel from '@/components/chat-panel'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface SubmissionReviewClientProps {
  contest: any
  submissions: any[]
  userId: string
  entrants?: any[]
  initialUnreadCounts?: Record<string, number>
}

// Helper to render text with auto-detected clickable links
function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7C3AED] underline hover:text-violet-800 break-all"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function SubmissionReviewClient({ contest, submissions, userId, entrants = [], initialUnreadCounts = {} }: SubmissionReviewClientProps) {
  const phase = getContestPhase(contest)
  const [activeChat, setActiveChat] = useState<{ recipientId: string; recipientName: string } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState(initialUnreadCounts)
  const [selectedEntrantId, setSelectedEntrantId] = useState<string | null>(null)
  const submissionRef = useRef<HTMLDivElement>(null)

  // Scroll to submission when an entrant is selected
  useEffect(() => {
    if (selectedEntrantId && submissionRef.current) {
      submissionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedEntrantId])
  
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  
  const router = useRouter()

  const canChat = contest.status === 'active' || contest.status === 'judging'

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
        body: JSON.stringify({ submission_id: selectedSubmissionId })
      })
  
      const data = await res.json()
      console.log('[Pick Winner] Response:', res.status, data)
  
      if (!res.ok) {
        toast.error(data.error ?? `Failed — status ${res.status}`)
        setIsConfirming(false)
        return
      }
  
      toast.success('Winner selected!')
      setConfirmDialogOpen(false)
      router.refresh()
  
    } catch (err) {
      console.error('[Pick Winner] Error:', err)
      toast.error('Network error — try again')
      setIsConfirming(false)
    }
  }

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp)$/i.test(url)
  const isPdfUrl = (url: string) => /\.pdf$/i.test(url)

  const renderAttachments = (fileUrls: any[]) => {
    if (!fileUrls || fileUrls.length === 0) return null

    const images = fileUrls.filter(f => f.type === 'upload' && isImageUrl(f.url))
    const pdfs = fileUrls.filter(f => f.type === 'upload' && isPdfUrl(f.url))
    const driveLinks = fileUrls.filter(f => f.type === 'drive_link')

    return (
      <div className="mt-4 space-y-3">
        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((file, i) => (
              <div
                key={i}
                onClick={() => setLightboxImage(file.url)}
                className="cursor-pointer group"
              >
                <img
                  src={file.url}
                  alt={file.filename}
                  className="w-[120px] h-[120px] object-cover rounded-lg border border-outline-variant group-hover:border-[#7C3AED] transition-colors"
                />
                <p className="text-[11px] text-secondary mt-1 truncate max-w-[120px]">
                  {file.filename}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* PDF downloads */}
        {pdfs.map((file, i) => (
          <a
            key={`pdf-${i}`}
            href={file.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 hover:bg-red-100 transition-colors text-sm font-medium no-underline"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{file.filename}</span>
            <Download className="h-3.5 w-3.5 ml-auto shrink-0" />
          </a>
        ))}

        {/* Drive links */}
        {driveLinks.map((file, i) => (
          <a
            key={`link-${i}`}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 hover:bg-blue-100 transition-colors text-sm font-medium no-underline"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{file.filename}</span>
            <span className="text-xs text-blue-600 ml-auto shrink-0">Open →</span>
          </a>
        ))}
      </div>
    )
  }

  return (
    <main className="max-w-7xl mx-auto w-full px-container-padding-mobile md:px-container-padding-desktop py-12 flex-1 flex flex-col font-sans">
      <Link href="/dashboard/lister" className="flex items-center gap-2 text-secondary hover:text-[#7C3AED] mb-8 font-medium w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-outline-variant pb-8">
        <div>
          <h1 className="text-headline-lg font-heading font-bold text-on-surface mb-2">
            Review Submissions
          </h1>
          <p className="text-body-md text-secondary font-medium">
            {contest.title}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-12">
        <h2 className="text-xl font-bold">Registered Entrants</h2>
        {entrants.length === 0 ? (
          <div className="border border-outline-variant bg-surface-container-lowest rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[250px]">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-secondary mb-6">
              <Inbox className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-headline-sm font-bold text-on-surface mb-2">
              No one has registered yet
            </h3>
            <p className="text-body-md text-secondary max-w-md mx-auto">
              Share your contest link to get more participants!
            </p>
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 pb-4">
            {entrants.map((entrant) => {
              const unreadCount = unreadCounts[entrant.contestant_id] || 0
              const isSelected = selectedEntrantId === entrant.contestant_id
              return (
                <div key={entrant.contestant_id} className={`min-w-[200px] border ${isSelected ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20 bg-[#7C3AED]/5' : 'border-outline-variant bg-surface-container-lowest'} rounded-xl p-4 shadow-sm flex flex-col items-center text-center relative transition-all`}>
                  
                  {/* Top Right Message Icon */}
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveChat({
                          recipientId: entrant.contestant_id,
                          recipientName: entrant.profiles?.full_name ?? 'Contestant',
                        })
                        setUnreadCounts(prev => ({ ...prev, [entrant.contestant_id]: 0 }))
                      }}
                      className="p-2 text-secondary hover:text-[#7C3AED] hover:bg-surface-container rounded-full transition-colors relative cursor-pointer"
                      title="Message"
                    >
                      <MessageCircle className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                        </span>
                      )}
                    </button>
                  </div>

                  {entrant.profiles?.avatar_url ? (
                    <img src={entrant.profiles.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full mb-3 mt-4" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface font-bold text-xl mb-3 mt-4">
                      {entrant.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <h3 className="font-bold text-on-surface text-body-lg mb-1 truncate w-full">{entrant.profiles?.full_name || 'Anonymous'}</h3>
                  
                  <div className="mt-auto pt-4 w-full relative">
                    <button
                      onClick={() => setSelectedEntrantId(entrant.contestant_id)}
                      className={`w-full flex justify-center items-center gap-1.5 text-body-sm font-medium transition-colors cursor-pointer px-3 py-2 rounded-lg ${
                        isSelected 
                          ? 'bg-[#7C3AED] text-white shadow-md'
                          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      View Submission
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedEntrantId && (
        <div ref={submissionRef} className="flex flex-col gap-4 mt-8">
          <h2 className="text-xl font-bold">Submission</h2>
          {(() => {
            const sub = submissions.find(s => s.contestant_id === selectedEntrantId)
            
            if (!sub) {
              return (
                <div className="border border-outline-variant bg-surface-container-lowest rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[250px] shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-secondary mb-6">
                    <Inbox className="h-8 w-8 text-secondary" />
                  </div>
                  <h3 className="text-headline-sm font-bold text-on-surface mb-2">
                    No submission yet
                  </h3>
                  <p className="text-body-md text-secondary max-w-md mx-auto">
                    This participant has not submitted their entry yet.
                  </p>
                </div>
              )
            }

            const isWinner = contest.winner_submission_id === sub.id

            return (
              <div className={`border ${isWinner ? 'border-[#7C3AED] shadow-md bg-[#7C3AED]/10' : 'border-outline-variant bg-surface-container-lowest'} rounded-xl p-6 shadow-sm`}>
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6 pb-6 border-b border-outline-variant">
                  <div className="flex items-center gap-3">
                    {sub.profiles?.avatar_url ? (
                      <img src={sub.profiles.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface font-bold text-lg">
                        {sub.profiles?.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-on-surface text-title-md">{sub.profiles?.full_name || 'Anonymous'}</h3>
                      <p className="text-body-sm text-secondary">Submitted {new Date(sub.submitted_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isWinner && (
                      <span className="flex items-center gap-1.5 text-[#7C3AED] font-bold text-body-sm bg-[#7C3AED]/10 px-3 py-1.5 rounded-lg border border-[#7C3AED]/20">
                        <Trophy className="h-4 w-4" />
                        Winner
                      </span>
                    )}
                    {phase === 'judging' && !contest.winner_submission_id && (
                      <button
                        onClick={() => {
                          setSelectedSubmissionId(sub.id)
                          setConfirmDialogOpen(true)
                        }}
                        className="flex items-center gap-1.5 text-body-sm bg-[#7C3AED] text-white hover:opacity-90 font-bold transition-colors cursor-pointer px-4 py-2 rounded-lg shadow-sm"
                      >
                        <Trophy className="h-4 w-4" />
                        Pick as Winner
                      </button>
                    )}
                  </div>
                </div>

                {sub.content && sub.content.trim() !== '' && (
                  <div className="bg-surface-container-lowest p-6 rounded-xl whitespace-pre-wrap text-on-surface font-body-md border border-outline-variant leading-relaxed">
                    {renderTextWithLinks(sub.content)}
                  </div>
                )}

                <div className="mt-6">
                  {renderAttachments(sub.file_urls)}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {activeChat && (
        <ChatPanel
          contestId={contest.id}
          contestStatus={contest.status}
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          currentUserId={userId}
          currentUserName="You"
          onClose={() => setActiveChat(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-lg max-w-md w-full border border-outline-variant">
            <h3 className="text-headline-sm font-bold text-on-surface mb-2">Confirm Winner</h3>
            <p className="text-body-md text-secondary mb-6">
              Are you sure you want to select this submission as the winner? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialogOpen(false)}
                disabled={isConfirming}
                className="px-4 py-2 rounded-lg text-body-sm font-bold text-secondary hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWinner}
                disabled={isConfirming}
                className="px-4 py-2 rounded-lg text-body-sm font-bold bg-[#7C3AED] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {isConfirming ? 'Confirming...' : 'Confirm Winner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center cursor-zoom-out"
        >
          <a
            href={`/api/download?url=${encodeURIComponent(lightboxImage)}`}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors cursor-pointer flex items-center gap-2"
            title="Download Image"
          >
            <Download className="h-5 w-5" />
            <span className="text-sm font-medium pr-1">Download</span>
          </a>
          <img
            src={lightboxImage}
            alt="Full size preview"
            className="max-w-[90%] max-h-[90%] object-contain"
          />
        </div>
      )}
    </main>
  )
}
