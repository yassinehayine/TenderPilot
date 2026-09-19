import type { RequirementType, TenderRequirement } from '@tenderpilot/shared';
import { completeJson } from '../../services/llm-client.js';
import { hasTraceableExcerpt } from '../../workflow/policy.js';

const requirementTypes = new Set<RequirementType>(['obligatoire', 'optionnelle', 'éliminatoire']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function extractRequirements(pages: Array<{ page: number; text: string }>): Promise<Array<Omit<TenderRequirement, 'id' | 'tenderId'>>> {
  const source = pages.filter((page) => page.text.length >= 20).map((page) => `PAGE ${page.page}\n${page.text}`).join('\n\n');
  const response = await completeJson(`Extract every explicit tender requirement from the source below. Return exactly {"requirements": []}. Each item must contain title, type (one of obligatoire, optionnelle, éliminatoire), sourcePage (integer), sourceExcerpt (verbatim excerpt from the same page, max 500 characters), confidence (number 0 to 1), and status "unknown". Do not create a requirement without a supporting excerpt. Do not use pages absent from the source.\n\n${source}`);
  if (!isRecord(response) || !Array.isArray(response.requirements)) throw new Error('Extractor returned an invalid requirements payload.');
  const pageText = new Map(pages.map((page) => [page.page, page.text]));
  return response.requirements.flatMap((item) => {
    if (!isRecord(item) || typeof item.title !== 'string' || typeof item.sourcePage !== 'number' || typeof item.sourceExcerpt !== 'string') return [];
    const type = item.type;
    const excerpt = item.sourceExcerpt.trim();
    const sourcePageText = pageText.get(item.sourcePage);
    const confidence = typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0;
    if (!requirementTypes.has(type as RequirementType) || !sourcePageText || !hasTraceableExcerpt(sourcePageText, excerpt)) return [];
    return [{ title: item.title.trim(), type: type as RequirementType, status: 'unknown' as const, sourcePage: item.sourcePage, sourceExcerpt: excerpt, confidence }];
  });
}