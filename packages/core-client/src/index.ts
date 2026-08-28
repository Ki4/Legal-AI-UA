// The contract with the AI core: what crosses the gateway, and in what shape.
//
// **Why this is a package of its own.** The core is a separately-deployed Python
// service reached only through a Supabase Edge Function gateway (ADR-0004,
// ADR-0016). Three runtimes therefore have to agree about one payload — Python
// writes it, Deno relays it, the browser renders it — and no one language's
// type system can be the authority over the other two. So the authority is
// `schema/*.schema.json`, and this directory is TypeScript that conforms to it.
//
// **What that costs, and how it is paid.** Hand-written types can drift from the
// schema they claim to follow, and the drift is silent: a value the schema
// allows and the union does not produces `undefined` at a lookup, not an error.
// The defence is the bridge constants beside each type — `BLOCK_TRUST`,
// `TRACE_BLOCK_KEYS` — which exist to be compared against the schema by
// `schema.test.ts`. ADR-0021 has the reasoning and the counterexample that made
// it necessary.
//
// **Keep it dependency-free.** `packages/law-refs` is the precedent and the
// reason is the same one: the gateway is Deno and will import this source
// unchanged. No npm runtime dependencies, no Node built-ins, explicit `.ts`
// extensions on internal imports — and no `import` of a `.json` file anywhere on
// this barrel's graph, because Deno rejects one without an import attribute.
// The schema and the fixtures are read with `readFileSync` from the test, which
// is not on this graph. `ajv` is a devDependency and never ships.
//
// `packages/db` could not host this: it holds what Postgres produces, and it
// imports the generated Supabase types. This package holds what the core
// produces.

export {
  BLOCK_CONDITION_KEYS,
  BLOCK_TRUST,
  GENERATION_TRACE_KEYS,
  LAW_REF_KEYS,
  LAW_SOURCE,
  TOOL_CALL_KEYS,
  TOOL_OUTCOME,
  TRACE_BLOCK_KEYS,
} from "./trace.ts";
export type {
  BlockCondition,
  BlockConditionKeysAreExhaustive,
  BlockTrust,
  GenerationTrace,
  GenerationTraceKeysAreExhaustive,
  Instant,
  LawRef,
  LawRefKeysAreExhaustive,
  LawSource,
  ToolCall,
  ToolCallKeysAreExhaustive,
  ToolOutcome,
  TraceBlock,
  TraceBlockKeysAreExhaustive,
} from "./trace.ts";

export {
  CORE_ERROR_CODE,
  CORE_ERROR_KEYS,
  CORE_OPERATIONS,
  CoreCallError,
  ERROR_RESPONSE_KEYS,
  GENERATION_REQUEST_KEYS,
  JOB_KEYS,
  JOB_STATUS,
} from "./protocol.ts";
export type {
  CoreClient,
  CoreError,
  CoreErrorCode,
  CoreErrorKeysAreExhaustive,
  CoreOperationsAreExhaustive,
  ErrorResponse,
  ErrorResponseKeysAreExhaustive,
  GenerationRequest,
  GenerationRequestKeysAreExhaustive,
  Job,
  JobKeysAreExhaustive,
  JobStatus,
} from "./protocol.ts";
