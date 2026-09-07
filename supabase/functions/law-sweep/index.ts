// The scheduled sweep, as an endpoint: the wiring, and nothing that decides.
//
// Same rule as `law-article/index.ts`, and it applies harder here. This is the
// one file in the sweeper that Deno runs and Node does not, so a decision that
// lands here is a decision the test suite cannot reach — and unlike the article
// function, nobody is watching this one when it runs. Everything worth asserting
// is in `sweep.ts` and in `law-article/handler.ts`.
//
// **Why a second function rather than a third action on `law-article`.** The two
// have different callers, different credentials and different failure meanings.
// `law-article` answers a lawyer inside a form and its failures are somebody's
// afternoon; this answers a scheduler at three in the morning and its failures
// are a register nobody has checked in a week. Folding them together would put
// the machine's authorization path in the endpoint a person's browser reaches,
// which is the shape where a widening for one caller widens it for the other.
// They share what should be shared — the check itself — by import.

import { createClient } from "@supabase/supabase-js";
import { authorizeSweep, sweep } from "./sweep.ts";
import type { NewRevision, NormStore, WatchedNorm } from "../law-article/handler.ts";
import type { DueRegister } from "./sweep.ts";

const SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

/**
 * The service-role client, and here it is doing two jobs rather than one.
 *
 * `law_norms_due_for_probe` is granted to `service_role` and to nobody else
 * (`20260907120000`), so this key is what makes the batch readable at all; and
 * the writes each check performs are the ones `20260902120000` granted, for the
 * reasons written there. The register is the same one `law-article` writes to
 * through the same store below — one definition, imported.
 */
const admin = createClient(requiredEnv("SUPABASE_URL"), SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const register: DueRegister = {
  async due(batchLimit: number): Promise<string[]> {
    const { data, error } = await admin.rpc("law_norms_due_for_probe", {
      batch_limit: batchLimit,
    });

    if (error) throw new Error(`law_norms_due_for_probe failed: ${error.message}`);

    // Only the ids are carried forward, and the rest of the row is deliberately
    // dropped. The check re-reads the norm it is about to write to, one round
    // trip later and one round trip fresher: a batch of a hundred takes minutes,
    // and a norm a lawyer edited in the middle of that must be checked as it is
    // now, not as the cursor remembered it. The function returns the other
    // columns because a health screen will want them (ADM-49) — not because the
    // sweeper should act on a stale copy.
    return (data ?? []).map((row: { id: string }) => row.id);
  },
};

const store: NormStore = {
  async load(normId: string): Promise<WatchedNorm | null> {
    const { data, error } = await admin
      .from("law_norms")
      .select("id, canonical_url, article, state, fingerprint, normalizer_version")
      .eq("id", normId)
      .maybeSingle();

    if (error) throw new Error(`law_norms load failed: ${error.message}`);
    if (data === null) return null;

    return {
      id: data.id as string,
      canonicalUrl: data.canonical_url as string,
      article: data.article as string | null,
      state: data.state as WatchedNorm["state"],
      fingerprint: data.fingerprint as string | null,
      normalizerVersion: data.normalizer_version as number,
    };
  },

  async insertRevision(revision: NewRevision): Promise<void> {
    const { error } = await admin.from("law_norm_revisions").insert({
      norm_id: revision.normId,
      fingerprint: revision.fingerprint,
      normalizer_version: revision.normalizerVersion,
      content: revision.content,
      published_revision_date: revision.publishedRevisionDate,
    });

    if (error) throw new Error(`law_norm_revisions insert failed: ${error.message}`);
  },

  async markChecked(update): Promise<void> {
    const { error } = await admin
      .from("law_norms")
      .update({
        state: update.state,
        last_checked_at: update.checkedAt,
        ...(update.verifiedAt === null ? {} : { last_verified_at: update.verifiedAt }),
      })
      .eq("id", update.normId);

    if (error) throw new Error(`law_norms update failed: ${error.message}`);
  },
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const bearer = bearerOf(request.headers.get("authorization"));
  const role = await roleOf(bearer);

  if (!authorizeSweep({ role, bearer }, { serviceRoleKey: SERVICE_ROLE_KEY })) {
    return json(403, { error: "forbidden" });
  }

  // A body is optional and a malformed one is not worth refusing: the caller is
  // a cron job, `clampBatch` is total, and a 400 nobody reads would turn a typo
  // in a schedule into a register that quietly stops being checked.
  const body = await request
    .json()
    .then((value: unknown) => (typeof value === "object" && value !== null ? value : {}))
    .catch(() => ({}));

  const report = await sweep(
    { fetch: globalThis.fetch, now: () => new Date(), store, register },
    { batchLimit: (body as { batchLimit?: unknown }).batchLimit as number | undefined },
  );

  // 200 even when norms came back `unreachable` or `errored`, and the report is
  // where that lives. A sweep that reached the register and checked what it
  // found did its job; a source being down is news about the source, and a
  // non-2xx would make a cron log say the scheduler is broken when it is the
  // only thing working. What a 5xx here would mean is that the sweep itself
  // could not run — and that arrives as a throw, which the runtime already
  // renders as one.
  return json(200, report as unknown as Record<string, unknown>);
});

/** The token as presented, or null. Kept separate: the sweep authorizes on it. */
function bearerOf(authorization: string | null): string | null {
  if (authorization === null) return null;
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token === "" ? null : token;
}

/**
 * The caller's `app_metadata.role`, for the person half of the authorization.
 *
 * Asked of the auth server rather than decoded here, for the reason spelled out
 * in `law-article/index.ts`: an access check that is a base64 decode grants
 * everything to anybody on the day `verify_jwt` is switched off. The service
 * -role key is not a user token, so this returns null for it and
 * `authorizeSweep` takes the other branch.
 */
async function roleOf(token: string | null): Promise<string | null> {
  if (token === null) return null;

  const { data, error } = await anon.auth.getUser(token);
  if (error !== null || data.user === null) return null;

  const role = data.user.app_metadata?.role;
  return typeof role === "string" ? role : null;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set for the law-sweep function`);
  }
  return value;
}
