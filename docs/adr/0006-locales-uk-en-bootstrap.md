# ADR-0006: Locales — uk + en at bootstrap, ru added later as data

- Status: accepted
- Date: 2026-07-30

## Context

The platform serves Ukrainians, some more comfortable reading in English (including clients
abroad), and some who may need Russian. Legal text carries more weight than a UI label — a
mistranslated or auto-translated legal document is a real liability, not a cosmetic issue.

## Decision

Bootstrap with two locales: `uk` (primary) and `en`. Russian (`ru`) is not part of the bootstrap
and is added later, as data, once it can be genuinely supported.

A single source `LOCALES` array drives locales — adding or removing a supported language is a
one-line change plus a new dictionary folder, not a code change scattered across the app.

Two presentation constraints, decided now to avoid relitigating per language added later: no
country flags as language icons (a language is not a country, and flags are politically loaded
here specifically); no "machine translation" disclaimers — a language is only offered once it has
real support, so a translation is never caveated as approximate.

Legal texts (document content, law article summaries, consent text) are versioned documents in
their own right, not entries in a UI-string dictionary — translating a legal text is an
editorial act, not a `t('key')` lookup.

## Consequences

- Adding Russian, or any future language, later is a data/content task, not an architecture
  change.
- "Only offer a language with real support" gates rollout by translation effort, not engineering
  effort — a deliberate constraint on how fast the platform can serve a new audience.
- Keeping legal text out of the UI-string dictionary means two separate mechanisms (i18n for UI,
  versioning for legal content) — more moving parts, but avoids legal wording being edited like
  a button label.
- `ru` being deferred is a product/political decision as much as a technical one; this ADR
  records only the mechanism (data, not code), not when or whether `ru` ships.
