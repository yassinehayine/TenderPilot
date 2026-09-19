import 'dotenv/config';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { config } from './config.js';
import { tenderRoutes } from './routes/tenders.js';

const app = Fastify({ logger: true });
await app.register(cors);
await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } });
app.get('/health', async () => ({ status: 'ok', service: 'tenderpilot-api' }));
await app.register(tenderRoutes);
await app.listen({ host: '0.0.0.0', port: config.port });