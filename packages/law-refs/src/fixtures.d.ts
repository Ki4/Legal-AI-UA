// Reading a saved page in a test, without giving this package Node types.
//
// The fixtures under `fixtures/` are real HTML (§9.15 condition 3) and the tests
// need their bytes. The obvious way in — `node:fs` — costs `@types/node`, and
// this package deliberately has neither dependencies nor Node built-ins so that
// Deno reads its source unchanged (ADR-0020). Adding the types for a test would
// erode exactly the constraint that keeps the console and the edge function
// agreeing about what a norm is: the compiler would stop objecting the day
// somebody reached for `node:fs` in `src/` itself.
//
// Vite's `?raw` import gives the same bytes through the bundler both Vitest and
// the console already run, so the declaration below is the whole cost. Nothing
// in `src/index.ts` uses it, and Deno never sees a test.
declare module "*.html?raw" {
  const contents: string;
  export default contents;
}
