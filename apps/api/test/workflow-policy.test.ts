import assert from 'node:assert/strict';
import test from 'node:test';
import {
  correctedContentOrOriginal,
  hasTraceableExcerpt,
  isTransientFailure,
  shouldEscalateToHuman,
  unreadablePageStatus,
  withTransientRetries
} from '../src/workflow/policy.js';

test('unreadable pages require human review', () => {
  assert.equal(unreadablePageStatus([]), 'ready');
  assert.equal(unreadablePageStatus([1, 4]), 'needs_review');
});

test('traceability requires a verbatim non-trivial excerpt', () => {
  assert.equal(hasTraceableExcerpt('Certification ISO requise page 47.', 'Certification ISO requise'), true);
  assert.equal(hasTraceableExcerpt('Certification ISO requise page 47.', 'Certification inventée'), false);
  assert.equal(hasTraceableExcerpt('short', 'short'), false);
});

test('missing or unauthorized LLM evidence escalates instead of retrying forever', () => {
  assert.equal(shouldEscalateToHuman(new Error('LLM request failed with status 401.')), true);
  assert.equal(shouldEscalateToHuman(new Error('LLM returned an empty extraction response.')), true);
  assert.equal(isTransientFailure(new Error('LLM request failed with status 401.')), false);
  assert.equal(isTransientFailure(new Error('LLM request failed with status 503.')), true);
});

test('transient failures retry with a bounded attempt count', async () => {
  let attempts = 0;
  const recordedAttempts: number[] = [];
  const value = await withTransientRetries(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('LLM request failed with status 503.');
    return 'ok';
  }, 3, (attempt) => { recordedAttempts.push(attempt); });
  assert.equal(value, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(recordedAttempts, [1, 2, 3]);
});

test('permanent failures are not retried', async () => {
  let attempts = 0;
  await assert.rejects(() => withTransientRetries(async () => {
    attempts += 1;
    throw new Error('LLM request failed with status 401.');
  }));
  assert.equal(attempts, 1);
});

test('human corrections remain preferred after reload', () => {
  assert.equal(correctedContentOrOriginal('Generated content', 'Human correction'), 'Human correction');
  assert.equal(correctedContentOrOriginal('Generated content', '  '), 'Generated content');
});