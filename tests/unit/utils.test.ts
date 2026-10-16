import { describe, expect, it } from "vitest";

import {
  cn,
  clamp,
  percentage,
  initials,
  truncate,
  slugify,
  groupBy,
  sum,
  unique,
  entriesOf,
  isNonEmptyString,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "no", "yes")).toBe("base yes");
  });

  it("deduplicates conflicting tailwind classes keeping the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps to min", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("handles boundary values", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("percentage", () => {
  it("computes a percentage", () => {
    expect(percentage(1, 4)).toBe(25);
    expect(percentage(3, 4)).toBe(75);
  });

  it("returns 0 when whole is zero or negative", () => {
    expect(percentage(5, 0)).toBe(0);
    expect(percentage(5, -1)).toBe(0);
  });

  it("clamps to 0 and 100", () => {
    expect(percentage(0, 10)).toBe(0);
    expect(percentage(10, 10)).toBe(100);
    expect(percentage(15, 10)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
  });
});

describe("initials", () => {
  it("extracts initials from a full name", () => {
    expect(initials("John Doe")).toBe("JD");
  });

  it("handles single name", () => {
    expect(initials("Alice")).toBe("A");
  });

  it("handles more than two words using first two", () => {
    expect(initials("John Middle Doe")).toBe("JM");
  });

  it("returns ? for null, undefined, or empty", () => {
    expect(initials(null)).toBe("?");
    expect(initials(undefined)).toBe("?");
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("handles extra whitespace", () => {
    expect(initials("  John   Doe  ")).toBe("JD");
  });
});

describe("truncate", () => {
  it("returns the original string when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and adds ellipsis when exceeding limit", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });

  it("handles exact boundary", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("slugify", () => {
  it("converts to lowercase and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric runs with single hyphens", () => {
    expect(slugify("Hello   World!!")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long)).toBe("a".repeat(60));
  });

  it("handles empty result", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("groupBy", () => {
  it("groups items by a key function", () => {
    const items = [
      { type: "a", val: 1 },
      { type: "b", val: 2 },
      { type: "a", val: 3 },
    ];
    const result = groupBy(items, (i) => i.type);
    expect(result).toEqual({
      a: [
        { type: "a", val: 1 },
        { type: "a", val: 3 },
      ],
      b: [{ type: "b", val: 2 }],
    });
  });

  it("returns an empty object for an empty array", () => {
    expect(groupBy([], (x) => x)).toEqual({});
  });
});

describe("sum", () => {
  it("sums an array of numbers", () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  it("returns 0 for an empty array", () => {
    expect(sum([])).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(sum([-1, 1])).toBe(0);
  });
});

describe("unique", () => {
  it("removes duplicate values", () => {
    expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it("preserves order of first occurrence", () => {
    expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });

  it("handles an empty array", () => {
    expect(unique([])).toEqual([]);
  });

  it("handles an array with no duplicates", () => {
    expect(unique([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe("entriesOf", () => {
  it("returns typed entries of an object", () => {
    const obj = { a: 1, b: "two" };
    expect(entriesOf(obj)).toEqual([
      ["a", 1],
      ["b", "two"],
    ]);
  });

  it("returns an empty array for an empty object", () => {
    expect(entriesOf({})).toEqual([]);
  });
});

describe("isNonEmptyString", () => {
  it("returns true for a non-empty string", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("returns false for an empty or whitespace-only string", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
  });
});
