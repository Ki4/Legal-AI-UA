// The two pieces of Deno this repository uses, declared so that tsc can check
// the file that uses them.
//
// The alternative was to exclude `index.ts` from the TypeScript project and let
// Deno be the only thing that ever reads it — which would have left the one
// file the test suite cannot reach also unchecked by the compiler. This is four
// lines instead, and they are deliberately the *narrow* four: `Deno.serve` and
// `Deno.env.get`, and nothing else. Declaring the whole namespace would make
// every Deno API compile here, including the ones that would then be invisible
// to a reviewer asking what this function is allowed to touch.
//
// Not `@types/deno` or the `deno.ns` lib, for the same reason and one more: a
// dependency that exists to describe another runtime's globals is a version to
// keep in step with a runtime the CLI chooses (`deno_version = 2` in
// `supabase/config.toml`).

declare namespace Deno {
  /** Starts the HTTP server. The whole of a function's entry point. */
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;

  const env: {
    /** Undefined rather than throwing, which is why every caller checks. */
    get(key: string): string | undefined;
  };
}
