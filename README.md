# TenderPilot

TenderPilot is a tender response workspace for a Moroccan SME. It reads a public tender PDF,
extracts every requirement with its source page and a verbatim excerpt, decides Go / No-Go against
the official company profile, scores each requirement for compliance, drafts a technical proposal,
and hands the result to a human for correction and DOCX export.

Nothing is asserted without evidence: a requirement is persisted only when it is backed by a
verbatim excerpt from a readable page, and a requirement is marked compliant only when it matches a
named entry in the company profile.

## Architecture

- `apps/web`: React, TypeScript and Vite frontend.
- `apps/api`: Fastify and TypeScript backend, agents and workflow orchestration.
- `packages/shared`: domain contracts shared by both applications.
- `data/tenderpilot`: official Sujet 01 corpus (10 AO-2026 tenders, company profile, references,
  team, attestations, past proposals).
- `docs/`: cahier des charges, architecture notes and the MVP matrix.
- PostgreSQL: system of record for tenders, requirements, qualification, compliance and proposals.
- Redis: provisioned by `docker-compose.yml` and configured, but not yet used by the application.

## Agent workflow

The orchestrator (`apps/api/src/agents/orchestrator/`) owns the stage graph and drives every stage
through the same retry and escalation policy:

```
extract → qualify → compliance → write → human_review
```

| Stage | Agent | Model |
| --- | --- | --- |
| extract | `agents/extractor` | GPT-5.5 via `LLM_URL` + `LLM_API_KEY` |
| qualify | `agents/qualifier` | GPT-5.5 via `LLM_URL` + `LLM_API_KEY` |
| compliance | `agents/compliance` | **none** — deterministic, no model call |
| write | `agents/writer` | GPT-4.1 via `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` |
| human_review | — | a person |

The two providers are deliberately separate resources with separate credentials.

The compliance agent derives a verdict per requirement (`compliant`, `non_compliant`,
`missing_evidence`, `needs_review`) from data that is already persisted: the extracted
requirements, the qualification blockers and the company profile. Every `compliant` verdict names
the profile entry it matched; an unmatched requirement is never asserted compliant, and an
eliminatory requirement is never auto-cleared on a text match alone.

Each stage runs under a bounded retry policy (3 attempts, transient HTTP failures only). A
permanent failure or an exhausted budget sets the tender to `needs_review` at the `human_review`
stage instead of failing silently.

## Requirements coverage

| Requirement | Status | Where |
| --- | --- | --- |
| EX-01 Upload / fixture tender | Implemented | `POST /api/tenders`, `POST /api/tenders/fixtures/:filename` |
| EX-02 Typed compliance matrix | Implemented | extractor agent, `ComplianceMatrix.tsx` |
| EX-03 Source traceability | Implemented | `source_page` + verbatim `source_excerpt`, validated before persistence |
| EX-04 Go / No-Go | Implemented | qualifier agent, decision + fit score + justification + traceable blockers |
| EX-05 Technical proposal + DOCX | Implemented | writer agent, `GET /api/tenders/:id/proposal.docx` |
| EX-06 Human review | Implemented | corrections persisted and preferred over the draft on reload and in the DOCX |
| EX-07 Explicit failures | Implemented for unreadable pages | scanned pages detected, tender escalated to `needs_review`, **zero requirements fabricated** |

**Tender Risk & Evidence Radar** sits at the top of the compliance matrix: readiness counts,
evidence coverage, top blockers and priority actions. It is derived entirely in the frontend from
the compliance and qualification responses — no extra endpoint, no estimated metric.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop (PostgreSQL and Redis)
- Access to the two LLM deployments (GPT-5.5 and Azure GPT-4.1)

## Environment

Copy `.env.example` to `.env` and fill in the values. All credential fields ship empty and must
never be committed; `.env` is gitignored.

| Variable | Used for |
| --- | --- |
| `LLM_URL`, `LLM_API_KEY`, `LLM_MODEL` | GPT-5.5 — extraction and qualification |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT_NAME` | GPT-4.1 — proposal writer |
| `DATABASE_URL`, `REDIS_URL` | infrastructure |

## Local setup

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d
npm run db:migrate --workspace=@tenderpilot/api
```

The migration is required: it creates the schema and is idempotent, so it is safe to re-run.
Note that `npm run db:migrate` only exists in the API workspace, hence the `--workspace` flag.

Then start both applications in separate terminals:

```bash
npm run dev:api    # API on http://localhost:3001
npm run dev        # Web on http://localhost:5173
```

Open **http://localhost:5173**. Use `localhost`, not `127.0.0.1` — the Vite dev server binds IPv6.
The API readiness endpoint is `http://localhost:3001/health`.

## Using it

1. **Upload Tender** — pick `AO-2026-001` from the official dataset, or upload your own PDF.
   Extraction runs on the real document and takes roughly 45 seconds.
2. **Go / No-Go** — run the qualification. This also produces the compliance verdicts.
3. **Compliance Matrix** — the radar, per-requirement verdicts, search and verdict filters. Each row
   links to its source page in the original PDF.
4. **Technical Proposal** — generate the sections, each listing the evidence it used.
5. **Human Review** — edit a section, save the correction, download the DOCX.

`AO-2026-004` and `AO-2026-009` are scanned documents. They are detected as unreadable, escalated to
`needs_review`, and produce no requirements at all — this is the intended EX-07 behaviour, not a
failure.

## Development commands

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` runs 19 unit tests in the API workspace covering the compliance agent, the orchestrator
stage graph and the workflow policy.

## Current status and limitations

Implemented and verified end to end against the real dataset and the real models: EX-01 through
EX-07, the five-stage orchestration, bounded retries with human escalation, and the risk radar.

Not implemented — stated explicitly rather than implied:

- **No OCR.** Scanned tenders are detected and escalated, but their text is never recovered.
- **No embeddings or RAG.** An unused `embedding` column exists in the schema; no retrieval is wired.
- **The orchestrator is in-process and synchronous.** Stages run inside the HTTP request. There is
  no job queue and no checkpoint that survives a restart; Redis is provisioned but unused.
- **No compliance rerun after a human correction.** Corrections are persisted, but they do not
  re-trigger the compliance stage.
- **No tender list or deep link.** The UI holds one tender in memory; there is no route or endpoint
  to reopen a previously processed tender, so a reload starts over.
- **No authentication and no multi-tenancy.**
- **Automated tests are unit tests only.** The end-to-end runs in this repository were performed
  manually against the live API.

Requirement counts vary between runs because GPT-5.5 runs at its default temperature; the model
rejects `temperature: 0`.

No credentials are stored in the repository.
