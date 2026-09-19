import { markTenderNeedsReview, updateTenderStage } from '../../db/repository.js';
import { workflowStages, type WorkflowStage } from '../../workflow/policy.js';
import { withTransientRetries } from '../../workflow/policy.js';

/**
 * Workflow orchestrator.
 *
 * It owns the stage graph (extract -> qualify -> compliance -> write ->
 * human_review) and the transition rules. It does not reimplement retry or
 * escalation: it drives the existing workflow policy and repository helpers so
 * that every agent runs under the same attempt budget and the same human
 * escalation guarantee.
 */

export const humanReviewStage: WorkflowStage = 'human_review';

/**
 * The extract stage is persisted under a finer-grained label that the UI
 * already understands; keep it so the existing execution panel keeps working.
 */
export const persistedStageLabels: Record<WorkflowStage, string> = {
  extract: 'extracting_requirements',
  qualify: 'qualify',
  compliance: 'compliance',
  write: 'write',
  human_review: 'human_review'
};

export function nextStage(stage: WorkflowStage): WorkflowStage {
  const index = workflowStages.indexOf(stage);
  if (index < 0 || index >= workflowStages.length - 1) return humanReviewStage;
  return workflowStages[index + 1];
}

export interface StageOptions {
  /** Stage recorded once the operation succeeds. Defaults to the next stage in the sequence. */
  advanceTo?: WorkflowStage | null;
  maxAttempts?: number;
}

/**
 * Runs one workflow stage: records the transition, applies the bounded
 * transient-retry policy, advances to the following stage on success, and
 * escalates to human review on failure.
 */
export async function runStage<T>(
  tenderId: string,
  stage: WorkflowStage,
  operation: () => Promise<T>,
  options: StageOptions = {}
): Promise<T> {
  const label = persistedStageLabels[stage];
  const maxAttempts = options.maxAttempts ?? 3;
  try {
    const value = await withTransientRetries(
      operation,
      maxAttempts,
      (attempt) => updateTenderStage(tenderId, label, attempt).catch(() => undefined)
    );
    const advanceTo = options.advanceTo === undefined ? nextStage(stage) : options.advanceTo;
    if (advanceTo) await updateTenderStage(tenderId, persistedStageLabels[advanceTo], 1).catch(() => undefined);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : `Stage ${stage} failed.`;
    await markTenderNeedsReview(tenderId, persistedStageLabels[humanReviewStage], message).catch(() => undefined);
    throw error;
  }
}
