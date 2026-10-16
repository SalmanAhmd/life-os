import { describe, expect, it } from "vitest";

import { ok, fail, zodFieldErrors } from "@/lib/action-result";

describe("ok", () => {
  it("returns a success result with the provided data", () => {
    const result = ok({ id: "123" });
    expect(result).toEqual({ ok: true, data: { id: "123" } });
  });

  it("works with primitive data", () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 });
    expect(ok("done")).toEqual({ ok: true, data: "done" });
  });

  it("works with undefined data", () => {
    expect(ok(undefined)).toEqual({ ok: true, data: undefined });
  });
});

describe("fail", () => {
  it("returns a failure result with an error message", () => {
    const result = fail("Something went wrong");
    expect(result).toEqual({ ok: false, error: "Something went wrong" });
  });

  it("includes field errors when provided", () => {
    const result = fail("Validation failed", { title: ["Title is required"] });
    expect(result).toEqual({
      ok: false,
      error: "Validation failed",
      fieldErrors: { title: ["Title is required"] },
    });
  });

  it("works without field errors", () => {
    const result = fail("Not found");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toBeUndefined();
    }
  });
});

describe("zodFieldErrors", () => {
  it("maps flattened Zod field errors to our shape", () => {
    const zodError = {
      flatten: () => ({
        fieldErrors: {
          title: ["Title is required"],
          email: ["Invalid email"],
        },
      }),
    };
    expect(zodFieldErrors(zodError)).toEqual({
      title: ["Title is required"],
      email: ["Invalid email"],
    });
  });

  it("skips fields with empty error arrays", () => {
    const zodError = {
      flatten: () => ({
        fieldErrors: {
          title: ["Required"],
          description: [],
        },
      }),
    };
    expect(zodFieldErrors(zodError)).toEqual({
      title: ["Required"],
    });
  });

  it("skips fields with undefined errors", () => {
    const zodError = {
      flatten: () => ({
        fieldErrors: {
          title: undefined,
          email: ["Invalid"],
        },
      }),
    };
    expect(zodFieldErrors(zodError)).toEqual({
      email: ["Invalid"],
    });
  });

  it("returns an empty object when there are no field errors", () => {
    const zodError = {
      flatten: () => ({
        fieldErrors: {},
      }),
    };
    expect(zodFieldErrors(zodError)).toEqual({});
  });
});
