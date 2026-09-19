import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const directory = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(resolve(directory, 'schema.sql'), 'utf8');
const traceability = await readFile(resolve(directory, '002_traceability.sql'), 'utf8');
const client = await pool.connect();
try {
  await client.query(schema);
  await client.query(traceability);
  console.log('Database migrated.');
} finally {
  client.release();
  await pool.end();
}