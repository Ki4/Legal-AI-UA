// Stand-in rows, shaped exactly as the tables are — snake_case included, since
// these stand in for what Postgres returns. A feature's api/ layer joins them
// into the view model its screen needs, which is the same work the Supabase
// implementation will do, so swapping the source later changes no component
// (ADR-0012).
//
// Invented data only: never a real client name, email or case detail.

import type {
  AuditEventRow,
  ClientRow,
  EntitlementRow,
  GenerationTrace,
  LawNormRow,
  OrderRow,
  PracticeAreaRow,
  ProfileRow,
  QuestionnaireFieldRow,
  ServiceAssignmentRow,
  ServiceLawRefRow,
  ServiceRow,
  ServiceVersionPriceRow,
  ServiceVersionRow,
} from "./types";

export const mockProfiles: ProfileRow[] = [
  {
    id: "usr-olena",
    email: "olena@example.test",
    full_name: "Olena Kovalchuk",
    role: "lawyer",
    created_at: "2026-04-01T09:00:00.000Z",
  },
  {
    id: "usr-taras",
    email: "taras@example.test",
    full_name: "Taras Bondarenko",
    role: "lawyer",
    created_at: "2026-04-02T09:00:00.000Z",
  },
  {
    id: "usr-admin",
    email: "iryna@example.test",
    full_name: "Iryna Shevchenko",
    role: "admin",
    created_at: "2026-03-20T09:00:00.000Z",
  },
  // A registration nobody has approved yet: a profile row exists from the moment
  // somebody signs up, and `role` stays null until an admin grants one. Without
  // this row the team screen's whole reason to exist is untestable, and the rule
  // that an unapproved registration is not an assignable colleague
  // (20260811160000_service_assignments.sql) has nothing to demonstrate it.
  {
    id: "usr-pending",
    email: "dmytro@example.test",
    full_name: null,
    role: null,
    created_at: "2026-08-12T09:00:00.000Z",
  },
];

// A slice of the seeded areas, not all fifteen: fixtures exist to exercise the
// screens, and the two the mock catalogue actually uses plus one nobody is filed
// under is what proves a filter value with nothing behind it is not offered.
export const mockPracticeAreas: PracticeAreaRow[] = [
  {
    code: "family",
    label_uk: "Сімейне право",
    label_en: "Family",
    position: 10,
    is_active: true,
    created_at: "2026-08-12T09:00:00.000Z",
  },
  {
    code: "civil",
    label_uk: "Цивільне та договірне право",
    label_en: "Civil and contract",
    position: 30,
    is_active: true,
    created_at: "2026-08-12T09:00:00.000Z",
  },
  {
    code: "labour",
    label_uk: "Трудове право",
    label_en: "Labour",
    position: 50,
    is_active: true,
    created_at: "2026-08-12T09:00:00.000Z",
  },
];

export const mockServices: ServiceRow[] = [
  {
    id: "svc-divorce",
    slug: "divorce-application",
    title: "Divorce application",
    summary: "Application to dissolve a marriage, filed with a district court.",
    practice_area: "family",
    created_at: "2026-05-12T09:20:00.000Z",
    updated_at: "2026-07-30T14:05:00.000Z",
  },
  {
    id: "svc-alimony",
    slug: "alimony-claim",
    title: "Alimony claim",
    summary: "Claim for child maintenance.",
    practice_area: "family",
    created_at: "2026-06-02T11:00:00.000Z",
    updated_at: "2026-07-28T08:41:00.000Z",
  },
  {
    id: "svc-poa",
    slug: "power-of-attorney",
    title: "Power of attorney",
    summary: "General power of attorney, no legal consequences for the grantor.",
    practice_area: "civil",
    created_at: "2026-06-19T16:30:00.000Z",
    updated_at: "2026-07-04T10:15:00.000Z",
  },
];

// Olena is accountable for the divorce service and Taras covers it — the
// arrangement the assignment table exists for. svc-poa has nobody, so the list
// has an unassigned row to render.
// The questionnaire dictionary of one service (§4.4). Three fields rather than
// twelve, chosen for the states the screen has to tell apart rather than for
// realism: one ordinary, one carrying personal data with its Art. 6 basis and a
// retention period, one carrying an Art. 9 special category on top of that. The
// fourth interesting shape — a `select` with its options — is `court_region`.
//
// The GDPR columns are filled the way the constraints demand and not one field
// looser: a fixture that held a flag without its basis would be a row Postgres
// refuses, and the whole point of a fixture is to be shaped exactly as the real
// response will be (DoD §2).
export const mockQuestionnaireFields: QuestionnaireFieldRow[] = [
  {
    id: "qf-applicant-name",
    service_id: "svc-divorce",
    key: "applicant_name",
    label: "Applicant's full name",
    help_text: "As written in the passport.",
    field_type: "text",
    required: true,
    position: 0,
    options: null,
    is_personal_data: true,
    legal_basis: "contract",
    retention_days: 1095,
    is_special_category: false,
    special_category_basis: null,
    created_at: "2026-05-12T09:25:00.000Z",
    updated_at: "2026-07-30T14:05:00.000Z",
  },
  {
    id: "qf-marriage-date",
    service_id: "svc-divorce",
    key: "marriage_date",
    label: "Date of marriage",
    help_text: null,
    field_type: "date",
    required: true,
    position: 1,
    options: null,
    is_personal_data: false,
    legal_basis: null,
    retention_days: null,
    is_special_category: false,
    special_category_basis: null,
    created_at: "2026-05-12T09:26:00.000Z",
    updated_at: "2026-05-12T09:26:00.000Z",
  },
  {
    id: "qf-court-region",
    service_id: "svc-divorce",
    key: "court_region",
    label: "Court region",
    help_text: null,
    field_type: "select",
    required: true,
    position: 2,
    options: ["Kyiv", "Lviv", "Odesa"],
    is_personal_data: false,
    legal_basis: null,
    retention_days: null,
    is_special_category: false,
    special_category_basis: null,
    created_at: "2026-05-12T09:27:00.000Z",
    updated_at: "2026-05-12T09:27:00.000Z",
  },
  {
    id: "qf-health-grounds",
    service_id: "svc-divorce",
    key: "health_grounds",
    label: "Health circumstances relied on",
    help_text: "Only if the claim rests on them.",
    field_type: "long_text",
    required: false,
    position: 3,
    options: null,
    is_personal_data: true,
    legal_basis: "legitimate_interests",
    retention_days: 1095,
    is_special_category: true,
    special_category_basis: "legal_claims",
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "qf-alimony-amount",
    service_id: "svc-alimony",
    key: "monthly_amount",
    label: "Monthly amount claimed",
    help_text: null,
    field_type: "number",
    required: true,
    position: 0,
    options: null,
    is_personal_data: false,
    legal_basis: null,
    retention_days: null,
    is_special_category: false,
    special_category_basis: null,
    created_at: "2026-06-02T11:05:00.000Z",
    updated_at: "2026-06-02T11:05:00.000Z",
  },
];

export const mockServiceAssignments: ServiceAssignmentRow[] = [
  {
    service_id: "svc-divorce",
    lawyer_id: "usr-olena",
    is_primary: true,
    assigned_at: "2026-05-12T09:20:00.000Z",
    assigned_by: "usr-admin",
  },
  {
    service_id: "svc-divorce",
    lawyer_id: "usr-taras",
    is_primary: false,
    assigned_at: "2026-07-01T09:00:00.000Z",
    assigned_by: "usr-olena",
  },
  {
    service_id: "svc-alimony",
    lawyer_id: "usr-taras",
    is_primary: true,
    assigned_at: "2026-06-02T11:00:00.000Z",
    assigned_by: "usr-admin",
  },
];

// Deliberately uneven: svc-divorce has an archived predecessor so the live
// version is not simply "the only one", svc-poa is paused, and svc-alimony has
// never been published — the three states the list has to render differently.
//
// Mode pairings respect the ADR-0005 constraint the schema now enforces:
// anything but `template` is always `lawyer_required`. A fixture that violated
// it would be a fixture the database would reject.
export const mockServiceVersions: ServiceVersionRow[] = [
  {
    id: "sv-divorce-1",
    service_id: "svc-divorce",
    version: 1,
    status: "archived",
    generation_mode: "full_generation",
    review_mode: "lawyer_required",
    published_at: "2026-05-20T09:00:00.000Z",
    published_by: "usr-admin",
    created_at: "2026-05-12T09:20:00.000Z",
  },
  {
    id: "sv-divorce-2",
    service_id: "svc-divorce",
    version: 2,
    status: "published",
    generation_mode: "full_generation",
    review_mode: "lawyer_required",
    published_at: "2026-07-30T14:05:00.000Z",
    published_by: "usr-admin",
    created_at: "2026-07-20T10:00:00.000Z",
  },
  {
    id: "sv-alimony-1",
    service_id: "svc-alimony",
    version: 1,
    status: "draft",
    generation_mode: "block_assembly",
    review_mode: "lawyer_required",
    published_at: null,
    published_by: null,
    created_at: "2026-06-02T11:00:00.000Z",
  },
  {
    id: "sv-poa-1",
    service_id: "svc-poa",
    version: 1,
    status: "paused",
    generation_mode: "template",
    review_mode: "auto",
    published_at: "2026-06-25T12:00:00.000Z",
    published_by: "usr-admin",
    created_at: "2026-06-19T16:30:00.000Z",
  },
];

// sv-alimony-1 deliberately has no price: a draft that nobody has priced yet is
// an ordinary state, and the screens have to render it rather than assume every
// version costs something.
export const mockServiceVersionPrices: ServiceVersionPriceRow[] = [
  { service_version_id: "sv-divorce-1", currency: "UAH", amount_minor: 480000 },
  { service_version_id: "sv-divorce-2", currency: "UAH", amount_minor: 520000 },
  { service_version_id: "sv-poa-1", currency: "UAH", amount_minor: 120000 },
];

// The action log behind the history screen (spec §4.8). Ordered oldest first
// here because that is the order the events happened in and a fixture is easier
// to read that way; the screen sorts, and a test that depended on this order
// would be testing the fixture (DoD §5).
//
// Shaped as the trigger writes them, which is what makes them worth having:
// `before`/`after` carry whole rows, `changed_columns` is recorded before
// redaction, and the ids are a monotonic bigint rather than a uuid. Every one
// of the actor states the screen has to tell apart appears at least once —
// a person, an actor whose profile cannot be read, and no actor at all.
export const mockAuditEvents: AuditEventRow[] = [
  {
    id: 1,
    occurred_at: "2026-05-12T09:20:00.000Z",
    actor_id: "usr-admin",
    actor_role: "admin",
    service_id: "svc-divorce",
    action: "insert",
    entity_table: "services",
    entity_id: "svc-divorce",
    changed_columns: null,
    before: null,
    after: { id: "svc-divorce", slug: "divorce-application", title: "Divorce application" },
  },
  // Same instant as the row above, and deliberately: the service and its first
  // assignment are written in one transaction, and `occurred_at` defaults to
  // `now()`, which is transaction time. Two events therefore share a timestamp
  // exactly, and sorting by it alone leaves their order to the planner.
  {
    id: 2,
    occurred_at: "2026-05-12T09:20:00.000Z",
    actor_id: "usr-admin",
    actor_role: "admin",
    service_id: "svc-divorce",
    action: "insert",
    entity_table: "service_assignments",
    entity_id: "svc-divorce",
    changed_columns: null,
    before: null,
    after: { service_id: "svc-divorce", lawyer_id: "usr-olena", is_primary: true },
  },
  {
    id: 3,
    occurred_at: "2026-07-20T10:00:00.000Z",
    actor_id: "usr-olena",
    actor_role: "lawyer",
    service_id: "svc-divorce",
    action: "insert",
    entity_table: "service_versions",
    entity_id: "sv-divorce-2",
    changed_columns: null,
    before: null,
    after: { id: "sv-divorce-2", version: 2, status: "draft" },
  },
  {
    id: 4,
    occurred_at: "2026-07-30T14:05:00.000Z",
    actor_id: "usr-admin",
    actor_role: "admin",
    service_id: "svc-divorce",
    action: "update",
    entity_table: "service_versions",
    entity_id: "sv-divorce-2",
    changed_columns: ["published_at", "published_by", "status"],
    before: { id: "sv-divorce-2", status: "in_review", published_at: null },
    after: { id: "sv-divorce-2", status: "published", published_at: "2026-07-30T14:05:00.000Z" },
  },
  // An actor with no profile this caller can read: a deactivated account, or a
  // colleague RLS hides. Distinct from the row below, where nobody acted at
  // all — collapsing the two would put "system" against something a person did.
  {
    id: 5,
    occurred_at: "2026-07-31T08:00:00.000Z",
    actor_id: "usr-departed",
    actor_role: "lawyer",
    service_id: "svc-divorce",
    action: "delete",
    entity_table: "questionnaire_fields",
    entity_id: "fld-old-address",
    changed_columns: null,
    before: { id: "fld-old-address", service_id: "svc-divorce" },
    after: null,
  },
  // No actor: a migration, a seed, or a definer function running outside a
  // request. `auth.uid()` is null there, and the log records that honestly
  // rather than attributing the change to whoever ran the deploy.
  {
    id: 6,
    occurred_at: "2026-08-01T03:00:00.000Z",
    actor_id: null,
    actor_role: null,
    service_id: "svc-divorce",
    action: "update",
    entity_table: "service_version_prices",
    entity_id: "sv-divorce-2",
    changed_columns: ["amount_minor"],
    before: { amount_minor: 500000 },
    after: { amount_minor: 520000 },
  },
  // A table with no word for it yet. Not hypothetical: any migration that adds
  // an audit trigger to a new service-bearing table produces exactly this row
  // before anybody adds it to `AUDITED_TABLES`, and the screen has to render
  // something honest in the meantime.
  {
    id: 7,
    occurred_at: "2026-08-02T12:00:00.000Z",
    actor_id: "usr-olena",
    actor_role: "lawyer",
    service_id: "svc-divorce",
    action: "insert",
    entity_table: "service_law_references",
    entity_id: "ref-ck-105",
    changed_columns: null,
    before: null,
    after: null,
  },
  // svc-alimony has a history of its own, so filtering by service is something
  // a test can actually observe. svc-poa has none at all: a service older than
  // the log is the empty state, and it is not a hypothetical either — four
  // domain tables shipped before ADR-0010's table did.
  {
    id: 8,
    occurred_at: "2026-06-02T11:00:00.000Z",
    actor_id: "usr-admin",
    actor_role: "admin",
    service_id: "svc-alimony",
    action: "insert",
    entity_table: "services",
    entity_id: "svc-alimony",
    changed_columns: null,
    before: null,
    after: { id: "svc-alimony", slug: "alimony-claim", title: "Alimony claim" },
  },
];

export const mockTrace: GenerationTrace = {
  traceVersion: 1,
  serviceId: "svc-divorce",
  blocks: [
    {
      id: "blk-header",
      title: "Court header and parties",
      trust: "template",
      needsAttention: false,
      lawRefs: [],
      questionnaireFields: ["applicant_name", "respondent_name", "court_region"],
    },
    {
      id: "blk-circumstances",
      title: "Circumstances of the marriage",
      trust: "ai_generated",
      needsAttention: true,
      lawRefs: [],
      questionnaireFields: ["marriage_date", "children", "separation_reason"],
    },
    {
      id: "blk-legal-grounds",
      title: "Legal grounds",
      trust: "ai_generated",
      needsAttention: false,
      lawRefs: ["Family Code of Ukraine, art. 112"],
      questionnaireFields: [],
    },
    {
      id: "blk-request",
      title: "Request to the court",
      trust: "lawyer_edited",
      needsAttention: false,
      lawRefs: [],
      questionnaireFields: ["applicant_name"],
    },
  ],
};

// Clients and their orders (ADM-62, ADM-63) ---------------------------------
//
// Pseudonyms only, and not as a convention this file is being careful about —
// `clients` has no name column to be careless with. That is the split ADM-62
// made, and it is why a fixture for a client-bearing screen needs no warning
// about invented people: there is nowhere here to put one.

export const mockClients: ClientRow[] = [
  {
    id: "cli-4f2a91",
    pseudonym: "client-4f2a91",
    created_at: "2026-08-01T08:00:00.000Z",
    erased_at: null,
    erasure_basis: null,
  },
  {
    id: "cli-9b17ce",
    pseudonym: "client-9b17ce",
    created_at: "2026-08-03T14:30:00.000Z",
    erased_at: null,
    erasure_basis: null,
  },
];

/**
 * Deliberately uneven, because the list has to render states that differ from
 * each other rather than four rows of the same thing:
 *
 *   `ord-1` is with a lawyer who is readable — the ordinary case.
 *   `ord-2` is in intake with nobody on it, so `reviewer` is `none` and must
 *     not render like `ord-3`.
 *   `ord-3` names a reviewer no profile row matches, which is the fixture
 *     equivalent of a profile RLS hides: `unnamed`, and the state a nullable
 *     name would have collapsed into `none`.
 *   `ord-4` is `generating` with `human_review_requested`, the Art. 22 shape
 *     that changes what the state means without changing the state.
 */
export const mockOrders: OrderRow[] = [
  {
    id: "ord-1",
    client_id: "cli-4f2a91",
    service_version_id: "sv-divorce-2",
    entitlement_id: "ent-1",
    status: "in_review",
    reviewer_id: "usr-olena",
    human_review_requested: false,
    placed_at: "2026-08-10T09:15:00.000Z",
    submitted_at: "2026-08-10T09:40:00.000Z",
    delivered_at: null,
    closed_at: null,
    updated_at: "2026-08-10T10:05:00.000Z",
  },
  {
    id: "ord-2",
    client_id: "cli-9b17ce",
    service_version_id: "sv-alimony-1",
    entitlement_id: null,
    status: "intake",
    reviewer_id: null,
    human_review_requested: false,
    placed_at: "2026-08-09T16:00:00.000Z",
    submitted_at: null,
    delivered_at: null,
    closed_at: null,
    updated_at: "2026-08-09T16:00:00.000Z",
  },
  {
    id: "ord-3",
    client_id: "cli-4f2a91",
    service_version_id: "sv-divorce-2",
    entitlement_id: "ent-2",
    status: "delivered",
    reviewer_id: "usr-departed",
    human_review_requested: false,
    placed_at: "2026-08-05T11:20:00.000Z",
    submitted_at: "2026-08-05T11:45:00.000Z",
    delivered_at: "2026-08-06T08:30:00.000Z",
    closed_at: null,
    updated_at: "2026-08-06T08:30:00.000Z",
  },
  {
    id: "ord-4",
    client_id: "cli-9b17ce",
    service_version_id: "sv-divorce-2",
    // Names an entitlement no fixture row has, which is what a lawyer meets
    // live: the id is a column of `orders` and readable, the row it points at
    // is administration and is not (ADR-0019).
    entitlement_id: "ent-3",
    status: "generating",
    reviewer_id: null,
    human_review_requested: true,
    placed_at: "2026-08-11T07:05:00.000Z",
    submitted_at: "2026-08-11T07:30:00.000Z",
    delivered_at: null,
    closed_at: null,
    updated_at: "2026-08-11T07:31:00.000Z",
  },
];

/**
 * Two purchases, shaped so the card has both halves of §8.6 to render: a
 * one-off, whose validity ends when the law moves and therefore carries no end
 * date (§8.1), and a subscription that was revoked — a term that was cut short
 * rather than one that lapsed, which is why `revoked_at` is its own column.
 */
export const mockEntitlements: EntitlementRow[] = [
  {
    id: "ent-1",
    client_id: "cli-4f2a91",
    kind: "one_off",
    plan_code: null,
    valid_from: "2026-08-01T08:00:00.000Z",
    valid_until: null,
    revoked_at: null,
    granted_by: "usr-admin",
    created_at: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "ent-2",
    client_id: "cli-4f2a91",
    kind: "subscription",
    plan_code: "annual",
    valid_from: "2026-08-01T08:00:00.000Z",
    valid_until: "2027-08-01T08:00:00.000Z",
    revoked_at: "2026-08-07T09:00:00.000Z",
    granted_by: "usr-admin",
    created_at: "2026-08-01T08:00:00.000Z",
  },
];

/**
 * What the log holds about one order, which is what the card's timeline reads
 * (ADR-0010: the order has no event table of its own). Ordered oldest first
 * here; the api layer sorts, because nothing depends on fixture order (DoD §5).
 *
 * `after` carries the whole row live. Only `status` is kept here, because only
 * `status` is selected — the timeline asks for the field it renders rather than
 * the payload it would have to pick through.
 */
export const mockOrderEvents: AuditEventRow[] = [
  {
    id: 101,
    occurred_at: "2026-08-10T09:15:00.000Z",
    actor_id: null,
    actor_role: null,
    service_id: "svc-divorce",
    action: "insert",
    entity_table: "orders",
    entity_id: "ord-1",
    changed_columns: null,
    before: null,
    after: { status: "intake" },
  },
  {
    id: 102,
    occurred_at: "2026-08-10T09:40:00.000Z",
    actor_id: "usr-olena",
    actor_role: "lawyer",
    service_id: "svc-divorce",
    action: "update",
    entity_table: "orders",
    entity_id: "ord-1",
    changed_columns: ["status", "submitted_at", "updated_at"],
    before: null,
    after: { status: "submitted" },
  },
  {
    id: 103,
    occurred_at: "2026-08-10T10:05:00.000Z",
    actor_id: "usr-departed",
    actor_role: "lawyer",
    service_id: "svc-divorce",
    action: "update",
    entity_table: "orders",
    entity_id: "ord-1",
    changed_columns: ["reviewer_id", "updated_at"],
    before: null,
    after: {},
  },
];

/**
 * The law register (§9.3). Four norms, chosen so that every state the screen has
 * to tell apart has a row producing it rather than a branch nobody has seen:
 *
 *   `norm-sk-105` — verified recently, and the one two services share. It is the
 *     fixture that makes "watched once, depended on many times" visible: the
 *     divorce service and the alimony service both rest on it.
 *   `norm-sk-180` — verified, but long enough ago that it is stale by time. Not
 *     an error and not a detected change: §9.10's third answer, which a screen
 *     rendering only green and red has nowhere to put.
 *   `norm-ck-act` — act-level, with its reason. §9.4's marked exception, and the
 *     only row where `article` is null.
 *   `norm-cpc-116` — entered and never successfully checked. Today this is what
 *     every real norm looks like, because nothing fetches yet.
 *
 * `fingerprint` is null wherever `last_verified_at` is null, and set wherever it
 * is not: a hash without a verification date, or the reverse, is a state the
 * fetcher cannot produce and a fixture should not invent (DoD §2).
 */
export const mockLawNorms: LawNormRow[] = [
  {
    id: "norm-sk-105",
    source: "zakon_rada",
    act_id: "2947-14",
    act_title: "Сімейний кодекс України",
    scope: "article",
    article: "105",
    act_scope_reason: null,
    source_url: "https://zakon.rada.gov.ua/laws/show/2947-14/ed20240101#n800",
    canonical_url: "https://zakon.rada.gov.ua/laws/show/2947-14",
    state: "verified",
    fingerprint: "sha256:0f4c1b9d",
    normalizer_version: 1,
    probe_interval: "1 day",
    probe_interval_hours: 24,
    interval_reason: null,
    last_checked_at: "2026-08-15T04:00:00.000Z",
    last_verified_at: "2026-08-15T04:00:00.000Z",
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-08-15T04:00:00.000Z",
  },
  {
    id: "norm-sk-180",
    source: "zakon_rada",
    act_id: "2947-14",
    act_title: "Сімейний кодекс України",
    scope: "article",
    article: "180",
    act_scope_reason: null,
    source_url: "https://zakon.rada.gov.ua/laws/show/2947-14",
    canonical_url: "https://zakon.rada.gov.ua/laws/show/2947-14",
    state: "verified",
    fingerprint: "sha256:77ab30e1",
    normalizer_version: 1,
    probe_interval: "1 day",
    probe_interval_hours: 24,
    interval_reason: null,
    last_checked_at: "2026-07-20T04:00:00.000Z",
    last_verified_at: "2026-07-20T04:00:00.000Z",
    created_at: "2026-07-02T10:05:00.000Z",
    updated_at: "2026-07-20T04:00:00.000Z",
  },
  {
    id: "norm-ck-act",
    source: "zakon_rada",
    act_id: "435-15",
    act_title: "Цивільний кодекс України",
    scope: "act",
    article: null,
    act_scope_reason: "The template rests on the act as a whole; noise expected.",
    source_url: "https://zakon.rada.gov.ua/laws/show/435-15",
    canonical_url: "https://zakon.rada.gov.ua/laws/show/435-15",
    state: "unverified",
    fingerprint: null,
    normalizer_version: 1,
    probe_interval: "7 days",
    probe_interval_hours: 168,
    interval_reason: null,
    last_checked_at: null,
    last_verified_at: null,
    created_at: "2026-07-11T13:30:00.000Z",
    updated_at: "2026-07-11T13:30:00.000Z",
  },
  {
    id: "norm-cpc-116",
    source: "zakon_rada",
    act_id: "1618-15",
    act_title: "Цивільний процесуальний кодекс України",
    scope: "article",
    article: "116",
    act_scope_reason: null,
    source_url: "https://zakon.rada.gov.ua/laws/show/1618-15",
    canonical_url: "https://zakon.rada.gov.ua/laws/show/1618-15",
    state: "unverified",
    fingerprint: null,
    normalizer_version: 1,
    probe_interval: "12:00:00",
    probe_interval_hours: 12,
    interval_reason: "Amended twice during the procedural reform.",
    last_checked_at: null,
    last_verified_at: null,
    created_at: "2026-08-03T08:45:00.000Z",
    updated_at: "2026-08-03T08:45:00.000Z",
  },
];

/**
 * Which service rests on which norm, and for what (§9.5.6).
 *
 * `svc-poa` is deliberately absent: a service with no law references at all is
 * the state every service is in before somebody enters the first one, and the
 * empty screen needs a fixture that produces it.
 */
export const mockServiceLawRefs: ServiceLawRefRow[] = [
  {
    id: "ref-divorce-105",
    service_id: "svc-divorce",
    norm_id: "norm-sk-105",
    relied_on: "Grounds on which a marriage may be dissolved by a court.",
    created_at: "2026-07-02T10:10:00.000Z",
    updated_at: "2026-07-02T10:10:00.000Z",
  },
  {
    id: "ref-divorce-cpc",
    service_id: "svc-divorce",
    norm_id: "norm-cpc-116",
    relied_on: "Which court the application is filed with.",
    created_at: "2026-08-03T08:50:00.000Z",
    updated_at: "2026-08-03T08:50:00.000Z",
  },
  {
    id: "ref-alimony-105",
    service_id: "svc-alimony",
    norm_id: "norm-sk-105",
    relied_on: "Dissolution is the ground the maintenance claim follows from.",
    created_at: "2026-07-14T09:00:00.000Z",
    updated_at: "2026-07-14T09:00:00.000Z",
  },
  {
    id: "ref-alimony-180",
    service_id: "svc-alimony",
    norm_id: "norm-sk-180",
    relied_on: "The parents' duty to maintain a child until majority.",
    created_at: "2026-07-14T09:02:00.000Z",
    updated_at: "2026-07-14T09:02:00.000Z",
  },
  {
    id: "ref-alimony-ck",
    service_id: "svc-alimony",
    norm_id: "norm-ck-act",
    relied_on: "General obligations law, relied on throughout the template.",
    created_at: "2026-07-14T09:05:00.000Z",
    updated_at: "2026-07-14T09:05:00.000Z",
  },
];
