# Legal-AI-UA

Legal services platform for Ukrainians — AI-generated legal documents, from fully automated
templates to lawyer-in-the-loop review workflows.

## How it works

A client orders a legal document through the web platform. A questionnaire collects the facts,
the AI pipeline generates the document, and — depending on the service type — a lawyer reviews
it before delivery. Three generation modes:

| Mode              | What happens                                                        | Review                                                                 |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `template`        | Deterministic fill-in of a lawyer-authored template                 | Automated (lawyer configures the template)                             |
| `block_assembly`  | AI assembles the document from pre-approved, lawyer-authored blocks | Lawyer in the loop                                                     |
| `full_generation` | AI generates the text                                               | Lawyer in the loop, with a review UI that highlights generated content |

## Repository layout

```
apps/            Applications (console — lawyer/admin cabinet; web — client platform)
packages/        Shared code (config, ui, db, i18n, core-client)
supabase/        Database migrations, edge functions, seed
docs/            Vision, ADRs, contributing guide, session journals
.claude/         Team-shared AI assistant context: rules, commands
```

## Getting started

```bash
pnpm install
pnpm dev
```

Requirements: Node >= 22, pnpm 10 (`npm i -g pnpm@10`).

Copy `.env.example` into the app you are running and fill in the values — see the comments
inside the file. Secrets never enter git.

## Quality gates

Every commit passes local hooks (ESLint, Prettier, commitlint via Husky + lint-staged).
Every PR passes CI (lint, typecheck, build). `main` is always deployable.

## Team & workflow

See `docs/CONTRIBUTING.md` for branching, ownership zones, review rules, and the
AI-assisted development protocol.
