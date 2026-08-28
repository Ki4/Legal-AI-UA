// What this holds the screen to is the pair §4 and §6 ask for together: that
// waiting, empty, failed and rendered are four screens rather than one, and
// that each of them reaches its sentence through a key. Both are claims the
// compiler cannot make — all four branches return JSX, all four compile, and
// the only difference is what a lawyer reads.
//
// The seam is `../api`, the feature's own contract (ADR-0012), for the reason
// `ServicesListPage.test.tsx` states: mocking the boundary is using it for what
// it is for, and reaching past it would be testing a fixture's delay.

import { DEFAULT_LOCALE, I18nProvider, translate, type TranslationKey } from "@legal-ai/i18n";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/api/errors";
import type { GenerationTraceView, TraceBlockView } from "../api";
import { AnatomyPage } from "./AnatomyPage";

const { getTrace } = vi.hoisted(() => ({
  getTrace: vi.fn<() => Promise<GenerationTraceView>>(),
}));

vi.mock("../api", () => ({
  anatomyApi: { getTrace },
}));

// The dictionary is the source of the expected text: asserting on the Ukrainian
// sentence would turn every rewording red while still not proving the screen
// picked the right key. The claim under test is which key each state renders.
const t = (key: TranslationKey) => translate(DEFAULT_LOCALE, key);

function block(overrides: Partial<TraceBlockView> = {}): TraceBlockView {
  return {
    id: "blk-1",
    title: "Вимоги позивача",
    trust: "template",
    needsAttention: false,
    selectedBy: null,
    lawRefs: [],
    questionnaireFields: [],
    toolCalls: [],
    ...overrides,
  };
}

function renderAnatomy() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={["/services/svc-divorce/anatomy"]}>
        <Routes>
          <Route path="/services/:serviceId/anatomy" element={<AnatomyPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("AnatomyPage", () => {
  beforeEach(() => {
    getTrace.mockReset();
  });

  it("announces the wait rather than showing an empty document", () => {
    // Never resolves: the loading state is the subject, and a promise that
    // settles would make this a race against the assertion.
    getTrace.mockReturnValue(new Promise(() => {}));

    renderAnatomy();

    expect(screen.getByRole("status").textContent).toContain(t("anatomy.loading"));
    expect(screen.queryByText(t("anatomy.empty"))).toBeNull();
  });

  it("says the document has not been generated when the trace carries no blocks", async () => {
    getTrace.mockResolvedValue({ serviceId: "svc-divorce", blocks: [] });

    renderAnatomy();

    expect(await screen.findByText(t("anatomy.empty"))).toBeDefined();
  });

  it("renders a block with the words its trust is read as", async () => {
    getTrace.mockResolvedValue({
      serviceId: "svc-divorce",
      blocks: [block({ trust: "ai_generated", needsAttention: true })],
    });

    renderAnatomy();

    expect(await screen.findByText("Вимоги позивача")).toBeDefined();
    expect(screen.getByText(t("anatomy.trust.ai_generated"))).toBeDefined();
    // "needs-review" is the only Confidence state that renders at all — §8.2's
    // rule that a confident block says nothing.
    expect(screen.getByText(t("anatomy.needsReview"))).toBeDefined();
  });

  it("keeps a confident block quiet", async () => {
    getTrace.mockResolvedValue({ serviceId: "svc-divorce", blocks: [block()] });

    renderAnatomy();

    expect(await screen.findByText("Вимоги позивача")).toBeDefined();
    expect(screen.queryByText(t("anatomy.needsReview"))).toBeNull();
  });

  it("says why a block is in the document, and says so when nothing decided it", async () => {
    getTrace.mockResolvedValue({
      serviceId: "svc-divorce",
      blocks: [
        block({ id: "blk-1", title: "Аліменти", selectedBy: null }),
        block({
          id: "blk-2",
          title: "Поділ майна",
          selectedBy: { expression: "children is empty", fieldKeys: ["children"] },
        }),
      ],
    });

    renderAnatomy();

    // The unconditional block gets a sentence of its own. "Nothing selected
    // this" and "we did not show you what did" are the two readings a blank
    // line leaves open, and only one of them is true.
    expect(await screen.findByText(t("anatomy.selectedBy.unconditional"))).toBeDefined();
    expect(
      screen.getByText(
        translate(DEFAULT_LOCALE, "anatomy.selectedBy", {
          expression: "children is empty",
        }),
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        translate(DEFAULT_LOCALE, "anatomy.selectedBy.fields", { fields: "children" }),
      ),
    ).toBeDefined();
  });

  it("names each tool call and how it ended, in the order they ran", async () => {
    getTrace.mockResolvedValue({
      serviceId: "svc-divorce",
      blocks: [
        block({
          toolCalls: [
            { tool: "retrieve_norm_text", outcome: "error" },
            { tool: "retrieve_norm_text", outcome: "ok" },
          ],
        }),
      ],
    });

    renderAnatomy();

    // One tool called twice — the retry — is the case that has to survive:
    // both entries render, and the failure is not swallowed by the success
    // that followed it.
    const calls = await screen.findAllByText("retrieve_norm_text");
    expect(calls).toHaveLength(2);
    expect(screen.getByText(t("anatomy.toolCall.error"))).toBeDefined();
    expect(screen.getByText(t("anatomy.toolCall.ok"))).toBeDefined();
  });

  it("reads a failure by its code, not by its message", async () => {
    getTrace.mockRejectedValue(new AppError("forbidden", "row not visible to this JWT"));

    renderAnatomy();

    expect(await screen.findByText(t("anatomy.error.forbidden"))).toBeDefined();
    expect(screen.queryByText(t("anatomy.empty"))).toBeNull();
    expect(screen.queryByText("row not visible to this JWT")).toBeNull();
  });

  it("falls back to one sentence for a failure that is not an AppError", async () => {
    getTrace.mockRejectedValue(new Error("boom"));

    renderAnatomy();

    expect(await screen.findByText(t("anatomy.error.unknown"))).toBeDefined();
  });
});
