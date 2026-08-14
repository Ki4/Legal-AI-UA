import { defineConfig } from "vitest/config";

// One runner for the whole workspace, two environments. Tests live next to what
// they test, as `*.test.ts` or `*.test.tsx`, so a reader finds them without
// going looking — and so a file that loses its test is visible in the same
// directory listing.
//
// No globals: tests import `describe`/`it`/`expect` explicitly. That keeps the
// packages' tsconfigs unchanged and makes a test file readable on its own.
//
// The split is by extension, and it is not cosmetic. A component test has to
// render, which needs a DOM; nothing else should quietly acquire one, because a
// `document` that exists in the test and not in the code under test is how a
// unit test starts passing for a reason production does not have. `.tsx` is
// exactly the set of files carrying JSX, which is exactly the set that renders,
// so the rule needs nothing anybody has to remember — and both projects are
// collected, so a component test cannot be silently left out of the run.
//
// `environmentMatchGlobs` said this in one line and was removed in Vitest 4;
// `projects` is what replaced it.
export default defineConfig({
  test: {
    reporters: ["default"],
    projects: [
      {
        test: {
          name: "unit",
          include: ["{apps,packages}/*/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "dom",
          include: ["{apps,packages}/*/src/**/*.test.tsx"],
          environment: "jsdom",
          // Unmounts the previous test's render. A package that grows component
          // tests of its own brings its setup file into this array — the glob
          // above already collects it, which is the half that would otherwise
          // be forgotten.
          setupFiles: ["./apps/console/src/test/setup.ts"],
          // `apps/console/src/app/supabase.ts` throws on import when these are
          // absent, and every screen reaches it through `useAuth`. The values
          // are the local sandbox's on purpose: a test that somehow does issue a
          // request gets a refused connection rather than reaching anything
          // real.
          env: {
            VITE_SUPABASE_URL: "http://127.0.0.1:54321",
            VITE_SUPABASE_ANON_KEY: "test-anon-key",
          },
        },
      },
    ],
  },
});
