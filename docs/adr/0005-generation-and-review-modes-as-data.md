# ADR-0005: Generation and review modes as data

- Status: accepted
- Date: 2026-07-30

## Context

Not every document needs the same generation approach or the same level of human oversight. A
deterministic form fill carries a different risk profile than fully AI-generated legal text.
Hardcoding this per document type would make a new service type a code change instead of a
configuration change, and would make it easy to ship a legally-consequential document without
lawyer review.

## Decision

`service_versions` carries two independent columns: `generation_mode`
(`template` | `block_assembly` | `full_generation`) and `review_mode` (`auto` | `lawyer_required`).
They are independent axes because review doesn't follow mechanically from generation method in
every case — but the constraints are not symmetric: `template` **may** be `auto`;
`block_assembly` and `full_generation` are **always** `lawyer_required`. No configuration lets
AI-assembled or AI-generated text skip lawyer review.

`auto` is further restricted to documents with no legal consequences for the person ordering
them. Even those still surface a "request human review" option — a GDPR Art. 22 requirement and
a product commitment, not just a compliance minimum.

Lawyer-authored blocks (used by `block_assembly`) are a first-class database entity, linked to
the law articles they implement, not opaque template fragments.

## Consequences

- Adding or changing a service type's risk profile is a data change, not a code change.
- The always-lawyer-required rule for `block_assembly`/`full_generation` is enforced on the data
  model, so it cannot be bypassed by a misconfigured service version.
- Lawyer-authored blocks as first-class entities enable versioning and reuse across service
  versions, but require their own editorial workflow and UI to build and maintain.
- Because the two modes are independent, valid combinations must be enforced explicitly (check
  constraint or application logic) rather than implied by a single enum — a deliberate trade of
  schema complexity for flexibility.
