import { config } from '../config.js';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function completeJson(prompt: string): Promise<unknown> {
  if (!config.llmUrl || !config.llmApiKey) {
    throw new Error('LLM_URL and LLM_API_KEY must be configured for extraction.');
  }
  const endpoint = config.llmUrl.replace(/\/$/, '').endsWith('/chat/completions')
    ? config.llmUrl
    : `${config.llmUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.llmApiKey}`,
      'api-key': config.llmApiKey
    },
    body: JSON.stringify({
      model: config.llmModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You return only valid JSON. Never infer facts not present in the supplied document.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`LLM request failed with status ${response.status}.`);
  const payload = await response.json() as ChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned an empty extraction response.');
  return JSON.parse(content);
}