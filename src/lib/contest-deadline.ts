const INDIA_TIME_ZONE = 'Asia/Kolkata'
const INDIA_UTC_OFFSET = '+05:30'
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/

export function parseContestDeadline(value: string): Date | null {
  const trimmed = value.trim()
  const localMatch = LOCAL_DATE_TIME.exec(trimmed)
  const normalized = localMatch
    ? `${localMatch[1]}T${localMatch[2]}:00${INDIA_UTC_OFFSET}`
    : trimmed
  const parsed = new Date(normalized)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function contestDeadlineToIso(value: string): string | null {
  return parseContestDeadline(value)?.toISOString() ?? null
}

export function splitContestDeadlineForIndia(value: string): {
  date: string
  time: string
} {
  if (!value) return { date: '', time: '12:00' }

  const localMatch = LOCAL_DATE_TIME.exec(value.trim())
  if (localMatch) {
    return { date: localMatch[1], time: localMatch[2] }
  }

  const parsed = parseContestDeadline(value)
  if (!parsed) return { date: '', time: '12:00' }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsed)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

export function getIndiaCalendarDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

export function formatContestDeadlineInIndia(value: string): string {
  const parsed = parseContestDeadline(value)
  if (!parsed) return 'Not set'

  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: INDIA_TIME_ZONE,
  })
}
