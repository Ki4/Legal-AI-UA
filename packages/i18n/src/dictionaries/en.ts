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
  "card.law": "The norms it rests on →",

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
  "history.entity.plan_services": "Service in a plan",
  "history.entity.orders": "Order",
  "history.entity.service_law_refs": "Law reference",
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

  // Orders (ADM-66, §4.15) ---------------------------------------------------
  //
  // The client is a pseudonym on these screens, and no word here should suggest
  // a person is visible behind it.
  "nav.orders": "Orders",
  "orders.title": "Orders",
  "orders.subtitle": "Clients appear as pseudonyms. This screen shows no personal data.",
  "orders.loading": "Loading orders",
  "orders.field.client": "Client",
  "orders.field.service": "Service",
  "orders.field.version": "Version",
  "orders.field.status": "State",
  "orders.field.reviewer": "Reviewer",
  "orders.field.placed": "Placed",
  "orders.reviewer.none": "not taken",
  "orders.reviewer.unnamed": "unnamed lawyer",
  "orders.humanReview": "Client asked for a human",
  "orders.showMore": "Show more",
  "orders.loadingMore": "Loading…",
  "orders.empty.title": "No orders yet",
  "orders.empty.hint":
    "An order is placed by a client through the gateway. Until the gateway runs, this list stays empty.",
  "orders.restricted.title": "Nothing here is visible to you",
  "orders.restricted.hint":
    "A lawyer sees the orders of services they are attached to, and the ones handed to them personally.",
  "orders.failed.title": "The orders did not load",
  "orders.failed.hint": "That does not mean there are none. Try again.",
  "orders.error.forbidden": "You do not have access to the orders.",
  "orders.error.network": "Could not reach the server. Check your connection.",
  "orders.error.load": "Could not load the orders.",

  // Order states (ADR-0005, §4.16) -------------------------------------------
  "order.status.intake": "Collecting answers",
  "order.status.submitted": "Answers given",
  "order.status.generating": "Preparing the document",
  "order.status.in_review": "With a lawyer",
  "order.status.delivered": "Delivered",
  "order.status.cancelled": "Cancelled",
  "order.status.abandoned": "Abandoned",

  // The order card (ADM-66, §4.16) -------------------------------------------
  "order.loading": "Loading the order",
  "order.backToList": "← Back to orders",
  "order.field.entitlement": "Paid for by",
  "order.field.ended": "Ended",
  "order.field.stillOpen": "still open",
  "order.gone.hint": "Check the address. The order may have been deleted — or it is not yours.",
  "order.error.noneSelected": "No order selected.",
  "order.error.notFound": "Order not found.",
  "order.error.forbidden": "You do not have access to this order.",
  "order.error.network": "Could not reach the server. Check your connection.",
  "order.error.load": "Could not load the order.",

  // What it pins (§5.4) ------------------------------------------------------
  "order.pinned.frozen": "Frozen",
  "order.pinned.hint":
    "The order is pinned to this version for good. When the service is republished, the document is still explained by this one.",

  // The purchase it will be delivered under (§8.6, ADR-0019) ------------------
  "order.entitlement.none": "not paid for yet",
  // Not "nothing bought": the row exists, and reading it is administration's.
  "order.entitlement.withheld": "recorded, an admin can read it",
  "order.entitlement.oneOff": "One-off purchase",
  "order.entitlement.subscription": "Subscription",
  "order.entitlement.until": "valid until",
  "order.entitlement.untilLawChanges": "valid until the law changes",
  "order.entitlement.revoked": "Revoked",

  // The timeline is a read of the log, not a second history (§6.1) -----------
  "order.timeline.title": "What happened to it",
  "order.timeline.subtitle":
    "A read of the change log, not a record of its own. The order's state is a projection of these events.",
  "order.timeline.what": "What happened",
  "order.timeline.empty.title": "Nothing recorded yet",
  "order.timeline.empty.hint": "The log records changes from the day it was added.",

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

  // The law register (§4.11) -------------------------------------------------
  "nav.law": "Law register",
  "law.title": "Law register",
  "law.subtitle":
    "A norm is watched once. Services rest on it separately, and one norm can carry several.",
  "law.loading": "Loading the register",
  "law.empty.title": "The register holds no norms yet",
  "law.empty.hint": "A norm appears here when a lawyer adds a reference on a service's Law tab.",
  "law.failed.title": "The register did not load",
  "law.failed.hint": "That does not mean it is empty — the request did not arrive.",
  "law.error.load": "Could not load the law register.",
  "law.error.forbidden": "The law register is read by the firm's staff only.",
  "law.error.network": "Could not reach the server. Check the connection and try again.",
  "law.field.act": "Act",
  "law.field.article": "Article",
  "law.field.state": "State",
  "law.field.freshness": "Verification",
  "law.field.cadence": "Cadence",
  "law.field.dependents": "Relied on by",
  "law.wholeAct": "Whole act",
  "law.wholeActReason": "Why the whole act is tracked",
  "law.openSource": "Open the source",
  "law.source.zakon_rada": "zakon.rada.gov.ua",
  "law.dependents.none": "no service",
  "law.cadence.change": "Change the cadence",
  "law.cadence.hours": "Hours between checks",
  "law.cadence.reason": "Why not the recommended one",
  "law.cadence.reasonHint": "The cadence is shared by every service resting on this norm.",
  "law.cadence.save": "Save",
  "law.cadence.saving": "Saving",
  "law.cadence.cancel": "Cancel",
  "law.cadence.error.validation":
    "That cadence was refused: either it differs from the recommended one with no reason given, or it is slower than the maximum for a norm behind a published service.",
  "law.cadence.error.forbidden":
    "The cadence is changed by an admin, or by a lawyer on a service that rests on this norm.",
  "law.cadence.error.network": "Could not reach the server. The change was not saved.",
  "law.cadence.error.save": "Could not change the cadence.",

  "law.state.unverified": "Never checked",
  "law.state.verified": "Matches",
  "law.state.drifted": "The text moved",
  "law.state.under_review": "Being assessed",
  "law.state.impact_confirmed": "Changes the document",
  "law.state.unreachable": "Cannot be read",

  "law.freshness.never": "no successful check yet",
  "law.freshness.fresh": "checked {when}",
  "law.freshness.stale": "not checked since {when}",
  "law.freshness.staleHint":
    "This is an alarm of its own, not quiet: a broken fetcher looks exactly like perfect order.",

  // A service's law dependencies (§4.9) --------------------------------------
  "serviceLaw.title": "The norms this service rests on",
  "serviceLaw.subtitle": "One entry is one norm and one line on what it is here for.",
  "serviceLaw.loading": "Loading the law references",
  "serviceLaw.notFound.title": "No such service",
  "serviceLaw.notFound.hint": "The address looks wrong.",
  "serviceLaw.empty.title": "No norms recorded yet",
  "serviceLaw.empty.hint": "Add the first reference with the form below.",
  "serviceLaw.failed.title": "The references did not load",
  "serviceLaw.failed.hint": "That does not mean there are none — the request did not arrive.",
  "serviceLaw.error.load": "Could not load the law references.",
  "serviceLaw.error.forbidden": "These references are read by the firm's staff only.",
  "serviceLaw.error.network": "Could not reach the server. Check the connection and try again.",
  "serviceLaw.reliedOn": "Relied on for",
  "serviceLaw.remove": "Remove",
  "serviceLaw.removing": "Removing",
  "serviceLaw.remove.error": "Could not remove the reference.",
  "serviceLaw.remove.forbidden":
    "A reference is removed by an admin, or by a lawyer assigned to this service.",

  // Entry (§9.5) -------------------------------------------------------------
  "serviceLaw.add.title": "Add a law reference",
  "serviceLaw.add.url": "Link",
  "serviceLaw.add.urlHint":
    "Paste a link to the text currently in force. If you were reading a fixed revision, paste that — the system resolves it.",
  "serviceLaw.add.actTitle": "Act title",
  "serviceLaw.add.actTitleHint":
    "As lawyers call it. Used only if the register does not hold this norm yet.",
  "serviceLaw.add.article": "Article",
  "serviceLaw.add.articleHint":
    "The number alone: 105, or 75-1. Name a part or point in the line below.",
  "serviceLaw.add.wholeAct": "The dependency is on the whole act",
  "serviceLaw.add.wholeActReason": "Why the whole act",
  "serviceLaw.add.wholeActHint":
    "A whole act fires on every amendment anywhere in it. Take it only if the dependency really is that, and say why.",
  "serviceLaw.add.reliedOn": "Relied on for",
  "serviceLaw.add.reliedOnHint":
    "One line. In six months it is what tells the reader whether a change matters.",
  "serviceLaw.add.submit": "Add",
  "serviceLaw.add.submitting": "Adding",
  "serviceLaw.add.resolved": "We will watch: {act}",
  "serviceLaw.add.revisionStripped":
    "You pasted a fixed revision. We will watch the text in force — a fixed revision never changes, so watching it would never have fired.",
  "serviceLaw.add.notFetched":
    "Nobody has read the article back yet: there is no fetcher, so the article number has been checked nowhere but by you.",
  "serviceLaw.link.not_a_url": "That does not look like a link.",
  "serviceLaw.link.unknown_source": "We watch zakon.rada.gov.ua only.",
  "serviceLaw.link.not_an_act_url": "That link is not to an act's page.",
  "serviceLaw.link.unparsable_act_id":
    "Could not work out which act that is. Open the act on the site and copy the address from there.",
  "serviceLaw.article.blank": "Name the article.",
  "serviceLaw.article.unrecognized": "The article number alone: 105, or 75-1.",
  "serviceLaw.add.error.validation":
    "The entry was refused. Check the link, the article number, and the line on what the service rests on.",
  "serviceLaw.add.error.conflict": "This service already rests on that norm.",
  "serviceLaw.add.error.forbidden":
    "A reference is added by an admin, or by a lawyer assigned to this service.",
  "serviceLaw.add.error.network": "Could not reach the server. The entry was not added.",
  "serviceLaw.add.error.save": "Could not add the reference.",
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
  "orders.shown": {
    one: "Showing {count} order",
    other: "Showing {count} orders",
  },
  "catalogue.matchesElsewhere": {
    one: "{count} service matches your search in other areas.",
    other: "{count} services match your search in other areas.",
  },
  "law.dependents": {
    one: "{count} service",
    other: "{count} services",
  },
  "serviceLaw.alsoRelied": {
    one: "{count} other service rests on this norm.",
    other: "{count} other services rest on this norm.",
  },
  "law.cadence.everyHours": {
    one: "every hour",
    other: "every {count} hours",
  },
  "law.cadence.everyDays": {
    one: "every day",
    other: "every {count} days",
  },
};
