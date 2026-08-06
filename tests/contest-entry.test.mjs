import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateContestEntry } from '../src/lib/contest-entry.ts'

const baseInput = {
  userId: 'contestant',
  listerId: 'creator',
  status: 'active',
  entryDeadline: '2030-01-02T00:00:00.000Z',
  entryCount: 1,
  effectiveLimit: 5,
  alreadyEntered: false,
  now: new Date('2030-01-01T00:00:00.000Z'),
}

test('allows an authenticated non-creator during the open entry period', () => {
  assert.deepEqual(evaluateContestEntry(baseInput), { allowed: true })
})

test('rejects the contest creator', () => {
  assert.deepEqual(
    evaluateContestEntry({ ...baseInput, userId: 'creator' }),
    {
      allowed: false,
      status: 403,
      error: 'You cannot enter your own contest',
    }
  )
})

test('rejects duplicate entry', () => {
  assert.deepEqual(
    evaluateContestEntry({ ...baseInput, alreadyEntered: true }),
    {
      allowed: false,
      status: 409,
      error: 'You have already entered this contest',
    }
  )
})

test('rejects a contest after its entry deadline', () => {
  const decision = evaluateContestEntry({
    ...baseInput,
    now: new Date('2030-01-03T00:00:00.000Z'),
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.status, 400)
})

test('rejects a contest at its entry capacity', () => {
  const decision = evaluateContestEntry({
    ...baseInput,
    entryCount: 5,
  })

  assert.equal(decision.allowed, false)
  assert.equal(decision.status, 400)
})

test('rejects a contest that is not active', () => {
  assert.deepEqual(
    evaluateContestEntry({ ...baseInput, status: 'judging' }),
    {
      allowed: false,
      status: 400,
      error: 'Contest is not active',
    }
  )
})
