// The contract. This file is what two people agree on before either writes
// anything: one implements it, the other calls it, and the compiler holds
// both to the deal (ADR-0012).
//
// One method, and no mutations: this screen only renders what the core
// produced. A lawyer editing a block is a different screen's contract, not
// this one's.

import type { GenerationTraceView } from "./types";

export interface AnatomyApi {
  /** The generation trace for a service. */
  getTrace(serviceId: string): Promise<GenerationTraceView>;
}
