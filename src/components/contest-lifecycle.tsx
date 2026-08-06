import type { ContestPhase } from '@/lib/utils'
import { cn } from '@/lib/utils'

type DisplayPhase = ContestPhase | 'draft' | 'active'

const phaseMeta: Record<DisplayPhase, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
  active: { label: 'Active', className: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  entry_open: { label: 'Entry open', className: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  entry_closed: { label: 'Entry closed', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  submission_open: { label: 'Submission open', className: 'bg-violet-50 text-violet-700 ring-violet-100' },
  judging: { label: 'Judging', className: 'bg-amber-50 text-amber-800 ring-amber-100' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 ring-red-100' },
}

export function ContestStatusBadge({
  phase,
  className,
}: {
  phase: DisplayPhase
  className?: string
}) {
  const meta = phaseMeta[phase]

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}

const lifecycleSteps = [
  { key: 'entry_open', label: 'Entry' },
  { key: 'submission_open', label: 'Submission' },
  { key: 'judging', label: 'Judging' },
  { key: 'completed', label: 'Completed' },
] as const

export function ContestLifecycle({ phase }: { phase: ContestPhase }) {
  const activeIndex = phase === 'entry_open'
    ? 0
    : phase === 'entry_closed' || phase === 'submission_open'
      ? 1
      : phase === 'judging'
        ? 2
        : phase === 'completed'
          ? 3
          : -1

  if (phase === 'cancelled') {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        This contest has been cancelled.
      </div>
    )
  }

  return (
    <ol aria-label="Contest lifecycle" className="grid grid-cols-4 gap-2">
      {lifecycleSteps.map((step, index) => {
        const isCurrent = index === activeIndex
        const isPast = index < activeIndex

        return (
          <li key={step.key} className="relative min-w-0">
            <div
              className={cn(
                'mb-2 h-1.5 rounded-full',
                isPast || isCurrent ? 'bg-indigo-500' : 'bg-gray-200',
              )}
            />
            <span
              className={cn(
                'block truncate text-xs font-medium',
                isCurrent ? 'text-indigo-700' : isPast ? 'text-gray-700' : 'text-gray-400',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
