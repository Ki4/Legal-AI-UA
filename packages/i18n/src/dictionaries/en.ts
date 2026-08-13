// English. Typed against the Ukrainian dictionary, so a key added there and
// forgotten here is a compile error rather than a blank label somebody finds in
// production.

import type { Dictionary, PluralDictionary } from "./uk";

export const en: Dictionary = {
  // Shell -------------------------------------------------------------------
  "app.name": "Legal-AI-UA",
  "app.console": "Legal-AI-UA console",
  "nav.services": "Services",
  "nav.team": "Team",
  "nav.account": "Account",
  "nav.design": "Design system",
  "route.notFound": "Page not found",
  "shell.role": "Role: {role}",
  "shell.roleNone": "none",

  // Theme -------------------------------------------------------------------
  "theme.toLight": "Light theme",
  "theme.toDark": "Dark theme",

  // Language ----------------------------------------------------------------
  "language.label": "Language",

  // Authentication ----------------------------------------------------------
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.fullName": "Full name",
  "auth.signIn": "Sign in",
  "auth.register": "Register",
  "auth.noAccount": "No account?",
  "auth.haveAccount": "Already have an account?",
  "auth.signingIn": "Signing in…",
  "auth.creatingAccount": "Creating account…",
  "auth.confirmEmail": "Check your email to confirm your address, then sign in.",
  "auth.pending.title": "Awaiting approval",
  "auth.pending.body":
    "Your account has been created. Access opens once an administrator approves the registration.",
  "auth.denied.body": "Access denied — this section requires a different role.",
  "auth.pending.reSignIn":
    "After approval, sign out and sign in again — your role arrives with a fresh session.",
  "auth.signOut": "Sign out",

  // Common ------------------------------------------------------------------
  "common.loading": "Loading…",
  "common.tryAgain": "Try again",
  "common.somethingWentWrong": "Something went wrong. Please try again.",
};

/**
 * English has two plural forms against Ukrainian's three, and the type says so
 * rather than requiring empty entries: only `other` is mandatory, because that
 * is the form `Intl.PluralRules` guarantees for every locale.
 */
export const enPlurals: PluralDictionary = {
  "catalogue.matchesElsewhere": {
    one: "{count} service matches your search in other areas.",
    other: "{count} services match your search in other areas.",
  },
};
