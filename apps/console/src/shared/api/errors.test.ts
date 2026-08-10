import { describe, expect, it } from "vitest";
import { AppError, expectOne } from "./errors";

describe("AppError", () => {
  it("carries a code and behaves like an Error", () => {
    const error = new AppError("forbidden", "nope");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("forbidden");
    expect(error.name).toBe("AppError");
    expect(error.message).toBe("nope");
  });

  it("keeps the underlying cause for a log without exposing it in the message", () => {
    const cause = new Error("PostgrestError: 42501");
    const error = new AppError("forbidden", "You may not do that.", { cause });
    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain("42501");
  });
});

describe("expectOne", () => {
  it("returns the single row", () => {
    expect(expectOne([{ id: "a" }], "read a thing")).toEqual({ id: "a" });
  });

  it("turns an empty result into forbidden, which is the whole point", () => {
    // A write denied by an RLS USING clause is not an error: Postgres filters
    // the row out, the UPDATE matches nothing, and Supabase returns
    // `{ data: [], error: null }`. Without this, the caller reports success for
    // a write that never happened.
    expect(() => expectOne([], "assign a lawyer")).toThrowError(AppError);
    try {
      expectOne([], "assign a lawyer");
    } catch (error) {
      expect((error as AppError).code).toBe("forbidden");
      expect((error as AppError).message).toContain("assign a lawyer");
    }
  });

  it("treats more than one row as a conflict rather than picking the first", () => {
    try {
      expectOne([{ id: "a" }, { id: "b" }], "update a service");
      throw new Error("should not reach here");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("conflict");
    }
  });

  it("does not mistake a falsy row for no row", () => {
    // `rows[0]` being 0, "" or null must still count as one row — only
    // `undefined` means the array was empty.
    expect(expectOne([0], "count")).toBe(0);
    expect(expectOne([""], "label")).toBe("");
    expect(expectOne([null], "nullable row")).toBeNull();
  });
});
