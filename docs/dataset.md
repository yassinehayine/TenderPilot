# Official Dataset

The official Sujet 01 corpus is integrated at `data/tenderpilot/sujet-01-tenderpilot/`.
It is fictional, deterministic, and contains no jury truth set.

## Structure

```text
data/tenderpilot/sujet-01-tenderpilot/
  avis/                  AO-2026-001.pdf through AO-2026-010.pdf
  profil-entreprise.json Structured company profile
  profil-entreprise.pdf  Printable company profile
  references.csv         24 company references
  equipe.csv             14 team profiles
  attestations/          Administrative and insurance PDFs
  offres-passees/        Two previous technical proposals
  README-jeux-de-donnees.md
```

The dataset README states that six AOs should produce Go and four should produce
No-Go for the supplied company profile. The application does not encode those
answers; it must derive them from extracted requirements and profile facts.

## OCR cases

`AO-2026-004.pdf` and `AO-2026-009.pdf` are full scans with no text layer.
The current parser detects them as unreadable, but OCR is not implemented yet.
They must not produce fabricated requirements.

## Runtime integration

The API loads the official profile through `GET /api/company-profile` and injects
the structured profile, CSV references/team rows, attestation filenames, and
previous proposal filenames into EX-04 qualification. The upload screen lists
all ten AOs; selecting one invokes the same processing pipeline as a local PDF
upload.