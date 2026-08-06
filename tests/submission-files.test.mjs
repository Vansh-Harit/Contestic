import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attachmentObjectKey,
  normalizeSubmissionAttachments,
  submissionDownloadPath,
} from '../src/lib/submission-files.ts'

const contestId = '00000000-0000-4000-8000-000000000001'
const contestantId = '00000000-0000-4000-8000-000000000002'
const key = `submissions/${contestId}/${contestantId}/work.png`

test('normalizes uploads to an authorized local download path', () => {
  const [attachment] = normalizeSubmissionAttachments(
    contestId,
    contestantId,
    [
      {
        type: 'upload',
        key,
        url: 'https://attacker.invalid/file.png',
        filename: 'work.png',
        size_bytes: 1024,
      },
    ]
  )

  assert.equal(attachment.key, key)
  assert.equal(attachment.url, submissionDownloadPath(contestId, key))
})

test('rejects another contestant or contest upload key', () => {
  assert.throws(
    () =>
      normalizeSubmissionAttachments(contestId, contestantId, [
        {
          type: 'upload',
          key: `submissions/${contestId}/another-user/work.png`,
          filename: 'work.png',
          size_bytes: 1024,
        },
      ]),
    /Invalid upload key/
  )
})

test('rejects excessive aggregate upload size', () => {
  assert.throws(
    () =>
      normalizeSubmissionAttachments(contestId, contestantId, [
        {
          type: 'upload',
          key: `${key}-1`,
          filename: 'one.png',
          size_bytes: 11 * 1024 * 1024,
        },
        {
          type: 'upload',
          key: `${key}-2`,
          filename: 'two.png',
          size_bytes: 10 * 1024 * 1024,
        },
      ]),
    /Total file size exceeds/
  )
})

test('accepts HTTPS links and rejects non-HTTPS links', () => {
  const [link] = normalizeSubmissionAttachments(
    contestId,
    contestantId,
    [
      {
        type: 'drive_link',
        url: 'https://drive.google.com/file/example',
        filename: 'Drive file',
      },
    ]
  )
  assert.equal(link.url, 'https://drive.google.com/file/example')

  assert.throws(
    () =>
      normalizeSubmissionAttachments(contestId, contestantId, [
        {
          type: 'drive_link',
          url: 'http://drive.google.com/file/example',
          filename: 'Drive file',
        },
      ]),
    /must use HTTPS/
  )
})

test('extracts only keys from the configured legacy public origin', () => {
  assert.equal(
    attachmentObjectKey(
      { url: `https://files.example.com/${key}` },
      'https://files.example.com'
    ),
    key
  )
  assert.equal(
    attachmentObjectKey(
      { url: `https://attacker.invalid/${key}` },
      'https://files.example.com'
    ),
    null
  )
})
