// Runs before every `*.test.tsx` file — see the `dom` project in the root
// `vitest.config.ts`.

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library registers this itself when `globals: true`. This
// workspace deliberately has no globals, so RTL finds no global `afterEach` to
// hook and silently does nothing — which does not fail, it accumulates. The
// second test in a file would query a document still holding the first test's
// render, and `getByText` would throw "found multiple elements" for a reason
// that has nothing to do with the component.
//
// `cleanup` unmounts rather than clearing the body: unmounting runs effect
// teardown, so a hook's `cancelled` flag and its timers stop before the next
// test starts. Wiping `innerHTML` would leave both running.
afterEach(cleanup);
