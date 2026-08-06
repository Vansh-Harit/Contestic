import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canAccessSubmissionFile,
  canSelectContestWinner,
  canUseContestChat,
  canViewPrivateContestContent,
  getAuthorizationStage,
} from '../src/lib/authorization.ts'

const base = {
  status: 'active',
  entryDeadline: '2030-01-02T00:00:00.000Z',
  deadline: '2030-01-03T00:00:00.000Z',
  entryCount: 1,
  entryLimit: 10,
  now: new Date('2030-01-01T00:00:00.000Z'),
}

test('resolves every contest lifecycle stage', () => {
  assert.equal(getAuthorizationStage({ ...base, status: 'draft' }), 'draft')
  assert.equal(getAuthorizationStage(base), 'entry_open')
  assert.equal(
    getAuthorizationStage({
      ...base,
      now: new Date('2030-01-02T00:00:00.000Z'),
    }),
    'submission_open'
  )
  assert.equal(
    getAuthorizationStage({ ...base, entryCount: 10 }),
    'submission_open'
  )
  assert.equal(
    getAuthorizationStage({ ...base, status: 'judging' }),
    'judging'
  )
  assert.equal(
    getAuthorizationStage({ ...base, status: 'completed' }),
    'completed'
  )
  assert.equal(
    getAuthorizationStage({ ...base, status: 'cancelled' }),
    'cancelled'
  )
})

test('private briefs and materials follow creator and entered-user stages', () => {
  const stages = [
    'draft',
    'entry_open',
    'submission_open',
    'judging',
    'completed',
    'cancelled',
  ]

  for (const stage of stages) {
    assert.equal(
      canViewPrivateContestContent({
        isCreator: true,
        hasEntered: false,
        stage,
      }),
      true
    )
    assert.equal(
      canViewPrivateContestContent({
        isCreator: false,
        hasEntered: false,
        stage,
      }),
      false
    )
  }

  assert.equal(
    canViewPrivateContestContent({
      isCreator: false,
      hasEntered: true,
      stage: 'entry_open',
    }),
    false
  )
  for (const stage of ['submission_open', 'judging', 'completed']) {
    assert.equal(
      canViewPrivateContestContent({
        isCreator: false,
        hasEntered: true,
        stage,
      }),
      true
    )
  }
})

test('chat is limited to creator/entered users before terminal stages', () => {
  for (const stage of ['entry_open', 'submission_open', 'judging']) {
    assert.equal(
      canUseContestChat({
        isCreator: true,
        hasEntered: false,
        stage,
      }),
      true
    )
    assert.equal(
      canUseContestChat({
        isCreator: false,
        hasEntered: true,
        stage,
      }),
      true
    )
    assert.equal(
      canUseContestChat({
        isCreator: false,
        hasEntered: false,
        stage,
      }),
      false
    )
  }

  for (const stage of ['draft', 'completed', 'cancelled']) {
    assert.equal(
      canUseContestChat({
        isCreator: true,
        hasEntered: false,
        stage,
      }),
      false
    )
  }
})

test('submission files are limited to owner/creator during submission and judging', () => {
  for (const stage of ['submission_open', 'judging']) {
    assert.equal(
      canAccessSubmissionFile({
        isCreator: true,
        ownsSubmission: false,
        stage,
      }),
      true
    )
    assert.equal(
      canAccessSubmissionFile({
        isCreator: false,
        ownsSubmission: true,
        stage,
      }),
      true
    )
    assert.equal(
      canAccessSubmissionFile({
        isCreator: false,
        ownsSubmission: false,
        stage,
      }),
      false
    )
  }

  for (const stage of ['draft', 'entry_open', 'completed', 'cancelled']) {
    assert.equal(
      canAccessSubmissionFile({
        isCreator: true,
        ownsSubmission: false,
        stage,
      }),
      false
    )
  }
})

test('only the creator can select a winner and only during judging', () => {
  for (const stage of [
    'draft',
    'entry_open',
    'submission_open',
    'completed',
    'cancelled',
  ]) {
    assert.equal(
      canSelectContestWinner({ isCreator: true, stage }),
      false
    )
  }
  assert.equal(
    canSelectContestWinner({ isCreator: false, stage: 'judging' }),
    false
  )
  assert.equal(
    canSelectContestWinner({ isCreator: true, stage: 'judging' }),
    true
  )
})
