'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Tag, PenTool, Palette, ChevronLeft, ChevronDown, Settings2, Calendar, Clock, X, LayoutGrid, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import { ContestFormData, ContestCategory, AIPolicy } from '@/lib/types'
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
} from '@/lib/constants'

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('load_draft') === 'true') {
      const saved = localStorage.getItem('contestic_contest_draft')
      if (saved) {
        try {
          const { formData: savedData, step: savedStep, timestamp } = JSON.parse(saved)
          // Check if less than 2 days old (2 * 24 * 60 * 60 * 1000 = 172800000 ms)
          if (Date.now() - timestamp < 172800000) {
            setFormData(savedData)
            setStep(savedStep)
            toast.success('Restored your draft in progress!', { position: 'top-center' })
          } else {
            localStorage.removeItem('contestic_contest_draft')
          }
        } catch (e) {
          console.error('Failed to parse draft', e)
        }
      }
    }
    setDraftLoaded(true)
  }, [])

  useEffect(() => {
    if (!draftLoaded) return

    // Save draft
    const draft = {
      formData,
      step,
      timestamp: Date.now()
    }
    localStorage.setItem('contestic_contest_draft', JSON.stringify(draft))
  }, [formData, step, draftLoaded])

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
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
    else if (step === 3 && validateStep3()) setStep(4)
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
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create contest')
      }
      const { contest_id, order_id, amount, key } = await res.json()

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
        handler: function () {
          localStorage.removeItem('contestic_contest_draft')
          toast.success('Payment successful! Contest going live...')
          setTimeout(() => router.push('/dashboard/lister'), 2500)
        },
        theme: { color: '#F59E0B' },
        modal: {
          ondismiss: () => {
            toast.error('Payment cancelled.')
            setIsLoading(false)
          },
        },
      })
      rzp.open()
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
    <main className="max-w-4xl mx-auto w-full px-container-padding-mobile md:px-container-padding-desktop py-12 flex-1 flex flex-col font-sans">
      {/* Progress Indicator */}
      <div className="mb-section-gap">
        <div className="flex justify-between items-center mb-4">
          <span className="font-label-caps text-label-caps text-primary uppercase font-bold tracking-wider text-xs">
            Step {step} of 4: {stepLabel}
          </span>
          <span className="font-label-caps text-label-caps text-secondary uppercase font-bold tracking-wider text-xs">
            {step === 1 ? '25% Complete' : step === 2 ? '50% Complete' : step === 3 ? '75% Complete' : '100% Complete'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary-container transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* ============ STEP 1: BASICS ============ */}
      {step === 1 && (
        <section className="space-y-12 animate-in fade-in duration-300">
          <div>
            <h1 className="text-headline-lg font-heading font-bold mb-3 text-on-surface">
              Start your creative contest
            </h1>
            <p className="text-body-lg text-secondary">
              Select a category and define the scope of your draft.
            </p>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-gutter">
            {/* Content Writing */}
            <button
              type="button"
              onClick={() => updateField('category', 'Content Writing')}
              className={`p-6 flex flex-col items-center justify-center text-center border rounded-xl transition-all hover:shadow-md cursor-pointer bg-surface-container-lowest ${
                formData.category === 'Content Writing'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <FileText className={`h-10 w-10 mb-4 transition-colors ${
                formData.category === 'Content Writing' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Content Writing</span>
            </button>

            {/* Naming */}
            <button
              type="button"
              onClick={() => updateField('category', 'Naming')}
              className={`p-6 flex flex-col items-center justify-center text-center border rounded-xl transition-all hover:shadow-md cursor-pointer bg-surface-container-lowest ${
                formData.category === 'Naming'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <Tag className={`h-10 w-10 mb-4 transition-colors ${
                formData.category === 'Naming' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Naming</span>
            </button>


            {/* Design */}
            <button
              type="button"
              onClick={() => updateField('category', 'Design')}
              className={`p-6 flex flex-col items-center justify-center text-center border rounded-xl transition-all hover:shadow-md cursor-pointer bg-surface-container-lowest ${
                formData.category === 'Design'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <Palette className={`h-10 w-10 mb-4 transition-colors ${
                formData.category === 'Design' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Design</span>
            </button>

            {/* Video Editing */}
            <button
              type="button"
              onClick={() => updateField('category', 'Video Editing')}
              className={`p-6 flex flex-col items-center justify-center text-center border rounded-xl transition-all hover:shadow-md cursor-pointer bg-surface-container-lowest ${
                formData.category === 'Video Editing'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <Video className={`h-10 w-10 mb-4 transition-colors ${
                formData.category === 'Video Editing' ? 'text-primary' : 'text-secondary'
              }`} />
              <span className="font-heading font-bold text-on-surface text-body-md">Video Editing</span>
            </button>

            {/* Others */}
            <button
              type="button"
              onClick={() => updateField('category', 'Others')}
              className={`p-6 flex flex-col items-center justify-center text-center border rounded-xl transition-all hover:shadow-md cursor-pointer bg-surface-container-lowest ${
                formData.category === 'Others'
                  ? 'border-primary-container ring-1 ring-primary-container'
                  : 'border-outline-variant'
              }`}
            >
              <LayoutGrid className={`h-10 w-10 mb-4 transition-colors ${
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
          <div className="space-y-8 max-w-2xl">
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
                This is the ONLY thing people see before entering. Keep it intriguing but don't reveal too much.
              </span>
            </div>
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
        <section className="space-y-8 animate-in fade-in duration-300">
          <div>
            <h1 className="text-headline-lg font-heading font-bold mb-3 text-on-surface">
              Materials for Participants
            </h1>
            <p className="text-body-lg text-secondary">
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
                No materials? That's fine &mdash; participants will just receive your full brief description after entry closes.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ============ STEP 3: REWARDS & DEADLINE ============ */}
      {step === 3 && (
        <section className="space-y-12 animate-in fade-in duration-300">
          <div>
            <h1 className="text-headline-lg font-heading font-bold mb-3 text-on-surface">
              Set your rewards and deadline
            </h1>
            <p className="text-body-lg text-secondary">
              Define the prize pool, maximum entries, and contest timeline.
            </p>
          </div>

          <div className="space-y-8 max-w-2xl">
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
                  <span className="text-secondary">Platform Fee (2.5%)</span>
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
        <section className="space-y-12 animate-in fade-in duration-300">
          <div>
            <h1 className="text-headline-lg font-heading font-bold mb-3 text-on-surface">
              Review and launch
            </h1>
            <p className="text-body-lg text-secondary">
              Verify all details before proceeding to payment.
            </p>
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 max-w-xl">
              <span className="text-amber-600 font-bold text-xs mt-px">NOTE:</span>
              <span className="text-xs text-amber-800">
                This will be saved as a draft for 2 days.
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
            {/* Summary rows */}
            <div className="divide-y divide-outline-variant">
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Category</span>
                <span className="font-bold text-on-surface">{formData.category}</span>
              </div>
              <div className="flex justify-between items-start px-8 py-5">
                <span className="text-secondary text-body-sm">Title</span>
                <span className="font-bold text-on-surface text-right max-w-sm">{formData.title}</span>
              </div>
              <div className="flex justify-between items-start px-8 py-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-secondary text-body-sm">Public Description</span>
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">What public sees</span>
                </div>
                <span className="text-on-surface text-body-sm text-right max-w-sm italic">
                  "{formData.public_summary}"
                </span>
              </div>

              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">AI Allowance</span>
                <span className="font-bold text-on-surface capitalize">{formData.ai_policy === 'none' ? 'None' : formData.ai_policy === 'partial' ? 'Moderate' : 'No restriction'}</span>
              </div>
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Prize Pool</span>
                <span className="font-mono font-bold text-on-surface">{formatINR(prizePaise)}</span>
              </div>
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Platform Fee</span>
                <span className="font-mono font-bold text-on-surface">{formatINR(platformFee)}</span>
              </div>
              <div className="flex justify-between items-center px-8 py-5 bg-surface-container-low">
                <span className="font-bold text-on-surface">Total to Pay</span>
                <span className="font-mono font-bold text-primary-container text-headline-sm">{formatINR(totalCharged)}</span>
              </div>
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Max Entries</span>
                <span className="font-mono font-bold text-on-surface">{formData.max_entries}</span>
              </div>
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Deadline</span>
                <span className="font-bold text-on-surface">
                  {formData.deadline
                    ? new Date(formData.deadline).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Entry Window</span>
                <span className="font-bold text-on-surface">{formData.entry_window_hours} hours</span>
              </div>
              <div className="flex justify-between items-center px-8 py-5">
                <span className="text-secondary text-body-sm">Materials Count</span>
                <span className="font-bold text-on-surface">
                  {formData.materials.length} {formData.materials.length === 1 ? 'material' : 'materials'} will be revealed after entry closes
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Navigation Buttons */}
      <div className="mt-section-gap flex items-center justify-between border-t border-outline-variant pt-8">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 px-8 py-3 border border-outline-variant rounded-lg font-body-md font-semibold hover:bg-surface-container-low transition-colors cursor-pointer bg-surface-container-lowest"
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
            className="px-12 py-3 bg-primary-container text-on-primary-container rounded-lg font-heading font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer text-body-md"
          >
            {step === 1 ? 'Continue to Materials' : step === 2 ? 'Continue to Rewards' : 'Review & Pay'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePayment}
            disabled={isLoading}
            className="px-12 py-3 bg-primary-container text-on-primary-container rounded-lg font-heading font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer text-body-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : `Pay ${formatINR(totalCharged)}`}
          </button>
        )}
      </div>
    </main>
  )
}
