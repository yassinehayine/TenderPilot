import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const repositoryRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
loadEnv({ path: resolve(repositoryRoot, '.env') });

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://tenderpilot:tenderpilot@localhost:5432/tenderpilot',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  llmUrl: process.env.LLM_URL ?? '',
  llmApiKey: process.env.LLM_API_KEY ?? '',
  llmModel: process.env.LLM_MODEL ?? 'gpt-5.5',
  azureApiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
  azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
  azureApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview',
  azureDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-4.1',
  uploadDirectory: resolve(repositoryRoot, process.env.UPLOAD_DIRECTORY ?? 'storage/uploads'),
  datasetDirectory: resolve(repositoryRoot, process.env.DATASET_DIRECTORY ?? 'data/tenderpilot/sujet-01-tenderpilot'),
  maxUploadBytes: 25 * 1024 * 1024
};