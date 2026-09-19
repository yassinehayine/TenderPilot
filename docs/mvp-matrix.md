# TenderPilot MVP Matrix

Source: `docs/Cahier-des-charges-Sujet-01-TenderPilot.pdf`.

Status reflects the implementation actually present on `main` and exercised against the real
dataset and the real models.

| Requirement | Status | Backend | Frontend | Data / tests |
| --- | --- | --- | --- | --- |
| EX-01 Upload and trigger | **Implemented** | Multipart upload and fixture endpoints, tender/document repository, processing status | Upload screen, official AO-2026 picker, status feedback | `tenders`, `tender_documents` |
| EX-02 Typed compliance matrix | **Implemented** | Page-aware extractor agent (GPT-5.5), typed requirement API | Compliance matrix with search and verdict filters | `tender_requirements`; obligatoire / optionnelle / éliminatoire |
| EX-03 Source traceability | **Implemented** | Verbatim excerpt validated against the source page before persistence; a requirement without a supporting excerpt is dropped | Every row shows its excerpt and links to its page in the original PDF | `source_page`, `source_excerpt`, `confidence`; `hasTraceableExcerpt` unit test |
| EX-04 Go / No-Go | **Implemented** | Qualifier agent (GPT-5.5), blocker persistence, result API | Decision, fit score, justification, traceable blockers | `qualification_results`, `qualification_blockers` |
| EX-05 Technical proposal | **Implemented** | Writer agent (Azure GPT-4.1), source references, DOCX export service | Section view with the evidence used and `[À COMPLÉTER]` placeholders surfaced | `proposal_sections`; DOCX verified to contain the persisted content |
| EX-06 Human review | **Implemented** | Review endpoint persisting corrected content and approval status | Section-by-section editor, save and approve, DOCX download | Correction survives reload and replaces the draft in the DOCX; `correctedContentOrOriginal` unit test |
| EX-07 Explicit failures | **Implemented for unreadable pages** | Unreadable-page detection, bounded retries, escalation to `needs_review` at the `human_review` stage | Scanned documents reported as "requires human intervention" with the affected pages | Scanned fixtures produce **zero** requirements and make no model call; retry and escalation unit tests |

EX-07 is complete for detection and escalation. **OCR is not implemented**, so the text of a
scanned tender is never recovered — the document is handed to a human instead.

## Orchestration

`apps/api/src/agents/orchestrator/` owns the stage graph and the transitions:

```
extract → qualify → compliance → write → human_review
```

It does not reimplement retry or escalation; it drives the existing workflow policy so every stage
runs under the same bounded attempt budget (3 attempts, transient failures only) and the same
guarantee that a permanent failure escalates to a human rather than failing silently.

The **compliance** stage is deterministic and makes no model call. It derives a verdict per
requirement — `compliant`, `non_compliant`, `missing_evidence`, `needs_review` — from the persisted
requirements, the qualification blockers and the company profile. Every `compliant` verdict names
the profile entry it matched. An unmatched requirement is never asserted compliant, and an
eliminatory requirement is never auto-cleared on a text match alone.

## Tender Risk & Evidence Radar

Sits at the top of the compliance matrix: readiness counts, evidence coverage, top blockers and
priority actions. Derived entirely in the frontend from the existing compliance and qualification
responses — no additional endpoint, no schema change, no estimated or generated metric. A tender
with no compliance report renders nothing rather than an empty frame.

## Tests

19 unit tests in `apps/api/test/`:

- `compliance-agent.test.ts` (10) — evidence index built only from profile facts, blocker severity
  mapping, no compliant verdict without evidence, eliminatory requirements never auto-cleared,
  traceability preserved, verdict mapping onto the persisted status contract.
- `orchestrator.test.ts` (3) — stage sequence, terminal stage, persisted stage labels.
- `workflow-policy.test.ts` (6) — unreadable pages, traceable excerpts, escalation vs retry,
  bounded retries, human corrections preferred after reload.

End-to-end runs against the live API and the real models were performed manually; they are not
automated.

## Not implemented

Stated explicitly so nothing is implied:

- OCR for the two scanned official AOs.
- Embeddings and RAG — an unused `embedding` column exists in the schema.
- A durable orchestrator: stages run synchronously inside the HTTP request, with no job queue and
  no checkpoint surviving a restart. Redis is provisioned but unused by the application.
- Re-running compliance after a human correction.
- Listing or reopening a previously processed tender: the UI holds one tender in memory.
- Authentication and multi-tenancy.
