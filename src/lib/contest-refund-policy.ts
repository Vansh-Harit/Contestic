export function shouldRefundZeroEntryContest(input: {
  entryDeadline: string | null
  entryCount: number | null
  now: Date
}): boolean {
  if (!input.entryDeadline || (input.entryCount ?? 0) !== 0) return false

  const entryDeadline = new Date(input.entryDeadline)
  return !Number.isNaN(entryDeadline.getTime()) && entryDeadline <= input.now
}
