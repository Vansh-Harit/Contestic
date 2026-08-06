export type ContestStage =
  | 'draft'
  | 'entry_open'
  | 'submission_open'
  | 'judging'
  | 'completed'
  | 'cancelled'

export interface ContestStageInput {
  status: string
  entryDeadline: string | null
  deadline: string
  entryCount: number
  entryLimit: number
  now?: Date
}

export function getAuthorizationStage(input: ContestStageInput): ContestStage {
  if (input.status === 'draft') return 'draft'
  if (input.status === 'completed') return 'completed'
  if (input.status === 'cancelled') return 'cancelled'
  if (input.status === 'judging') return 'judging'

  const now = input.now ?? new Date()
  if (new Date(input.deadline) <= now) return 'judging'

  const entryClosed =
    (input.entryDeadline !== null &&
      new Date(input.entryDeadline) <= now) ||
    input.entryCount >= input.entryLimit

  return entryClosed ? 'submission_open' : 'entry_open'
}

export function canViewPrivateContestContent(input: {
  isCreator: boolean
  hasEntered: boolean
  stage: ContestStage
}): boolean {
  if (input.isCreator) return true
  if (!input.hasEntered) return false

  return (
    input.stage === 'submission_open' ||
    input.stage === 'judging' ||
    input.stage === 'completed'
  )
}

export function canUseContestChat(input: {
  isCreator: boolean
  hasEntered: boolean
  stage: ContestStage
}): boolean {
  if (!input.isCreator && !input.hasEntered) return false

  return (
    input.stage === 'entry_open' ||
    input.stage === 'submission_open' ||
    input.stage === 'judging'
  )
}

export function canAccessSubmissionFile(input: {
  isCreator: boolean
  ownsSubmission: boolean
  stage: ContestStage
}): boolean {
  if (!input.isCreator && !input.ownsSubmission) return false

  return (
    input.stage === 'submission_open' ||
    input.stage === 'judging'
  )
}

export function canSelectContestWinner(input: {
  isCreator: boolean
  stage: ContestStage
}): boolean {
  return input.isCreator && input.stage === 'judging'
}
