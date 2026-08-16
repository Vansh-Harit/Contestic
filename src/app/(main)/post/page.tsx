'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Tag, Palette, ChevronLeft, Calendar, Clock, X, LayoutGrid, Video, CreditCard, ShieldCheck, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { ContestFormData } from '@/lib/types'
import {
  formatINR,
  rupeesToPaise,
  calcPlatformFee,
  calcTotal,
} from '@/lib/utils'
import {
  MIN_PRIZE_INR,
  MAX_PRIZE_INR,
  MIN_ENTRIES,
  MAX_ENTRIES,
  PLATFORM_FEE_PERCENT,
} from '@/lib/constants'
import { captureAnalyticsEvent } from '@/lib/analytics'

export default function PostContestPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<ContestFormData>({
    title: '',
    description: '',
    public_summary: '',
    category: 'Content Writing',
    prize_amount_inr: 0,
    max_entries: 30,
    deadline: '',
    ai_policy: 'none',
    entry_window_hours: 24,
    materials: [],
  })

  const [draftLoaded, setDraftLoaded] = useState(false)
  const [draftContestId, setDraftContestId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      const params = new URLSearchParams(window.location.search)
      if (params.get('load_draft') === 'true') {
        const saved = localStorage.getItem('contestic_contest_draft')
        if (saved) {
          try {
            const {
              formData: savedData,
              step: savedStep,
              timestamp,
              contestId,
              feePercent,
            } = JSON.parse(saved)
            // Check if less than 2 days old (2 * 24 * 60 * 60 * 1000 = 172800000 ms)
            if (Date.now() - timestamp < 172800000) {
              setFormData(savedData)
              setStep(savedStep)
              const pricingIsCurrent = feePercent === PLATFORM_FEE_PERCENT
              setDraftContestId(
                pricingIsCurrent && typeof contestId === 'string' ? contestId : null
              )
              toast.success(
                pricingIsCurrent
                  ? 'Restored your draft in progress!'
                  : `Draft restored with the current ${PLATFORM_FEE_PERCENT}% platform fee.`,
                { position: 'top-center' }
              )
            } else {
              localStorage.removeItem('contestic_contest_draft')
            }
          } catch (error) {
            console.error('Failed to parse draft', error)
          }
        }
      }
      setDraftLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draftLoaded) return

    // Save draft
    const draft = {
      formData,
      step,
      timestamp: Date.now(),
      contestId: draftContestId,
      feePercent: PLATFORM_FEE_PERCENT,
    }
    localStorage.setItem('contestic_contest_draft', JSON.stringify(draft))
  }, [formData, step, draftLoaded, draftContestId])

  const updateField = <K extends keyof ContestFormData>(
    key: K,
    value: ContestFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // --- DATE/TIME HELPERS ---
  const timeSlots = (() => {
    const slots: string[] = []
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const hh = h.toString().padStart(2, '0')
        const mm = m.toString().padStart(2, '0')
        slots.push(`${hh}:${mm}`)
      }
    }
    return slots
  })()

  const formatTime12 = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  const splitDateTime = (iso: string) => {
    if (!iso) return { date: '', time: '12:00' }
    // iso can be "YYYY-MM-DDTHH:MM" or a full ISO string
    const d = new Date(iso)
    if (isNaN(d.getTime())) return { date: '', time: '12:00' }
    const yyyy = d.getFullYear()
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const dd = d.getDate().toString().padStart(2, '0')
    const hh = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` }
  }

  const mergeDateTime = (date: string, time: string) => {
    if (!date) return ''
    return `${date}T${time}`
  }

  const getTomorrowDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  // Computed fee values
  const prizePaise = rupeesToPaise(formData.prize_amount_inr)
  const platformFee = calcPlatformFee(prizePaise)
  const totalCharged = calcTotal(prizePaise)

  // --- VALIDATION ---
  const validateStep1 = (): boolean => {
    if (!formData.category) {
      toast.error('Please select a category')
      return false
    }
    if (formData.public_summary.length < 20 || formData.public_summary.length > 200) {
      toast.error('Public description must be between 20 and 200 characters')
      return false
    }
    if (formData.title.length < 10 || formData.title.length > 100) {
      toast.error('Title must be between 10 and 100 characters')
      return false
    }
    if (formData.description.length < 50) {
      toast.error('Description must be at least 50 characters')
      return false
    }
    if (!formData.ai_policy) {
      toast.error('Please select an AI usage policy')
      return false
    }
    return true
  }

  const validateStep2 = (): boolean => {
    // Materials validation
    for (const m of formData.materials) {
      if (!m.label.trim()) {
        toast.error('Please enter a label for all materials')
        return false
      }
      if (!m.content.trim()) {
        toast.error('Please enter content or a URL for all materials')
        return false
      }
      if (m.type === 'link') {
        if (!m.content.startsWith('http://') && !m.content.startsWith('https://')) {
          toast.error('Please enter a valid URL starting with http:// or https://')
          return false
        }
      }
    }
    return true
  }

  const validateStep3 = (): boolean => {
    if (formData.prize_amount_inr < MIN_PRIZE_INR) {
      toast.error(`Minimum prize is ${formatINR(rupeesToPaise(MIN_PRIZE_INR))}`)
      return false
    }
    if (formData.prize_amount_inr > MAX_PRIZE_INR) {
      toast.error(`Maximum prize is ${formatINR(rupeesToPaise(MAX_PRIZE_INR))}`)
      return false
    }
    if (formData.max_entries < MIN_ENTRIES || formData.max_entries > MAX_ENTRIES) {
      toast.error(`Entries must be between ${MIN_ENTRIES} and ${MAX_ENTRIES}`)
      return false
    }
    if (!formData.deadline || new Date(formData.deadline).getTime() <= Date.now()) {
      toast.error('Deadline must be a future date')
      return false
    }
    return true
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      captureAnalyticsEvent('contest_creation_step_completed', {
        step: 1,
        category: formData.category,
      })
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      captureAnalyticsEvent('contest_creation_step_completed', {
        step: 2,
        category: formData.category,
      })
      setStep(3)
    } else if (step === 3 && validateStep3()) {
      captureAnalyticsEvent('contest_creation_step_completed', {
        step: 3,
        category: formData.category,
      })
      setStep(4)
    }
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  // --- PAYMENT ---
  async function handlePayment() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/contests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(draftContestId ? { resume_contest_id: draftContestId } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create contest')
      }
      const { contest_id, order_id, amount, key } = await res.json()
      if (typeof contest_id !== 'string') {
        throw new Error('Payment draft could not be identified')
      }
      setDraftContestId(contest_id)

      localStorage.setItem(
        'contestic_contest_draft',
        JSON.stringify({
          formData,
          step,
          timestamp: Date.now(),
          contestId: contest_id,
        })
      )

      // Load Razorpay checkout script if not already loaded
      await new Promise<void>((resolve, reject) => {
        if (window.Razorpay) return resolve()
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.body.appendChild(script)
      })

      const rzp = new window.Razorpay({
        key,
        amount,
        currency: 'INR',
        name: 'Contestic',
        description: formData.title,
        order_id,
        handler: async function (response) {
          try {
            const verification = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            if (!verification.ok) {
              throw new Error('Payment verification failed')
            }

            captureAnalyticsEvent('contest_payment_verified', {
              contest_id,
              category: formData.category,
              prize_amount_inr: formData.prize_amount_inr,
            })
            localStorage.removeItem('contestic_contest_draft')
            toast.success('Payment verified! Contest going live...')
            setTimeout(() => router.push('/dashboard/lister'), 2500)
          } catch {
            toast.error('Payment received but verification is pending. Please check your dashboard shortly.')
            setIsLoading(false)
          }
        },
        theme: { color: '#F59E0B' },
        modal: {
          ondismiss: () => {
            captureAnalyticsEvent('contest_checkout_dismissed', { contest_id })
            toast.error('Payment cancelled.')
            setIsLoading(false)
          },
        },
      })
      rzp.open()
      captureAnalyticsEvent('contest_checkout_opened', {
        contest_id,
        category: formData.category,
        prize_amount_inr: formData.prize_amount_inr,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Something went wrong'
      )
      setIsLoading(false)
    }
  }

  // --- STEP LABELS ---
  const stepLabel =
    step === 1
      ? 'Contest Basics'
      : step === 2
        ? 'Materials'
        : step === 3
          ? 'Rewards & Deadline'
          : 'Review & Pay'

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-container-padding-mobile py-8 font-sans md:px-container-padding-desktop md:py-12">
      {/* Progress Indicator */}
      <div className="mb-10 rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-primary">
            Step {step} of 4: {stepLabel}
          </span>
          <span className="text-xs font-medium text-secondary">
            {step === 1 ? '25% Complete' : step === 2 ? '50% Complete' : step === 3 ? '75% Complete' : '100% Complete'}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div 
            className="h-full bg-primary-container transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* ============ STEP 1: BASICS ============ */}
      {step === 1 && (
        <section className="space-y-8">
          <div>
            <h1 className="mb-2 font-heading text-3xl font-bold text-on-surface md:text-4xl">
              Start your creative contest
            </h1>
            <p className="text-base text-secondary">
              Select a category and define the scope of your draft.
            </p>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {/* Content Writing */}
            <button
              type="button"
              onClick={() => updateField('category', 'Content Writing')}
              className={`flex min-h-28 flex-col items-center justify-center rounded-xl border bg-white p-4 text-center transition-colors hover:border-indigo-300 ${
                formData.category === 'Content Writing'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <FileText className={`mb-2 h-6 w-6 transition-colors ${
                formData.category === 'Content Writing' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Content Writing</span>
            </button>

            {/* Naming */}
            <button
              type="button"
              onClick={() => updateField('category', 'Naming')}
              className={`flex min-h-28 flex-col items-center justify-center rounded-xl border bg-white p-4 text-center transition-colors hover:border-indigo-300 ${
                formData.category === 'Naming'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <Tag className={`mb-2 h-6 w-6 transition-colors ${
                formData.category === 'Naming' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Naming</span>
            </button>


            {/* Design */}
            <button
              type="button"
              onClick={() => updateField('category', 'Design')}
              className={`flex min-h-28 flex-col items-center justify-center rounded-xl border bg-white p-4 text-center transition-colors hover:border-indigo-300 ${
                formData.category === 'Design'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <Palette className={`mb-2 h-6 w-6 transition-colors ${
                formData.category === 'Design' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Design</span>
            </button>

            {/* Video Editing */}
            <button
              type="button"
              onClick={() => updateField('category', 'Video Editing')}
              className={`flex min-h-28 flex-col items-center justify-center rounded-xl border bg-white p-4 text-center transition-colors hover:border-indigo-300 ${
                formData.category === 'Video Editing'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <Video className={`mb-2 h-6 w-6 transition-colors ${
                formData.category === 'Video Editing' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Video Editing</span>
            </button>

            {/* Others */}
            <button
              type="button"
              onClick={() => updateField('category', 'Others')}
              className={`flex min-h-28 flex-col items-center justify-center rounded-xl border bg-white p-4 text-center transition-colors hover:border-indigo-300 ${
                formData.category === 'Others'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <LayoutGrid className={`mb-2 h-6 w-6 transition-colors ${
                formData.category === 'Others' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Others</span>
            </button>
          </div>

          {/* Helper for Others */}
          {formData.category === 'Others' && (
            <div className="bg-primary-container/10 border border-primary-container/20 rounded-lg p-4 max-w-2xl text-body-sm text-secondary">
              Since your category is custom, make sure your title and description clearly explain what type of work you need.
            </div>
          )}

          {/* Form Details */}
          <div className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-2">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Contest Title
              </label>
              <input
                type="text"
                placeholder="e.g. Brand Name for a Minimalist Furniture Store"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full p-4 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all outline-none"
              />
              <span className="text-xs text-secondary">
                {formData.title.length}/100 characters
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Public Description
              </label>
              <textarea
                placeholder="One-liner about what you need. E.g. Need a high-energy edit of our brand video — best edit wins ₹10,000"
                maxLength={200}
                rows={2}
                value={formData.public_summary}
                onChange={(e) => updateField('public_summary', e.target.value)}
                className="w-full p-4 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all resize-none outline-none"
              />
              <div className="flex justify-between text-xs text-secondary">
                <span>Min 20 characters</span>
                <span>{formData.public_summary.length}/200 characters</span>
              </div>
              <span className="text-xs text-secondary italic">
                This is the ONLY thing people see before entering. Keep it intriguing but don&apos;t reveal too much.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Describe your requirements in detail
              </label>
              <textarea
                placeholder="Give a brief description about your requirements and instructions"
                rows={6}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full p-4 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all resize-none outline-none"
              />
              <span className="text-xs text-secondary">
                {formData.description.length} characters
              </span>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <span className="text-amber-600 font-bold text-xs mt-px">NOTE:</span>
                <span className="text-xs text-amber-800">
                  Only visible to participants who have entered the contest after entry closes.
                </span>
              </div>
            </div>
          </div>

          {/* AI Policy Section */}
          <section className="pt-8 border-t border-outline-variant space-y-6">
            <h2 className="text-headline-sm font-heading font-bold text-on-surface">
              AI Allowance
            </h2>
            <div className="space-y-4 max-w-2xl">
              {/* Option 1 */}
              <button
                type="button"
                onClick={() => updateField('ai_policy', 'none')}
                className={`flex items-start text-left gap-4 p-4 border rounded-xl cursor-pointer w-full transition-colors ${
                  formData.ai_policy === 'none'
                    ? 'border-primary bg-surface-container-low'
                    : 'border-outline-variant hover:bg-surface-container-low/50'
                }`}
              >
                <input
                  type="radio"
                  name="ai_policy"
                  checked={formData.ai_policy === 'none'}
                  onChange={() => updateField('ai_policy', 'none')}
                  className="mt-1.5 text-primary focus:ring-primary cursor-pointer shrink-0"
                />
                <div>
                  <span className="block text-body-md font-bold mb-1 text-on-surface">
                    NONE
                  </span>
                  <span className="block text-body-sm text-secondary">
                    Strictly no AI-generated content allowed. (user may be disqualified by the lister if entire content is AI-generated)
                  </span>
                </div>
              </button>

              {/* Option 2 */}
              <button
                type="button"
                onClick={() => updateField('ai_policy', 'partial')}
                className={`flex items-start text-left gap-4 p-4 border rounded-xl cursor-pointer w-full transition-colors ${
                  formData.ai_policy === 'partial'
                    ? 'border-primary bg-surface-container-low'
                    : 'border-outline-variant hover:bg-surface-container-low/50'
                }`}
              >
                <input
                  type="radio"
                  name="ai_policy"
                  checked={formData.ai_policy === 'partial'}
                  onChange={() => updateField('ai_policy', 'partial')}
                  className="mt-1.5 text-primary focus:ring-primary cursor-pointer shrink-0"
                />
                <div>
                  <span className="block text-body-md font-bold mb-1 text-on-surface">
                    Moderate
                  </span>
                  <span className="block text-body-sm text-secondary">
                    AI can be used but there must be a human touch.
                  </span>
                </div>
              </button>

              {/* Option 3 */}
              <button
                type="button"
                onClick={() => updateField('ai_policy', 'allowed')}
                className={`flex items-start text-left gap-4 p-4 border rounded-xl cursor-pointer w-full transition-colors ${
                  formData.ai_policy === 'allowed'
                    ? 'border-primary bg-surface-container-low'
                    : 'border-outline-variant hover:bg-surface-container-low/50'
                }`}
              >
                <input
                  type="radio"
                  name="ai_policy"
                  checked={formData.ai_policy === 'allowed'}
                  onChange={() => updateField('ai_policy', 'allowed')}
                  className="mt-1.5 text-primary focus:ring-primary cursor-pointer shrink-0"
                />
                <div>
                  <span className="block text-body-md font-bold mb-1 text-on-surface">
                    NO restriction
                  </span>
                  <span className="block text-body-sm text-secondary">
                    Creators are free to use any tools, including generative AI, to achieve the best result.
                  </span>
                </div>
              </button>
            </div>
          </section>
        </section>
      )}

      {/* ============ STEP 2: MATERIALS FOR PARTICIPANTS ============ */}
      {step === 2 && (
        <section className="space-y-8">
          <div>
            <h1 className="mb-2 font-heading text-3xl font-bold text-on-surface md:text-4xl">
              Materials for Participants
            </h1>
            <p className="text-base text-secondary">
              Add raw files, reference links, or detailed instructions.
            </p>
          </div>

          <div className="bg-primary-container/5 border border-primary-container/20 rounded-xl p-6">
            <p className="text-body-sm text-primary font-medium">
              These materials are ONLY shown to participants AFTER the entry period closes. Add raw files, reference links, or detailed instructions.
            </p>
          </div>

          <div className="space-y-6 max-w-3xl">
            {formData.materials.map((material, idx) => (
              <div 
                key={idx}
                className="p-6 border border-outline-variant bg-surface-container-lowest rounded-xl relative space-y-4"
              >
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => {
                    const next = [...formData.materials]
                    next.splice(idx, 1)
                    updateField('materials', next)
                  }}
                  className="absolute top-4 right-4 text-secondary hover:text-red-500 transition-colors cursor-pointer"
                  title="Remove Material"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex flex-col gap-4">
                  {/* Label Input */}
                  <div className="flex flex-col gap-2">
                    <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                      Label / Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Raw Footage - Scene 1"
                      value={material.label}
                      onChange={(e) => {
                        const next = [...formData.materials]
                        next[idx].label = e.target.value
                        updateField('materials', next)
                      }}
                      className="w-full p-2 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all outline-none"
                    />
                  </div>

                  {/* Content Input */}
                  <div className="flex flex-col gap-2">
                    <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                      Resource URL / Content
                    </label>
                    <textarea
                      placeholder="https://drive.google.com/... or any detailed instructions..."
                      rows={3}
                      value={material.content}
                      onChange={(e) => {
                        const next = [...formData.materials]
                        next[idx].content = e.target.value
                        updateField('materials', next)
                      }}
                      className="w-full p-3 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all resize-none outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            {formData.materials.length < 10 && (
              <button
                type="button"
                onClick={() => {
                  const next = [...formData.materials, { type: 'link' as const, label: '', content: '' }]
                  updateField('materials', next)
                }}
                className="w-full py-4 border border-dashed border-outline-variant hover:border-primary rounded-xl flex items-center justify-center gap-2 text-secondary hover:text-primary transition-all cursor-pointer font-bold text-body-sm bg-surface-container-lowest"
              >
                + Add Material
              </button>
            )}

            <div className="pt-4 border-t border-outline-variant/30 text-center">
              <p className="text-body-sm text-secondary">
                No materials? That&apos;s fine &mdash; participants will just receive your full brief description after entry closes.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============ STEP 3: REWARDS & DEADLINE ============ */}
      {step === 3 && (
        <section className="space-y-8">
          <div>
            <h1 className="mb-2 font-heading text-3xl font-bold text-on-surface md:text-4xl">
              Set your rewards and deadline
            </h1>
            <p className="text-base text-secondary">
              Define the prize pool, maximum entries, and contest timeline.
            </p>
          </div>

          <div className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm md:p-6">
            {/* Prize Amount */}
            <div className="flex flex-col gap-2">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Prize Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary font-mono font-bold">
                  &#8377;
                </span>
                <input
                  type="number"
                  min={MIN_PRIZE_INR}
                  max={MAX_PRIZE_INR}
                  placeholder={`Min ${MIN_PRIZE_INR}`}
                  value={formData.prize_amount_inr || ''}
                  onChange={(e) =>
                    updateField('prize_amount_inr', Number(e.target.value))
                  }
                  className="w-full p-4 pl-10 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all outline-none font-mono"
                />
              </div>
              <span className="text-xs text-secondary">
                Minimum {formatINR(rupeesToPaise(MIN_PRIZE_INR))} &mdash; Maximum {formatINR(rupeesToPaise(MAX_PRIZE_INR))}
              </span>
            </div>

            {/* Fee Breakdown */}
            {formData.prize_amount_inr > 0 && (
              <div className="bg-surface-container-low border border-outline-variant rounded-lg p-6 space-y-3">
                <div className="flex justify-between text-body-sm">
                  <span className="text-secondary">Prize Pool</span>
                  <span className="font-mono font-bold text-on-surface">
                    {formatINR(prizePaise)}
                  </span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-secondary">Contestic platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                  <span className="font-mono font-bold text-on-surface">
                    {formatINR(platformFee)}
                  </span>
                </div>
                <div className="border-t border-outline-variant pt-3 flex justify-between text-body-md font-bold">
                  <span className="text-on-surface">Total Charged</span>
                  <span className="font-mono text-primary-container">
                    {formatINR(totalCharged)}
                  </span>
                </div>
                <p className="text-xs leading-5 text-secondary">
                  Covers platform operations, secure payment processing, and contest administration.
                </p>
              </div>
            )}

            {/* Max Entries */}
            <div className="flex flex-col gap-2">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Maximum Entries
              </label>
              <input
                type="number"
                min={MIN_ENTRIES}
                max={MAX_ENTRIES}
                value={formData.max_entries}
                onChange={(e) =>
                  updateField('max_entries', Number(e.target.value))
                }
                className="w-full p-4 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all outline-none font-mono"
              />
              <span className="text-xs text-secondary">
                Between {MIN_ENTRIES} and {MAX_ENTRIES} submissions
              </span>
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-2">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Contest Deadline
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                  <input
                    type="date"
                    value={splitDateTime(formData.deadline).date}
                    onChange={(e) => {
                      const time = splitDateTime(formData.deadline).time
                      updateField('deadline', mergeDateTime(e.target.value, time))
                    }}
                    min={getTomorrowDate()}
                    className="w-full p-4 pl-11 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all outline-none"
                  />
                </div>
                <div className="relative w-40">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                  <select
                    value={splitDateTime(formData.deadline).time}
                    onChange={(e) => {
                      const date = splitDateTime(formData.deadline).date
                      if (date) updateField('deadline', mergeDateTime(date, e.target.value))
                    }}
                    className="w-full p-4 pl-11 bg-transparent border border-outline-variant rounded-lg focus:outline-none focus:border-primary-container font-body-md transition-all outline-none appearance-none cursor-pointer"
                  >
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <span className="text-xs text-secondary">
                Pick a date and time for submissions to close
              </span>
            </div>

            {/* Entry Window Section */}
            <div className="pt-6 border-t border-outline-variant space-y-4">
              <label className="text-label-caps uppercase tracking-widest text-secondary font-bold text-xs">
                Entry Window
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => updateField('entry_window_hours', 24)}
                  className={`flex-1 py-4 border rounded-xl font-heading font-bold text-center cursor-pointer transition-all hover:bg-surface-container-low ${
                    formData.entry_window_hours === 24
                      ? 'border-primary bg-surface-container-low text-primary ring-1 ring-primary'
                      : 'border-outline-variant bg-transparent text-secondary'
                  }`}
                >
                  24 Hours
                </button>
                <button
                  type="button"
                  onClick={() => updateField('entry_window_hours', 48)}
                  className={`flex-1 py-4 border rounded-xl font-heading font-bold text-center cursor-pointer transition-all hover:bg-surface-container-low ${
                    formData.entry_window_hours === 48
                      ? 'border-primary bg-surface-container-low text-primary ring-1 ring-primary'
                      : 'border-outline-variant bg-transparent text-secondary'
                  }`}
                >
                  48 Hours
                </button>
              </div>
              <p className="text-xs text-secondary">
                How long people have to register before the brief and materials are revealed. Entry deadline is auto-set when your contest goes live.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============ STEP 4: REVIEW & PAY ============ */}
      {step === 4 && (
        <section className="space-y-8">
          <div>
            <h1 className="mb-2 font-heading text-3xl font-bold text-on-surface md:text-4xl">
              Review and pay
            </h1>
            <p className="text-base text-secondary">
              Confirm the contest setup and payment amount before opening Razorpay Checkout.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-md">
            <div className="flex flex-col gap-4 border-b border-outline-variant bg-gray-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold text-on-surface">Payment summary</h2>
                  <p className="text-sm text-secondary">Your contest goes live after payment is confirmed.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Razorpay secure checkout
              </div>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_330px]">
              <div className="p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Contest</p>
                <h3 className="mt-2 font-heading text-2xl font-bold leading-snug text-on-surface">{formData.title}</h3>
                <span className="mt-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{formData.category}</span>

                <dl className="mt-7 grid gap-5 border-t border-outline-variant pt-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-secondary">AI allowance</dt>
                    <dd className="mt-1 text-sm font-semibold text-on-surface">
                      {formData.ai_policy === 'none' ? 'Not allowed' : formData.ai_policy === 'partial' ? 'Limited use' : 'Allowed'}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-secondary"><Users className="h-3.5 w-3.5" aria-hidden="true" />Maximum entries</dt>
                    <dd className="mt-1 text-sm font-semibold text-on-surface">{formData.max_entries}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-secondary">Entry period</dt>
                    <dd className="mt-1 text-sm font-semibold text-on-surface">{formData.entry_window_hours} hours after launch</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-secondary">Submission deadline</dt>
                    <dd className="mt-1 text-sm font-semibold text-on-surface">
                      {formData.deadline
                        ? new Date(formData.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Not set'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-secondary">Participant materials</dt>
                    <dd className="mt-1 text-sm font-semibold text-on-surface">
                      {formData.materials.length === 0
                        ? 'No additional materials'
                        : `${formData.materials.length} ${formData.materials.length === 1 ? 'material' : 'materials'}, revealed after entry closes`}
                    </dd>
                  </div>
                </dl>
              </div>

              <aside className="border-t border-outline-variant bg-[#F8F7FF] p-6 md:p-8 lg:border-l lg:border-t-0">
                <h3 className="font-heading text-lg font-bold text-on-surface">Amount due</h3>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-secondary">Winner prize</span>
                    <span className="font-mono font-semibold text-on-surface">{formatINR(prizePaise)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-secondary">Contestic platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                    <span className="font-mono font-semibold text-on-surface">{formatINR(platformFee)}</span>
                  </div>
                  <div className="border-t border-indigo-100 pt-4">
                    <div className="flex items-end justify-between gap-4">
                      <span className="font-semibold text-on-surface">Total payment</span>
                      <span className="font-mono text-2xl font-bold text-indigo-700">{formatINR(totalCharged)}</span>
                    </div>
                  </div>
                </div>
                <p className="mt-6 rounded-lg border border-indigo-100 bg-white/70 p-3 text-xs leading-5 text-secondary">
                  The platform fee covers platform operations, secure payment processing, and contest administration. This setup is saved as a draft for up to two days. Once payment is confirmed and the contest is live, it cannot be cancelled.
                </p>
              </aside>
            </div>
          </div>
        </section>
      )}

      {/* Navigation Buttons */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex items-center justify-between border-t border-outline-variant bg-white/95 px-4 py-4 backdrop-blur-sm md:static md:mx-0 md:bg-transparent md:px-0 md:pt-6 md:backdrop-blur-none">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant bg-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50 md:px-8"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : (
          <div />
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="min-h-11 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 md:px-10"
          >
            {step === 1 ? 'Continue to Materials' : step === 2 ? 'Continue to Rewards' : 'Review & Pay'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePayment}
            disabled={isLoading}
            className="min-h-11 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 md:px-10"
          >
            {isLoading ? 'Processing...' : `Pay ${formatINR(totalCharged)}`}
          </button>
        )}
      </div>
    </main>
  )
}
