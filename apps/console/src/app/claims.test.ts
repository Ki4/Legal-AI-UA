import { describe, expect, it } from "vitest";
import { roleFromAccessToken } from "./claims";

// A token the way GoTrue signs one: three base64url segments, the middle one a
// JSON payload. The signature is not checked here, so it can be anything.
function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("roleFromAccessToken", () => {
  it("reads the role the hook stamped into app_metadata", () => {
    expect(roleFromAccessToken(token({ sub: "u1", app_metadata: { role: "admin" } }))).toBe(
      "admin",
    );
    expect(roleFromAccessToken(token({ sub: "u1", app_metadata: { role: "lawyer" } }))).toBe(
      "lawyer",
    );
  });

  it("reads no role for a token the hook minted nothing into", () => {
    // A pending registration: app_metadata is there, the role is not.
    expect(
      roleFromAccessToken(token({ sub: "u1", app_metadata: { provider: "email" } })),
    ).toBeNull();
    expect(roleFromAccessToken(token({ sub: "u1" }))).toBeNull();
  });

  it("does not read a role from anywhere but app_metadata", () => {
    // `user_metadata` is user-editable and must never gate access; the
    // top-level `role` is the Postgres role (`authenticated`), not ours.
    expect(
      roleFromAccessToken(
        token({ sub: "u1", role: "authenticated", user_metadata: { role: "admin" } }),
      ),
    ).toBeNull();
  });

  it("narrows an unknown role to none, the way asRole does", () => {
    expect(
      roleFromAccessToken(token({ sub: "u1", app_metadata: { role: "superadmin" } })),
    ).toBeNull();
    expect(roleFromAccessToken(token({ sub: "u1", app_metadata: { role: 7 } }))).toBeNull();
  });

  it("survives a token that is not a token", () => {
    expect(roleFromAccessToken("")).toBeNull();
    expect(roleFromAccessToken("not.a.jwt")).toBeNull();
    expect(roleFromAccessToken("only-one-segment")).toBeNull();
  });

  it("decodes base64url, not base64", () => {
    // A payload whose encoding contains `-` and `_` — the two characters that
    // differ between the alphabets. Padding is stripped, as GoTrue strips it.
    const payload = { sub: "u1", app_metadata: { role: "admin" }, note: "??>>??>>" };
    const encoded = token(payload);
    expect(encoded.split(".")[1]).toMatch(/[-_]/);
    expect(roleFromAccessToken(encoded)).toBe("admin");
  });
});
