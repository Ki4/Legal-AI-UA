import { asRole, type Role } from "@legal-ai/db";

// The role a session is acting in, read from the access token's claims.
//
// Not from `session.user.app_metadata`. GoTrue builds the user object from
// `auth.users.raw_app_meta_data`, and since ADR-0026 the role is not there: it
// is a `user_roles` row that a custom access token hook stamps into the claims
// of every token it signs. The claims are what `jwt_role()` and every policy
// read, so they are the only place the console can read the same answer the
// database will give it. A session whose user object says one thing and whose
// token says another is exactly the drift ADR-0018 had to write a repair for.
//
// The payload is decoded, not verified — the server verifies, and a client
// forging its own claim would be forging what it shows itself.
export function roleFromAccessToken(accessToken: string): Role | null {
  const payload = decodePayload(accessToken);
  if (payload === null) return null;

  const appMetadata = payload["app_metadata"];
  if (typeof appMetadata !== "object" || appMetadata === null) return null;

  const role = (appMetadata as Record<string, unknown>)["role"];
  return asRole(typeof role === "string" ? role : null);
}

function decodePayload(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (segment === undefined) return null;

  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)),
    );
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
