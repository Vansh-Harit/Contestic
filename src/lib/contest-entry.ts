export interface ContestEntryEligibilityInput {
  userId: string
  listerId: string
  status: string
  entryDeadline: string | null
  entryCount: number
  effectiveLimit: number
  alreadyEntered: boolean
  now: Date
}

export type ContestEntryDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403 | 409; error: string }

export function evaluateContestEntry(
  input: ContestEntryEligibilityInput
): ContestEntryDecision {
  if (input.status !== 'active') {
    return { allowed: false, status: 400, error: 'Contest is not active' }
  }

  if (input.listerId === input.userId) {
    return {
      allowed: false,
      status: 403,
      error: 'You cannot enter your own contest',
    }
  }

  const deadlinePassed = input.entryDeadline
    ? input.now > new Date(input.entryDeadline)
    : false
  const entryFull = input.entryCount >= input.effectiveLimit

  if (deadlinePassed || entryFull) {
    return {
      allowed: false,
      status: 400,
      error: 'Entry period has closed for this contest',
    }
  }

  if (input.alreadyEntered) {
    return {
      allowed: false,
      status: 409,
      error: 'You have already entered this contest',
    }
  }

  return { allowed: true }
}
