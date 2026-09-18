import 'dotenv/config';
import cors from '@fastify/cors';
import Fastify from 'fastify';

const app = Fastify({ logger: true });
await app.register(cors);
app.get('/health', async () => ({ status: 'ok', service: 'tenderpilot-api' }));
const port = Number(process.env.PORT ?? 3001);
await app.listen({ host: '0.0.0.0', port });