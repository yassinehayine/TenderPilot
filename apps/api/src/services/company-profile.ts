import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.js';

interface CsvRow { [key: string]: string; }

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"' && content[index + 1] === '"' && quoted) { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && content[index + 1] === '\n') index += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...data] = rows;
  return data.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries((header ?? []).map((key, index) => [key, values[index] ?? ''])));
}

export async function loadCompanyProfile() {
  const profile = JSON.parse(await readFile(join(config.datasetDirectory, 'profil-entreprise.json'), 'utf8')) as Record<string, unknown>;
  const references = parseCsv(await readFile(join(config.datasetDirectory, 'references.csv'), 'utf8'));
  const team = parseCsv(await readFile(join(config.datasetDirectory, 'equipe.csv'), 'utf8'));
  const attestations = (await readdir(join(config.datasetDirectory, 'attestations'))).filter((name) => name.endsWith('.pdf')).sort();
  const previousProposals = (await readdir(join(config.datasetDirectory, 'offres-passees'))).filter((name) => name.endsWith('.pdf')).sort();
  return {
    ...profile,
    references,
    equipe: team,
    attestations_documents: attestations,
    offres_passees: previousProposals,
    datasetSource: 'sujet-01-tenderpilot'
  };
}