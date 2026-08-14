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

  "auth.error.invalidCredentials": "Wrong email or password.",
  "auth.error.emailNotConfirmed": "This address is not confirmed yet — check your email.",
  "auth.error.emailExists": "An account with this address already exists.",
  "auth.error.weakPassword": "That password is too simple. Use a longer one.",
  "auth.error.rateLimited": "Too many attempts. Try again in a few minutes.",
  "auth.error.signupDisabled": "Registration is switched off.",
  "auth.error.signInFailed": "Could not sign you in. Try again.",
  "auth.error.registerFailed": "Could not create the account. Try again.",

  // Common ------------------------------------------------------------------
  "common.loading": "Loading…",
  "common.tryAgain": "Try again",
  "common.somethingWentWrong": "Something went wrong. Please try again.",

  // Domain vocabulary -------------------------------------------------------
  "service.status.draft": "Draft",
  "service.status.in_review": "In review",
  "service.status.published": "Published",
  "service.status.paused": "Paused",
  "service.status.archived": "Archived",

  "service.generationMode.template": "Template",
  "service.generationMode.block_assembly": "Block assembly",
  "service.generationMode.full_generation": "Full generation",

  "service.reviewMode.auto": "Automatic",
  "service.reviewMode.lawyer_required": "Lawyer required",

  // Catalogue ---------------------------------------------------------------
  "catalogue.title": "Services",
  "catalogue.subtitle":
    "Filter and search live in the address bar, so a narrowed catalogue is a link.",
  "catalogue.search.placeholder": "Search title, slug or summary",
  "catalogue.search.label": "Search services",
  "catalogue.display.label": "How the catalogue is shown",
  "catalogue.display.cards": "Cards",
  "catalogue.display.table": "Table",
  "catalogue.filter.area": "Practice area",
  "catalogue.filter.status": "Status",
  "catalogue.filter.mineOnly": "Only services I am attached to",
  "catalogue.filter.on": "filtered",
  "catalogue.filter.clear": "Clear filters",
  "catalogue.loading": "Loading services",

  "catalogue.empty.none.title": "No services yet",
  "catalogue.empty.none.hint": "Create the first one — it takes minutes",
  "catalogue.empty.search.title": "Nothing matches",
  "catalogue.empty.search.hint":
    "No service matches this search. Clear the filters to see the whole catalogue.",
  "catalogue.empty.filters.title": "Nothing matches these filters",
  "catalogue.empty.filters.hint": "Clear the filters to see the whole catalogue.",
  "catalogue.empty.filters.elsewhere": "Nothing in the chosen area.",
  "catalogue.failed.title": "Could not load the catalogue",
  "catalogue.failed.hint": "Try again in a moment",

  "catalogue.error.forbidden": "You do not have access to the service catalogue.",
  "catalogue.error.notFound": "This catalogue no longer exists.",
  "catalogue.error.validation": "The filter could not be applied. Try clearing it.",
  "catalogue.error.conflict":
    "Someone changed this while you were looking. Reload to see the current state.",
  "catalogue.error.network": "Could not reach the server. Check the connection and try again.",
  "catalogue.error.unknown": "Something went wrong loading the catalogue.",

  // A service, as the catalogue and the card describe one ---------------------
  "service.field.service": "Service",
  "service.field.area": "Area",
  "service.field.accountable": "Accountable",
  "service.field.lawyer": "Lawyer",
  "service.field.version": "Version",
  "service.field.currentVersion": "Current version",
  "service.field.price": "Price",
  "service.field.status": "Status",
  "service.field.generationMode": "Generation mode",
  "service.field.reviewMode": "Review",
  "service.field.lastChanged": "Last changed",
  "service.versionShort": "v{version}",
  "service.noVersions": "no versions",
  "service.noVersionsYet": "no versions yet",
  "service.nobody": "nobody",
  "service.nameUnavailable": "name unavailable",
  "service.coverExtra": "+{count} cover",
  "service.coverExtraShort": "+{count}",

  // The service card --------------------------------------------------------
  "card.loading": "Loading service",
  "card.error.noneSelected": "No service selected.",
  "card.error.notFound": "Service not found.",
  "card.error.load": "Could not load this service.",
  "card.anatomy": "Document anatomy →",
  "card.history": "Change history →",

  // The history screen (§4.8) -----------------------------------------------
  "history.title": "Change history",
  "history.loading": "Loading the history",
  "history.field.when": "When",
  "history.field.who": "Who",
  "history.field.what": "What",
  "history.field.action": "Action",
  "history.field.changed": "Fields changed",
  "history.action.insert": "Created",
  "history.action.update": "Changed",
  "history.action.delete": "Deleted",
  "history.entity.services": "Service",
  "history.entity.service_versions": "Service version",
  "history.entity.service_version_prices": "Version price",
  "history.entity.questionnaire_fields": "Questionnaire field",
  "history.entity.service_assignments": "Lawyer assignment",
  "history.actor.unnamed": "unknown user",
  "history.actor.system": "system",
  "history.showMore": "Show more",
  "history.loadingMore": "Loading…",
  "history.empty.title": "Nothing recorded yet",
  "history.empty.hint":
    "The log records changes from the day it was added. A service created before that may have left no trace.",
  "history.restricted.title": "This history is not visible to you",
  "history.restricted.hint":
    "A lawyer sees the history of the services they are attached to. If you need this one, ask an admin to attach you.",
  "history.gone.hint":
    "Check the address — the service may have been deleted, or the link is wrong.",
  "history.failed.title": "The history did not load",
  "history.failed.hint": "That does not mean nothing happened. Try again.",
  "history.error.noneSelected": "No service selected.",
  "history.error.notFound": "Service not found.",
  "history.error.forbidden": "You do not have access to this service's history.",
  "history.error.network": "Could not reach the server. Check your connection.",
  "history.error.load": "Could not load the history.",

  // Who answers for a service (ADM-10) --------------------------------------
  "assignment.title": "Who answers for this service",
  "assignment.subtitle":
    "One lawyer is accountable. Cover carries the same rights and none of the obligation.",
  "assignment.accountable": "Accountable",
  "assignment.nobodyAccountable": "Nobody accountable",
  "assignment.nobodyAccountableHint": "This service cannot be published in this state.",
  "assignment.leaveNobody": "Leave nobody accountable",
  "assignment.cover": "Cover",
  "assignment.noCover": "Nobody is covering this service.",
  "assignment.makeAccountable": "Make accountable",
  "assignment.remove": "Remove",
  "assignment.attach": "Attach a lawyer",
  "assignment.addAsCover": "Add as cover",
  "assignment.loadingLawyers": "Loading lawyers…",
  "assignment.lawyersFailed": "Could not load the list of lawyers.",
  "assignment.noLawyers": "No approved lawyers yet.",
  "assignment.allAttached": "Every lawyer is already attached to this service.",
  "assignment.error.forbidden":
    "You may not make that change. Only an admin moves accountability, and only the accountable lawyer arranges cover.",
  "assignment.error.notFound": "This service no longer exists.",
  "assignment.error.conflict": "Someone changed it first. Reload the page.",
  "assignment.error.failed": "The change did not go through.",

  // The team screen ---------------------------------------------------------
  "team.title": "Team",
  "team.pending": "pending",
  "team.approveAsLawyer": "Approve as lawyer",
  "team.approveAsAdmin": "Approve as admin",
  "team.error.load": "Could not load the team.",
  "team.error.forbidden": "Only an admin approves registrations.",
  "team.error.notFound": "This person no longer exists.",
  "team.error.conflict": "Someone changed it first. Reload the page.",
  "team.error.network": "Could not reach the server. Check the connection and try again.",
  "team.error.approve": "Could not approve the registration.",

  // The account screen ------------------------------------------------------
  "account.title": "Account",
  "account.role": "Role",
  "account.roleNone": "not assigned",
  "account.userId": "User id",
};

/**
 * English has two plural forms against Ukrainian's three, and the type says so
 * rather than requiring empty entries: only `other` is mandatory, because that
 * is the form `Intl.PluralRules` guarantees for every locale.
 */
export const enPlurals: PluralDictionary = {
  "history.shown": {
    one: "Showing {count} entry",
    other: "Showing {count} entries",
  },
  "catalogue.matchesElsewhere": {
    one: "{count} service matches your search in other areas.",
    other: "{count} services match your search in other areas.",
  },
};
