# TenderPilot MVP Matrix

Source: `docs/Cahier-des-charges-Sujet-01-TenderPilot.pdf`.

| Requirement | Current status | Missing implementation | Backend | Frontend | Data / tests |
| --- | --- | --- | --- | --- | --- |
| EX-01 Upload and trigger | Implemented, runtime blocked | Persist an uploaded PDF, start processing, show status | Multipart upload, tender/document repository, processing state | Upload form and status feedback | `tenders`, `tender_documents`; Docker-backed test pending |
| EX-02 Typed compliance matrix | Implemented, LLM runtime blocked | Extract and display obligatoire, optionnelle, éliminatoire requirements | Page-aware extractor agent and requirement API | Compliance matrix with filters and states | `tender_requirements`; real LLM test pending |
| EX-03 Source traceability | Implemented, LLM runtime blocked | Link each requirement to source page and excerpt | Source metadata validation and PDF page access | Click requirement to source page/excerpt | `source_page`, `source_excerpt`, confidence; real LLM test pending |
| EX-04 Go / No-Go | Implemented, runtime blocked | Compare requirements with company profile and explain blockers | Qualifier agent, blocker persistence, result API | Decision and blocker view | Qualification persistence and real LLM test pending |
| EX-05 Technical proposal | Missing | Generate sectioned proposal and export DOCX/PDF | Writer agent, internal references, export service | Proposal editor/export controls | Proposal sections, reference retrieval, export tests |
| EX-06 Human review | Missing | Save section corrections and rerun compliance | Review/correction repository and checkpoint transition | Section-by-section review UI | Corrected content persistence and rerun tests |
| EX-07 Explicit failures | In progress | OCR fallback and clear unreadable-page states | OCR service, failure states, retries/escalation | Visible failure and affected-page UI | Unreadable PDF fixtures and no-silent-failure tests |

## Vertical slice order

1. EX-01 upload, persistence, and processing status.
2. EX-02/03 extraction, typed requirements, and source links.
3. EX-04 qualification and blockers.
4. EX-05 proposal sections and DOCX export.
5. EX-06 correction persistence and rerun.
6. EX-07 OCR/unreadable handling hardening.

The current implementation intentionally does not claim an agentic result before the corresponding slice exists.