import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contestDeadlineToIso,
  formatContestDeadlineInIndia,
  getLatestContestDeadlineDate,
  isContestDeadlineWithinLimit,
  splitContestDeadlineForIndia,
} from '../src/lib/contest-deadline.ts'

test('treats a timezone-less contest deadline as India time', () => {
  assert.equal(
    contestDeadlineToIso('2026-08-21T22:00'),
    '2026-08-21T16:30:00.000Z'
  )
})

test('preserves an already absolute deadline', () => {
  assert.equal(
    contestDeadlineToIso('2026-08-21T16:30:00.000Z'),
    '2026-08-21T16:30:00.000Z'
  )
})

test('loads an absolute deadline back into India date and time fields', () => {
  assert.deepEqual(
    splitContestDeadlineForIndia('2026-08-21T16:30:00.000Z'),
    { date: '2026-08-21', time: '22:00' }
  )
})

test('formats the review deadline explicitly in India time', () => {
  assert.match(
    formatContestDeadlineInIndia('2026-08-21T16:30:00.000Z'),
    /10:00 pm/i
  )
})

test('calculates the latest submission deadline date in India time', () => {
  assert.equal(
    getLatestContestDeadlineDate(new Date('2026-08-24T18:45:00.000Z')),
    '2026-09-15'
  )
})

test('allows any time on the twenty-first India calendar day', () => {
  const now = new Date('2026-08-24T18:45:00.000Z')

  assert.equal(isContestDeadlineWithinLimit('2026-09-15T23:30', now), true)
  assert.equal(isContestDeadlineWithinLimit('2026-09-16T00:00', now), false)
})
