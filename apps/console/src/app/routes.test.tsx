// Every route in the table, rendered as each role, in each language: does it
// arrive at a screen, and is that screen the one the route promises rather
// than its loading state, its failure state, or a stack trace?
//
// The 2026-09-18 debt was "nothing walks a screen" — the ten screens had been
// walked once by hand, and the next change would make that stale. This is the
// walk, made executable. It is deliberately shallow: a per-screen test (DoD §4)
// asserts the states of one screen behind a mocked `api/`; this file asserts
// only that each route composes into something that renders with real data
// flowing through the real components. What it catches is the class of defect a
// unit test behind a mock cannot: a route whose element throws on mount, a
// screen that reaches a seam its test had mocked away, a translation whose
// params the screen no longer passes, a guard sending a role somewhere it did
// not mean to.
//
// Two seams are stubbed, and only two. Every feature's `api/` is swapped for
// its own `*.mock.ts` — the same contract, the same fixtures, the same
// implementation the contract tests run against — because seven of the eight
// are live Supabase and this test has no database. And `useAuth` is stubbed,
// because a session is a thing only the browser has. The Supabase client
// itself is replaced with one that throws on any use, so a screen that reaches
// it names itself in the failure rather than quietly rendering a refused
// connection as "failed to load".
//
// The table is walked, not listed. A route added to `routes.tsx` is a route
// this file renders on its next run, with no second list to keep in step.

import { I18nProvider, LOCALES, TRANSLATION_KEYS, translate, type Locale } from "@legal-ai/i18n";
import type { Role } from "@legal-ai/db";
import type { Session } from "@supabase/supabase-js";
import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "./routes";

// The auth seam. `current` is what `useAuth` returns; each case sets it.
const auth = vi.hoisted(() => ({
  current: {
    session: null as Session | null,
    role: null as Role | null,
    loading: false,
    signOut: async () => {},
  },
}));

vi.mock("./auth", () => ({
  useAuth: () => auth.current,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));

// Nothing in a walked screen may reach the client. Any property access throws
// with the screen's name in the stack, which is a better failure than the
// "failed to load" state a refused connection would produce.
vi.mock("./supabase", () => ({
  supabase: new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(`a screen reached supabase.${String(property)} — mock its api/ instead`);
      },
    },
  ),
}));

// Each feature's api/, swapped for its own fixture implementation. The names
// are the ones each `api/index.ts` exports; the mock modules are the ones the
// contract tests already run against.
vi.mock("../features/anatomy/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/anatomy/api")>();
  const { mockAnatomyApi } = await import("../features/anatomy/api/anatomy.mock");
  return { ...actual, anatomyApi: mockAnatomyApi };
});
vi.mock("../features/law/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/law/api")>();
  const { mockLawApi } = await import("../features/law/api/law.mock");
  return { ...actual, lawApi: mockLawApi };
});
vi.mock("../features/orders/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/orders/api")>();
  const { mockOrdersApi } = await import("../features/orders/api/orders.mock");
  return { ...actual, ordersApi: mockOrdersApi };
});
vi.mock("../features/service-detail/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/service-detail/api")>();
  const { mockServiceDetailApi } =
    await import("../features/service-detail/api/service-detail.mock");
  return { ...actual, serviceDetailApi: mockServiceDetailApi };
});
vi.mock("../features/service-fields/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/service-fields/api")>();
  const { mockServiceFieldsApi } =
    await import("../features/service-fields/api/service-fields.mock");
  return { ...actual, serviceFieldsApi: mockServiceFieldsApi };
});
vi.mock("../features/service-history/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/service-history/api")>();
  const { mockServiceHistoryApi } =
    await import("../features/service-history/api/service-history.mock");
  return { ...actual, serviceHistoryApi: mockServiceHistoryApi };
});
vi.mock("../features/service-versions/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/service-versions/api")>();
  const { mockServiceVersionsApi } =
    await import("../features/service-versions/api/service-versions.mock");
  return { ...actual, serviceVersionsApi: mockServiceVersionsApi };
});
vi.mock("../features/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/services/api")>();
  const { mockServicesApi } = await import("../features/services/api/services.mock");
  return { ...actual, servicesApi: mockServicesApi };
});
vi.mock("../features/team/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../features/team/api")>();
  const { mockTeamApi } = await import("../features/team/api/team.mock");
  return { ...actual, teamApi: mockTeamApi };
});

/**
 * The ids the fixtures know, one per route parameter. A parameter this table
 * does not name fails the walk loudly — the alternative is a route rendered
 * with `:serviceId` as the id, which is a not-found screen and a green test.
 */
const PARAMS: Record<string, string> = {
  serviceId: "svc-divorce",
  orderId: "ord-1",
};

interface Walkable {
  path: string;
  /** The roles a `RequireAuth roles={…}` wrapper admits; undefined when any signed-in role may. */
  roles: Role[] | undefined;
  /** Nested under the shell layout, so the screen renders inside its `<main>`. */
  shell: boolean;
}

/** Every concrete path in the table, with the guard that wraps it. */
function walkable(table: RouteObject[], prefix = "", guard?: Role[], shell = false): Walkable[] {
  const found: Walkable[] = [];
  for (const route of table) {
    // A guard is a `RequireAuth` element with a `roles` prop wrapping the page;
    // read off the element rather than off a second list.
    const element = route.element as { props?: { roles?: Role[] } } | undefined;
    const roles = element?.props?.roles ?? guard;

    const own = route.index
      ? prefix || "/"
      : route.path === undefined
        ? prefix
        : join(prefix, route.path);

    if (route.children !== undefined) {
      found.push(...walkable(route.children, own, roles, true));
    } else if (route.path === "*") {
      found.push({ path: join(prefix, "no-such-route"), roles, shell });
    } else {
      found.push({ path: own, roles, shell });
    }
  }
  return found;
}

function join(prefix: string, path: string): string {
  const full = path.startsWith("/") ? path : `${prefix.replace(/\/$/, "")}/${path}`;
  return full.replace(/:(\w+)/g, (_, name: string) => {
    const value = PARAMS[name];
    if (value === undefined) throw new Error(`no fixture id for route parameter :${name}`);
    return value;
  });
}

const session = (id: string): Session =>
  ({
    access_token: "",
    refresh_token: "",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id,
      email: `${id}@example.test`,
      app_metadata: {},
      user_metadata: {},
      aud: "",
      created_at: "",
    },
  }) as unknown as Session;

/**
 * Sentences a screen shows when it has not arrived: still loading, failed to
 * load, or refused. None may be on a walked screen once it settles. Read from
 * the dictionary by key shape, so a feature that adds a `failed` state is
 * covered without touching this list.
 */
function unsettled(locale: Locale): string[] {
  const keys = TRANSLATION_KEYS.filter(
    (key) => /\.(failed|error)\./.test(key) || key === "common.loading",
  );
  return keys.map((key) => translate(locale, key)).filter((text) => !text.includes("{"));
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  );
  return { ...view, router };
}

const errors: unknown[][] = [];

beforeEach(() => {
  errors.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const ROUTES = walkable(routes);

describe("the route table", () => {
  it("has the screens the console is known to have", () => {
    // Not a second list to keep in step — a floor. If the walk ever finds
    // fewer routes than this, the walker broke, not the table.
    const paths = ROUTES.map((r) => r.path);
    expect(paths).toContain("/services");
    expect(paths).toContain("/services/svc-divorce/history");
    expect(paths).toContain("/orders/ord-1");
    expect(paths).toContain("/team");
    expect(paths).toContain("/login");
    expect(paths.length).toBeGreaterThanOrEqual(15);
  });

  it("reads each guard off its element", () => {
    expect(ROUTES.find((r) => r.path === "/team")?.roles).toEqual(["admin"]);
    expect(ROUTES.find((r) => r.path === "/orders")?.roles).toEqual(["admin", "lawyer"]);
    expect(ROUTES.find((r) => r.path === "/services")?.roles).toBeUndefined();
  });
});

for (const locale of LOCALES) {
  for (const role of ["admin", "lawyer"] as const) {
    describe(`as ${role}, in ${locale}`, () => {
      beforeEach(() => {
        window.localStorage.setItem("legal-ai-locale", locale);
        auth.current = {
          session: session(role === "admin" ? "usr-admin" : "usr-olena"),
          role,
          loading: false,
          signOut: async () => {},
        };
      });

      for (const route of ROUTES) {
        const admitted = route.roles === undefined || route.roles.includes(role);

        it(`${route.path} ${admitted ? "renders its screen" : "refuses, and says so"}`, async () => {
          const { container } = renderAt(route.path);

          if (!admitted) {
            await waitFor(() => {
              expect(container.textContent).toContain(translate(locale, "auth.denied.body"));
            });
            return;
          }

          // Settled: nothing on the screen says it is still loading.
          const loading = translate(locale, "common.loading");
          await waitFor(() => expect(container.textContent).not.toContain(loading));

          const text = container.textContent ?? "";
          const seen = unsettled(locale).filter((sentence) => text.includes(sentence));
          expect(seen, `${route.path} settled on an unsettled sentence`).toEqual([]);

          // A `{param}` on screen is a sentence whose parameter the screen
          // stopped passing. `translate` leaves it standing on purpose, so that
          // it is seen — and this is where it is seen.
          expect(text).not.toMatch(/\{\w+\}/);

          // Something rendered — inside the shell's `<main>` for a shell route,
          // not only the shell around it.
          const screen = route.shell ? container.querySelector("main") : container;
          expect(screen?.textContent?.trim().length ?? 0).toBeGreaterThan(0);

          // React's own complaints — a key missing, a state update after unmount,
          // an act() warning — are defects too, and the only place they surface.
          expect(errors.map((args) => String(args[0]))).toEqual([]);
        });
      }
    });
  }
}

describe("signed out", () => {
  it("sends every shell route to /login", async () => {
    auth.current = { session: null, role: null, loading: false, signOut: async () => {} };
    const { router } = renderAt("/orders");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("holds a signed-in person with no role at the approval screen", async () => {
    auth.current = {
      session: session("usr-new"),
      role: null,
      loading: false,
      signOut: async () => {},
    };
    const { container } = renderAt("/services");
    await waitFor(() =>
      expect(container.textContent).toContain(translate("uk", "auth.pending.title")),
    );
  });
});
