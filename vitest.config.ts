import { defineConfig } from "vitest/config";

// One runner for the whole workspace. Tests live next to what they test, as
// `*.test.ts`, so a reader finds them without going looking — and so a file
// that loses its test is visible in the same directory listing.
//
// No globals: tests import `describe`/`it`/`expect` explicitly. That keeps the
// packages' tsconfigs unchanged and makes a test file readable on its own.
export default defineConfig({
  test: {
    include: ["{apps,packages}/*/src/**/*.test.ts"],
    environment: "node",
    reporters: ["default"],
  },
});
