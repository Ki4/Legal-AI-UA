import { LOCALES, translate } from "@legal-ai/i18n";
import { describe, expect, it } from "vitest";
import { authErrorKey } from "./authErrors";

// The codes the auth server sends today. Listed here rather than imported from
// the vendor so that a code disappearing upstream shows up as a test somebody
// has to think about, not as a silently narrower switch.
const KNOWN = [
  "invalid_credentials",
  "email_not_confirmed",
  "email_exists",
  "user_already_exists",
  "weak_password",
  "over_email_send_rate_limit",
  "signup_disabled",
];

describe("authErrorKey", () => {
  it("gives every known code a sentence of its own", () => {
    const keys = KNOWN.map((code) => authErrorKey(code, "auth.error.signInFailed"));

    expect(keys).not.toContain("auth.error.signInFailed");
    // `email_exists` and `user_already_exists` are the same situation reported
    // under two names, so six sentences for seven codes is correct.
    expect(new Set(keys).size).toBe(6);
  });

  it("falls back for a code it has never heard of, and for none at all", () => {
    // The branch that matters most: `code` is typed `ErrorCode | (string & {})
    // | undefined` upstream, so an unrecognised value is not a hypothetical.
    expect(authErrorKey("teapot_error", "auth.error.registerFailed")).toBe(
      "auth.error.registerFailed",
    );
    expect(authErrorKey(undefined, "auth.error.signInFailed")).toBe("auth.error.signInFailed");
  });

  it("never hands a screen the other screen's sentence", () => {
    // Sign-in and registration fail differently, and a screen that borrows the
    // other's fallback tells the reader about an action they did not take.
    expect(authErrorKey("nonsense", "auth.error.signInFailed")).not.toBe(
      "auth.error.registerFailed",
    );
    expect(authErrorKey("nonsense", "auth.error.registerFailed")).not.toBe(
      "auth.error.signInFailed",
    );
  });

  it("returns keys that resolve in every locale", () => {
    // Invoked, not merely defined (DoD §8): a key that exists in the type and
    // not in a dictionary would pass every assertion above and render nothing.
    for (const code of [...KNOWN, "unknown_code", undefined]) {
      const key = authErrorKey(code, "auth.error.signInFailed");

      for (const locale of LOCALES) {
        const rendered = translate(locale, key);

        expect(rendered.trim()).not.toBe("");
        expect(rendered).not.toBe(key);
      }
    }
  });
});
