import { config } from '../config.js';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function completeJson(prompt: string, model = config.llmModel): Promise<unknown> {
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
      authorization: `Bearer ${config.llmApiKey}`
    },
    body: JSON.stringify({
      model,
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

export async function completeAzureJson(prompt: string, _ignoredModel?: string): Promise<unknown> {
  void _ignoredModel;
  if (!config.azureEndpoint || !config.azureApiKey || !config.azureDeploymentName) {
    throw new Error('Azure GPT-4.1 configuration is incomplete.');
  }
  const endpoint = `${config.azureEndpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(config.azureDeploymentName)}/chat/completions?api-version=${encodeURIComponent(config.azureApiVersion)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': config.azureApiKey },
    body: JSON.stringify({
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You return only valid JSON. Never infer facts not present in the supplied document.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`Azure GPT-4.1 request failed with status ${response.status}.`);
  const payload = await response.json() as ChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Azure GPT-4.1 returned an empty response.');
  return JSON.parse(content);
}