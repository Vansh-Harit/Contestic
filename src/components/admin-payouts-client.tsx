'use client'

import { useState } from 'react'
import { formatINR } from '@/lib/utils'
import { CheckCircle, Clock, AlertTriangle, Copy, Check, Send, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

type PayoutStatus = 'pending_transfer' | 'awaiting_upi' | 'transferred' | 'failed'

interface Payout {
  id: string
  contest_id: string
  winner_id: string
  winner_upi: string | null
  status: PayoutStatus
  admin_note: string | null
  transferred_at: string | null
  created_at: string
  contests: {
    title: string
    prize_amount: number
  }
  profiles: {
    full_name: string | null
    email: string
    upi_id: string | null
  }
}

export default function AdminPayoutsClient({ initialPayouts }: { initialPayouts: Payout[] }) {
  const [payouts, setPayouts] = useState<Payout[]>(initialPayouts)
  const [activeTab, setActiveTab] = useState<PayoutStatus>('pending_transfer')
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({})
  const [upiInputs, setUpiInputs] = useState<Record<string, string>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const tabCounts = {
    pending_transfer: payouts.filter(p => p.status === 'pending_transfer').length,
    awaiting_upi: payouts.filter(p => p.status === 'awaiting_upi').length,
    transferred: payouts.filter(p => p.status === 'transferred').length,
    failed: payouts.filter(p => p.status === 'failed').length,
  }

  const filteredPayouts = payouts.filter(p => p.status === activeTab)

  const handleMarkTransferred = async (payoutId: string) => {
    const transferReference = (utrInputs[payoutId] || '').trim()
    if (transferReference.length < 3 || transferReference.length > 100) {
      toast.error('Enter the UPI/UTR transaction reference first')
      return
    }
    setLoadingIds(prev => new Set(prev).add(payoutId))
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: transferReference }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to mark as transferred')
      }
      // Move payout to transferred
      setPayouts(prev =>
        prev.map(p =>
          p.id === payoutId
            ? { ...p, status: 'transferred' as PayoutStatus, admin_note: transferReference, transferred_at: new Date().toISOString() }
            : p
        )
      )
      toast.success('Payout marked as transferred')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(payoutId); return s })
    }
  }

  const handleSaveUpi = async (payoutId: string) => {
    const upiId = upiInputs[payoutId]
    if (!upiId || !upiId.includes('@') || upiId.length < 5) {
      toast.error('Enter a valid UPI ID (e.g. name@upi)')
      return
    }
    setLoadingIds(prev => new Set(prev).add(payoutId))
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/upi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi_id: upiId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save UPI')
      }
      // Move payout to pending_transfer
      setPayouts(prev =>
        prev.map(p =>
          p.id === payoutId
            ? { ...p, status: 'pending_transfer' as PayoutStatus, winner_upi: upiId }
            : p
        )
      )
      toast.success('UPI saved — payout is now pending transfer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(payoutId); return s })
    }
  }

  const handleCopyUpi = (payoutId: string, upiId: string) => {
    navigator.clipboard.writeText(upiId)
    setCopiedId(payoutId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const tabs: { key: PayoutStatus; label: string; icon: React.ReactNode }[] = [
    { key: 'pending_transfer', label: 'Pending Transfer', icon: <Send className="h-4 w-4" /> },
    { key: 'awaiting_upi', label: 'Awaiting UPI', icon: <Clock className="h-4 w-4" /> },
    { key: 'transferred', label: 'Completed', icon: <CheckCircle className="h-4 w-4" /> },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_transfer':
        return <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700">Pending Transfer</span>
      case 'awaiting_upi':
        return <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700">Awaiting UPI</span>
      case 'transferred':
        return <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-800">Transferred</span>
      case 'failed':
        return <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-700">Failed</span>
      default:
        return null
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-container-padding-mobile py-10 font-sans md:px-container-padding-desktop md:py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-3xl font-bold text-on-surface">
            Payout dashboard
          </h1>
        </div>
        <p className="text-body-md text-secondary">
          Track and confirm manual prize transfers to contest winners.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-8 flex gap-2 overflow-x-auto border-b border-outline-variant pb-px">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface hover:border-outline-variant'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tabCounts[tab.key] > 0 && (
              <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-secondary'
              }`}>
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Payout Cards */}
      <div className="space-y-4">
        {filteredPayouts.length === 0 ? (
          <div className="border border-dashed border-outline-variant rounded-xl p-12 text-center">
            <p className="text-secondary text-body-md">
              No payouts in this category.
            </p>
          </div>
        ) : (
          filteredPayouts.map(payout => {
            const isLoading = loadingIds.has(payout.id)
            const upiId = payout.winner_upi || payout.profiles?.upi_id
            const isTransferred = payout.status === 'transferred'

            return (
              <div
                key={payout.id}
                className={`rounded-xl border border-outline-variant bg-white p-5 shadow-sm transition-opacity md:p-6 ${
                  isTransferred ? 'opacity-60' : ''
                }`}
              >
                {/* Top Row: Contest + Status */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-bold text-on-surface text-body-md mb-1">
                      {payout.contests?.title || 'Unknown Contest'}
                    </h3>
                    <p className="text-body-sm text-secondary">
                      Winner:{' '}
                      <a
                        href={`mailto:${payout.profiles?.email}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {payout.profiles?.full_name || 'Unknown'} ({payout.profiles?.email})
                      </a>
                    </p>
                  </div>
                  {getStatusBadge(payout.status)}
                </div>

                {/* Prize + UPI + Date row */}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-4 pb-4 border-b border-outline-variant">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block">Prize</span>
                    <span className="font-mono font-bold text-lg text-primary-container">
                      {formatINR(payout.contests?.prize_amount || 0)}
                    </span>
                  </div>
                  {upiId && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block">Winner UPI</span>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-body-md text-on-surface bg-surface-container px-2 py-0.5 rounded">
                          {upiId}
                        </code>
                        {!isTransferred && (
                          <button
                            onClick={() => handleCopyUpi(payout.id, upiId)}
                            className="flex items-center gap-1 text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
                          >
                            {copiedId === payout.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                                <span className="font-semibold text-green-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy UPI</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block">Created</span>
                    <span className="text-body-sm text-on-surface">
                      {new Date(payout.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  {isTransferred && payout.transferred_at && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-secondary block">Transferred</span>
                      <span className="text-body-sm text-green-700 font-medium">
                        {new Date(payout.transferred_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* PENDING TRANSFER: UTR input + confirm button */}
                {payout.status === 'pending_transfer' && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="UTR number or transaction ID"
                      value={utrInputs[payout.id] || ''}
                      onChange={e => setUtrInputs(prev => ({ ...prev, [payout.id]: e.target.value }))}
                      className="flex-1 p-3 bg-transparent border border-outline-variant rounded-lg focus:border-primary-container outline-none text-body-sm transition-all"
                    />
                    <button
                      onClick={() => handleMarkTransferred(payout.id)}
                      disabled={isLoading}
                      className="shrink-0 rounded-lg bg-primary-container px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                      {isLoading ? 'Processing...' : 'Mark as Transferred'}
                    </button>
                  </div>
                )}

                {/* AWAITING UPI: info + manual entry */}
                {payout.status === 'awaiting_upi' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-body-sm text-amber-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Waiting for winner to provide their UPI ID</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Enter UPI manually (e.g. name@upi)"
                        value={upiInputs[payout.id] || ''}
                        onChange={e => setUpiInputs(prev => ({ ...prev, [payout.id]: e.target.value }))}
                        className="flex-1 p-3 bg-transparent border border-outline-variant rounded-lg focus:border-primary-container outline-none text-body-sm transition-all"
                      />
                      <button
                        onClick={() => handleSaveUpi(payout.id)}
                        disabled={isLoading}
                      className="shrink-0 rounded-lg bg-primary-container px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                      >
                        {isLoading ? 'Saving...' : 'Save UPI'}
                      </button>
                    </div>
                  </div>
                )}

                {/* TRANSFERRED: show note */}
                {isTransferred && payout.admin_note && (
                  <div className="text-body-sm text-secondary">
                    <span className="font-bold">UTR/Ref:</span> {payout.admin_note}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
