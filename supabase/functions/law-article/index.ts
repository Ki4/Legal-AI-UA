// The edge function itself: the wiring, and nothing that decides anything.
//
// Everything worth asserting is in `handler.ts` and `read.ts`, which are plain
// TypeScript over injected dependencies and run under the workspace's Vitest.
// What is left here is the part no unit test can prove and no unit test should
// pretend to: a real `fetch`, a real clock, a real database client, and the
// translation between an HTTP request and the two of them.
//
// **Keep this file boring.** It is the one file in the repository that Deno
// runs and Node does not, so a decision that lands here is a decision the test
// suite cannot reach.

import { createClient } from "@supabase/supabase-js";
import { handle } from "./handler.ts";
import type { NewRevision, NormStore, WatchedNorm } from "./handler.ts";

/**
 * The service-role client: the only legitimate author of a revision.
 *
 * `law_norm_revisions` grants `insert` to nobody, and `law_norms` grants
 * `update` on a named list of columns that deliberately excludes `fingerprint`,
 * `normalizer_version` and `last_verified_at` (`20260830120000`). That is not a
 * gap this key routes around — it is the reason the key is here. A lawyer must
 * not be able to `PATCH` a norm into looking freshly verified when nothing was
 * checked; the fetcher must be able to say so because it is the thing that
 * checked. `service_role` bypasses RLS entirely (ADR-0019), so every rule this
 * function is subject to is written in this file rather than in a policy.
 */
const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * A second client, holding only the anon key, used for exactly one thing: asking
 * the auth server who the caller is.
 *
 * The JWT could be decoded here without a round trip — the platform has already
 * verified it before this function runs. That would still be a function whose
 * access control is a base64 decode, and the day `verify_jwt` is switched off
 * for some unrelated reason is the day it grants everything to anybody. So the
 * token is checked by the thing that issued it.
 */
const anon = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
    // `origin` is left to its default of `observed`, which is the honest value
    // and the only one this function is entitled to assert: `renormalized` is a
    // claim about our own rules having changed, and `handler.ts` refuses to
    // reach this line at all when the normalizer has moved (§9.7).
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
    // `fingerprint` and `normalizer_version` are absent on purpose: the
    // `law_norms_adopt_revision` trigger carries those over from the revision
    // that was just written, so that the register and the log cannot state two
    // different things about what an article currently says.
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
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad_request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const role = await roleOf(request.headers.get("authorization"));

  return await handle({ fetch: globalThis.fetch, now: () => new Date(), store }, { role }, body);
});

/** The caller's `app_metadata.role`, which is what `public.jwt_role()` reads. */
async function roleOf(authorization: string | null): Promise<string | null> {
  if (authorization === null) return null;

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (token === "") return null;

  const { data, error } = await anon.auth.getUser(token);
  if (error !== null || data.user === null) return null;

  const role = data.user.app_metadata?.role;
  return typeof role === "string" ? role : null;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set for the law-article function`);
  }
  return value;
}
