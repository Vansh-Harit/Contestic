'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { formatINR } from '@/lib/utils'
import type { ContestPhase } from '@/lib/utils'
import { SubmitDialog } from '@/components/submit-dialog'
import { CountdownTimer } from '@/components/countdown-timer'
import { AlertCircle, Lock, ExternalLink, MessageCircle, Clock, Trophy, Share2 } from 'lucide-react'
import AuthModal from '@/components/auth-modal'
import ChatPanel from '@/components/chat-panel'
import toast from 'react-hot-toast'

interface ContestDetailClientProps {
  contest: any
  user: User | null
  hasSubmitted: boolean
  hasEntered: boolean
  phase: ContestPhase
  canSeeMaterials: boolean
  materials: any[]
  initialUnreadCount?: number
}

export default function ContestDetailClient({
  contest,
  user,
  hasSubmitted: initialHasSubmitted,
  hasEntered: initialHasEntered,
  phase: initialPhase,
  canSeeMaterials,
  materials,
  initialUnreadCount = 0
}: ContestDetailClientProps) {
  const router = useRouter()
  const [hasSubmitted, setHasSubmitted] = useState(initialHasSubmitted)
  const [hasEntered, setHasEntered] = useState(initialHasEntered)
  const [phase] = useState(initialPhase)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [enterLoading, setEnterLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)

  const isLister = user?.id === contest.lister_id

  const handleEnterContest = async () => {
    if (!user) {
      setAuthModalOpen(true)
      return
    }
    setEnterLoading(true)
    try {
      const res = await fetch(`/api/contests/${contest.id}/enter`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to enter contest')
      } else {
        setHasEntered(true)
        toast.success('You have entered the tournament', { position: 'top-center' })
        toast('You can now ask questions to lister if needed.', {
          icon: '💬',
          duration: 6000,
          position: 'top-right'
        })
        router.refresh()
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setEnterLoading(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawLoading(true)
    try {
      const res = await fetch(`/api/contests/${contest.id}/enter`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to withdraw')
      } else {
        setHasEntered(false)
        toast.success('Withdrawn from contest')
        router.refresh()
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setWithdrawLoading(false)
    }
  }
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: contest.title,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard!')
    }
  }

  const renderMaterials = () => (
    <div className="space-y-4 mt-6">
      {materials.map((m: any, idx: number) => (
        <div key={m.id || idx} className="p-5 border border-outline-variant/50 rounded-lg bg-white shadow-sm">
          {m.type === 'link' ? (
            <div>
              <h3 className="font-bold text-on-surface text-body-md mb-2">{m.label}</h3>
              <a
                href={m.content}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-bold text-body-sm hover:opacity-90 transition-opacity"
              >
                Open <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <p className="text-[11px] text-secondary mt-2 truncate max-w-md">{m.content}</p>
            </div>
          ) : (
            <div>
              <h3 className="font-bold text-on-surface text-body-md mb-3">{m.label}</h3>
              <p className="text-on-surface-variant font-body-md leading-relaxed whitespace-pre-wrap">
                {m.content}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const renderHeroAction = () => {
    if (isLister) {
      return (
        <button disabled className="bg-surface-container text-secondary px-8 py-3 rounded-xl font-bold text-body-lg cursor-not-allowed">
          You are the lister
        </button>
      )
    }

    if (phase === 'entry_open') {
      if (hasEntered) {
        return (
          <div className="flex flex-col items-start gap-2">
            <button disabled className="bg-green-100 text-green-800 px-8 py-3 rounded-xl font-bold text-body-lg border border-green-200">
              Entered ✓
            </button>
            <button 
              onClick={handleWithdraw}
              disabled={withdrawLoading}
              className="text-body-sm text-secondary hover:text-red-500 hover:underline transition-colors cursor-pointer disabled:opacity-50 ml-2"
            >
              {withdrawLoading ? 'Withdrawing...' : 'Withdraw from contest'}
            </button>
          </div>
        )
      }
      return (
        <button
          onClick={handleEnterContest}
          disabled={enterLoading}
          className="bg-[#6B46C1] text-white px-8 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-sm"
        >
          {enterLoading ? 'Entering...' : 'Enter Contest ↗'}
        </button>
      )
    }

    if (phase === 'submission_open') {
      if (!hasEntered) {
        return (
          <button disabled className="bg-surface-container text-secondary px-8 py-3 rounded-xl font-bold text-body-lg cursor-not-allowed">
            Entry Period Closed
          </button>
        )
      }
      if (hasSubmitted) {
        return (
          <button disabled className="bg-green-100 text-green-800 px-8 py-3 rounded-xl font-bold text-body-lg border border-green-200">
            Submitted ✓
          </button>
        )
      }
      return (
        <button
          onClick={() => {
            if (!user) {
              setAuthModalOpen(true)
            } else {
              setSubmitDialogOpen(true)
            }
          }}
          className="bg-[#6B46C1] text-white px-8 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
        >
          Submit Your Work ↗
        </button>
      )
    }

    if (phase === 'judging') {
      return (
        <button disabled className="bg-yellow-50 text-yellow-800 px-8 py-3 rounded-xl font-bold text-body-lg border border-yellow-200 cursor-not-allowed">
          Under Review
        </button>
      )
    }

    return (
      <button disabled className="bg-surface-container text-secondary px-8 py-3 rounded-xl font-bold text-body-lg cursor-not-allowed">
        Contest Closed
      </button>
    )
  }

  return (
    <main className="max-w-[1200px] mx-auto w-full px-4 md:px-8 py-8 md:py-12 font-sans">
      
      {/* HERO SECTION */}
      <div className="bg-gradient-to-r from-[#FAFAFF] via-[#F4F1FF] to-[#FCE7F3] rounded-3xl p-8 md:p-12 mb-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-white/60 relative overflow-hidden">
        
        <div className="relative z-10 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-white/60 rounded-full text-[10px] font-bold text-secondary uppercase tracking-widest border border-black/5">
              {contest.category || 'Contest'}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm border
              ${phase === 'completed' || phase === 'cancelled' || contest.status === 'completed' ? 'bg-red-50 text-red-600 border-red-100' 
              : phase === 'judging' ? 'bg-yellow-50 text-yellow-600 border-yellow-100'
              : 'bg-green-50 text-green-600 border-green-100'}
            `}>
              <span className={`w-1.5 h-1.5 rounded-full ${phase === 'completed' || phase === 'cancelled' || contest.status === 'completed' ? 'bg-red-500' : phase === 'judging' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
              {phase === 'completed' || phase === 'cancelled' || contest.status === 'completed' ? 'Ended' : phase === 'judging' ? 'Judging' : phase === 'entry_open' ? 'Entry Open' : 'Submitting'}
            </span>
          </div>
          
          <h1 className="text-5xl md:text-[64px] leading-none font-heading font-black text-on-surface tracking-tight">
            {contest.title}
          </h1>
          
          <p className="text-secondary max-w-xl text-body-md mt-2 mb-4 leading-relaxed">
            {contest.public_summary || contest.description?.slice(0, 150) + (contest.description?.length > 150 ? '...' : '')}
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-2">
            {renderHeroAction()}
            
            <button 
              onClick={handleShare}
              className="bg-white text-on-surface px-6 py-2.5 rounded-full font-bold text-sm shadow-sm border border-outline-variant/40 flex items-center gap-2 cursor-pointer hover:bg-surface-container-lowest transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            
            <div className="flex items-center gap-1.5 text-secondary text-xs font-medium ml-2">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Deadline: {phase === 'completed' || phase === 'cancelled' || contest.status === 'completed' ? <span className="text-red-600 font-bold">Ended</span> : <CountdownTimer deadline={contest.deadline} />}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: BRIEFS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Public Brief */}
          <section className="bg-white rounded-2xl p-8 border border-black/10 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[10px] uppercase font-bold text-secondary tracking-widest">
                Public Brief
              </div>
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-4">Overview</h2>
            <article className="text-on-surface-variant font-body-sm leading-relaxed whitespace-pre-wrap">
              {contest.public_summary || contest.description}
            </article>
          </section>

          {/* Full Brief */}
          <section className="bg-white rounded-2xl p-8 border border-black/10 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[10px] uppercase font-bold text-secondary tracking-widest flex items-center gap-2">
                <span className="w-6 h-[1px] bg-outline-variant"></span>
                The Full Brief
              </div>
            </div>

            {(!hasEntered && phase !== 'entry_open' && !isLister) || (phase === 'entry_open' && !isLister) ? (
              <div className="bg-[#F8F7FF] p-10 rounded-2xl flex flex-col items-center justify-center text-center border border-[#EBE7FF] border-dashed mt-4">
                <div className="w-12 h-12 bg-[#8B5CF6] rounded-xl flex items-center justify-center mb-4 shadow-sm">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-on-surface mb-1.5">
                  Unlocks after you enter the contest
                </h3>
                <p className="text-xs text-secondary max-w-sm">
                  Full deliverables, evaluation rubric, and reference material live behind the entry gate.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500 mt-4">
                <article className="text-on-surface-variant font-body-md leading-relaxed whitespace-pre-wrap mb-8">
                  {contest.description}
                </article>
                {canSeeMaterials && materials.length > 0 && renderMaterials()}
              </div>
            )}
          </section>

          {/* AI Policy */}
          <section className="bg-[#FAF9F8] rounded-2xl p-5 border border-black/10 shadow-sm flex items-start gap-4">
            <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center shrink-0 border border-red-100">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-bold text-sm text-on-surface">AI Policy</h4>
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  contest.ai_policy === 'none' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {contest.ai_policy.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-secondary leading-relaxed max-w-2xl">
                {contest.ai_policy === 'none'
                  ? 'the host is against the use of ai for the contest use of ai might result in disqualification'
                  : 'AI may be used for brainstorming or outlining, but the final submission must be heavily edited and human-crafted.'}
              </p>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Prize Pool Card */}
          <div className="bg-[#7C3AED] rounded-t-2xl rounded-b-md p-6 shadow-sm text-white relative overflow-hidden">
            <Trophy className="absolute -right-4 -bottom-4 h-32 w-32 text-white opacity-[0.08]" />
            
            <div className="flex justify-between items-start mb-1 relative z-10">
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/90">Prize Pool</span>
              <Trophy className="h-5 w-5 text-white/80" />
            </div>
            <div className="text-[40px] font-black leading-none relative z-10">
              {formatINR(contest.prize_amount)}
            </div>
          </div>

          <div className="bg-white rounded-b-2xl rounded-t-md p-5 border border-black/10 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4 -mt-4 relative z-0">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 text-secondary">
                <Clock className="w-3.5 h-3.5" />
                Deadline
              </div>
              <div className="font-bold text-on-surface">
                {new Date(contest.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="h-[1px] bg-outline-variant/30 w-full" />
            
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-3.5 h-3.5 rounded-full border border-secondary flex items-center justify-center">
                  <div className="w-1 h-1 bg-secondary rounded-full"></div>
                </div>
                Status
              </div>
              <div className={`font-bold ${phase === 'completed' || phase === 'cancelled' || contest.status === 'completed' ? 'text-red-600' : 'text-green-600'}`}>
                {phase === 'completed' || phase === 'cancelled' || contest.status === 'completed' ? 'Ended' : 'Active'}
              </div>
            </div>
            <div className="h-[1px] bg-outline-variant/30 w-full" />

            <div className="flex justify-between items-center text-xs">
              <div className="text-secondary pl-5">
                Entries
              </div>
              <div className="font-bold text-on-surface">
                {contest.submissions?.[0]?.count || 0} submissions
              </div>
            </div>
          </div>

          {/* Listed By Card */}
          <div className="bg-white rounded-2xl p-5 border border-black/10 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="text-[10px] uppercase font-bold text-secondary tracking-widest mb-3">
              Listed By
            </div>
            
            <div className="flex items-center gap-3">
              {contest.profiles?.avatar_url ? (
                <img
                  className="w-12 h-12 rounded-xl object-cover"
                  src={contest.profiles.avatar_url}
                  alt="Lister Avatar"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center font-bold text-lg">
                  {contest.profiles?.full_name?.substring(0, 2).toUpperCase() || 'L'}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-on-surface truncate">
                    {contest.profiles?.full_name || 'Anonymous Client'}
                  </h3>
                  
                  {/* Chat Notification Ping in Listed By card */}
                  {!isLister && hasEntered && contest.status !== 'completed' && contest.status !== 'cancelled' && (
                    <button 
                      onClick={() => {
                        setChatOpen(true)
                        setUnreadCount(0)
                      }}
                      className="relative p-1.5 text-secondary hover:text-[#7C3AED] hover:bg-surface-container rounded-full transition-colors cursor-pointer shrink-0"
                      title="Chat with Lister"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-secondary truncate mt-0.5">
                  Host
                </p>
              </div>
            </div>
          </div>
          
        </div>
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
          recipientName={contest.profiles?.full_name ?? 'Lister'}
          currentUserId={user.id}
          currentUserName="You"
          onClose={() => {
            setChatOpen(false)
            setUnreadCount(0) // Mark read when closing chat
          }}
        />
      )}
    </main>
  )
}
