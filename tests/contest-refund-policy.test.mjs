import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRefundZeroEntryContest } from '../src/lib/contest-refund-policy.ts'

const now = new Date('2030-01-02T00:00:00.000Z')

test('refunds a zero-entry contest once its entry period has closed', () => {
  assert.equal(
    shouldRefundZeroEntryContest({
      entryDeadline: '2030-01-01T23:59:59.000Z',
      entryCount: 0,
      now,
    }),
    true
  )
})

test('does not refund before the entry period closes', () => {
  assert.equal(
    shouldRefundZeroEntryContest({
      entryDeadline: '2030-01-02T00:00:01.000Z',
      entryCount: 0,
      now,
    }),
    false
  )
})

test('does not refund a contest that has an entrant', () => {
  assert.equal(
    shouldRefundZeroEntryContest({
      entryDeadline: '2030-01-01T23:59:59.000Z',
      entryCount: 1,
      now,
    }),
    false
  )
})
