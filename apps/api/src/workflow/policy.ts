export const workflowStages = ['extract', 'qualify', 'compliance', 'write', 'human_review'] as const;
export type WorkflowStage = (typeof workflowStages)[number];

export interface WorkflowFailure {
  statusCode?: number;
  message: string;
}

export function isTransientFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/status (408|429|500|502|503|504)\b/)?.[1];
  return Boolean(status);
}

export function shouldEscalateToHuman(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /status 401\b|status 403\b|must be configured|invalid|empty/i.test(message);
}

export async function withTransientRetries<T>(operation: () => Promise<T>, maxAttempts = 3, onAttempt?: (attempt: number) => void | Promise<void>): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    await onAttempt?.(attempt);
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientFailure(error)) throw error;
    }
  }
  throw new Error('Retry policy exhausted.');
}

export function hasTraceableExcerpt(pageText: string, excerpt: string): boolean {
  return excerpt.trim().length >= 10 && pageText.includes(excerpt.trim());
}

export function unreadablePageStatus(unreadablePages: number[]): 'ready' | 'needs_review' {
  return unreadablePages.length > 0 ? 'needs_review' : 'ready';
}

export function correctedContentOrOriginal(original: string, correction?: string): string {
  return correction?.trim() ? correction : original;
}