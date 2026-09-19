import assert from 'node:assert/strict';
import test from 'node:test';
import { humanReviewStage, nextStage, persistedStageLabels } from '../src/agents/orchestrator/orchestrator.js';
import { workflowStages } from '../src/workflow/policy.js';

test('the orchestrator sequences extract -> qualify -> compliance -> write -> human_review', () => {
  assert.deepEqual([...workflowStages], ['extract', 'qualify', 'compliance', 'write', 'human_review']);
  assert.equal(nextStage('extract'), 'qualify');
  assert.equal(nextStage('qualify'), 'compliance');
  assert.equal(nextStage('compliance'), 'write');
  assert.equal(nextStage('write'), 'human_review');
});

test('human_review is terminal', () => {
  assert.equal(nextStage('human_review'), humanReviewStage);
  assert.equal(humanReviewStage, 'human_review');
});

test('every stage has a persisted label the execution panel understands', () => {
  for (const stage of workflowStages) {
    assert.equal(typeof persistedStageLabels[stage], 'string');
    assert.ok(persistedStageLabels[stage].length > 0);
  }
  // The UI maps this finer-grained label back onto the extract stage.
  assert.equal(persistedStageLabels.extract, 'extracting_requirements');
  assert.equal(persistedStageLabels.human_review, 'human_review');
});
