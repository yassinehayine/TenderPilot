# TenderPilot

TenderPilot is a hackathon project foundation for an intelligent tender response workspace. This repository currently contains the product shell and infrastructure scaffolding; the Agentic AI implementation is planned for the next development phase.

## Architecture

- `apps/web`: React, TypeScript, and Vite frontend shell.
- `apps/api`: Fastify and TypeScript backend with a readiness route.
- `packages/shared`: shared domain contracts used by both applications.
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

## Current status

The repository is ready for feature development. It does not yet implement document extraction, OCR, LLM calls, LangGraph workflows, RAG, qualification reasoning, proposal generation, compliance reasoning, or autonomous agent loops. Those capabilities belong to the next phase and will be added behind the current application boundaries.