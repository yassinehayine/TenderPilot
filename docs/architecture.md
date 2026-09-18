# Architecture Notes

The first iteration keeps the boundaries deliberately small:

1. The web app owns presentation and future feature workflows.
2. The API owns HTTP boundaries and future orchestration.
3. Shared owns data contracts without business logic.
4. PostgreSQL and Redis run locally through Docker Compose.

Future agent modules are reserved under `apps/api/src/agents` for extraction, qualification, writing, compliance, and orchestration.