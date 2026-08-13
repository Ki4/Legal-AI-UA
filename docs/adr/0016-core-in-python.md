# ADR-0016: The core is written in Python; the contract is a schema, not a shared type

- Status: accepted
- Date: 2026-08-13

## Context

ADR-0004 made the core a separately-deployed in-repo service behind an Edge Function gateway and
left exactly one thing open: TypeScript or Python. It also said why that mattered — the choice
"will shape `packages/core-client`'s contract style and available observability tooling". The
question is now blocking, because ADM-3 freezes that contract before the generator is written, and
a contract cannot be written in a language nobody has picked.

Two arguments that look decisive turn out not to be.

**The agent framework does not decide it.** LangGraph ships for both languages and the JavaScript
documentation is now as thorough as the Python — the gap that existed when the pipeline was first
sketched has closed.

**The Claude API does not decide it.** The Anthropic SDKs are generated for every supported
language from one specification. Tool use, structured outputs, prompt caching, streaming, PDF input
and the agent loop helper exist in Python and TypeScript alike, with the same field names.

What does decide it is the file format the product is made of.

The core's first job is to read an uploaded document and extract its structure and variables
(ADR-0008); its last is to produce a document a client can open. **PDF is close to a non-issue** —
the Claude API accepts a PDF as a native document block, so the model reads it and no parsing
library is involved on our side. **DOCX is not a native input type.** It has to be parsed locally,
in whatever language the core is written in, and DOCX is what Ukrainian firms actually work in.

There the ecosystems genuinely diverge. `python-docx` reads and writes paragraphs, runs, styles and
numbering through one object model. The TypeScript equivalents split the job and lose the middle of
it: `mammoth` converts to HTML — and numbering is not decoration in a legal document, it _is_ the
structure, which is exactly what that conversion flattens — while the `docx` package writes but
does not read. A template extracted from an uploaded contract, and a contract generated back out of
that template, are the same round trip in both directions. That round trip is the product.

One argument for TypeScript deserves to be named rather than quietly dropped, because it is the
strongest one and it is half true: a single language would let `packages/core-client` and the core
share one schema definition. It is half true because ADR-0004 has already put a network hop and
JSON serialisation between the console and the core. Across that boundary a shared type is a
convenience, not a guarantee — the wire is the contract either way, and a type that is only checked
on one side of a serialisation boundary is checked on neither.

## Decision

**`apps/core` is Python.**

Three things follow, and they are the point of writing this down rather than just picking.

**1. The contract's source of truth is a schema file, not either side's types.** The generation
trace is data before it is any language's type: stable block ids, trust status, `needs_attention`,
law and questionnaire references, tool calls. `packages/core-client` carries TypeScript for the
console to import, but that TypeScript conforms to the schema rather than defining it. Which schema
language, and whether the TypeScript is generated or hand-written against it, is ADM-3's to settle —
this ADR fixes only that neither language's type system is the authority.

**2. The core carries its own quality gate.** `pnpm lint`, `pnpm typecheck`, `pnpm test` and
`pnpm build` do not reach a Python package, and `apps/core` sits outside Turborepo's task graph.
The core brings the Python equivalents and its own CI job, and "`main` is always deployable" means
both lanes are green — not the one that happens to run today.

**3. The working rules do not change with the runtime.** English in the repository, Conventional
Commits, ADRs for Tier 2 decisions, tests beside what they test. The language of one service is not
a licence for a second set of conventions inside the same repository.

## Consequences

- **A second toolchain, paid daily by one developer.** A second formatter, linter and test runner;
  a second dependency and vulnerability surface; a second thing to upgrade. This is the real cost
  and it is not small — it is accepted because the DOCX round trip is worth more than the
  uniformity.
- **The gate is only honest if the second lane actually runs.** A Python service whose tests were
  never wired into `ci.yml` is the failure shape the 2026-08-11 journal already named: a missing
  check is not an error, it is silence. The CI job lands with the first Python file, not after it.
- **`lint-staged` currently matches `*.{ts,tsx,js,jsx,mjs,cjs}` and `*.{json,md,yml,yaml,css}`.**
  A `.py` file committed today passes every local hook without being seen by any of them. The globs
  are extended in the same change that creates the package, for the same reason.
- **The contract cannot lean on a shared type.** That is a genuine loss, and it forces the contract
  to exist as a written schema — which is what "frozen before the generator is written" required
  anyway. The loss and the requirement are the same fact seen from two sides.
- **Reversible only while the core is empty.** Today this is a decision about a directory that does
  not exist. Once there is a pipeline in it, it is not a decision any more.
- **Nothing else moves.** The console, the gateway, `packages/db` and the migrations stay as they
  are. This ADR is about one service, chosen because that service does one job the rest of the
  repository never touches.

See `docs/adr/0004-ai-core-separate-service.md` for why the core is a separate service at all,
`docs/adr/0008-templates-from-uploaded-documents.md` for what it reads and why, and
`docs/ROADMAP.md` for where ADM-3 sits in wave 1.
