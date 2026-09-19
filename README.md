# TenderPilot

TenderPilot is a hackathon MVP for an intelligent tender response workspace. It supports traceable tender extraction, qualification, technical proposal drafting, DOCX export, and human section review. OCR and full orchestration remain explicit follow-up work.

## Architecture

- `apps/web`: React, TypeScript, and Vite frontend shell.
- `apps/api`: Fastify and TypeScript backend with a readiness route.
- `packages/shared`: shared domain contracts used by both applications.
- `data/tenderpilot`: official Sujet 01 demo and test corpus.
- PostgreSQL: planned system of record for tender and review data.
- Redis: planned cache and job-state store.

## Project structure

```text
apps/
  api/       Fastify API
  web/       React/Vite application
packages/
  shared/    Shared TypeScript types
docs/        Project notes and architecture decisions
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop (for PostgreSQL and Redis)

## Environment

Copy `.env.example` to `.env` and set local values. `LLM_URL` and `LLM_API_KEY` are intentionally blank and must never be committed.

## Local setup

```bash
npm install
copy .env.example .env
docker compose up -d
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`.

## Development commands

```bash
npm run dev
npm run dev:api
npm run typecheck
npm run lint
npm run build
npm test
```

The API readiness endpoint is available at `http://localhost:3001/health`.

The Technical Proposal page generates grounded sections through the writer agent and exposes a DOCX download. Human Review saves section corrections and approval status in PostgreSQL.

## Current status

The repository currently implements EX-01 through EX-06 structurally, including explicit unreadable-page handling for EX-07. OCR for the two scanned official AOs, embeddings/RAG, and a durable multi-stage orchestrator with retries/checkpoints are not implemented yet. No credentials are stored in the repository.