/**
 * Unit tests for GinRummyGameScreen sort helpers.
 * ginRankIdx and ginSuitIdx are pure functions exported for testability.
 */

import { describe, it, expect } from "vitest";
import { ginRankIdx, ginSuitIdx } from "../../src/components/GinRummyGameScreen";

// ---------------------------------------------------------------------------
// ginRankIdx
// ---------------------------------------------------------------------------

describe("ginRankIdx", () => {
  it("returns 0 for Ace", () => {
    expect(ginRankIdx("AH")).toBe(0);
    expect(ginRankIdx("AS")).toBe(0);
  });

  it("returns correct indices for number cards", () => {
    expect(ginRankIdx("2C")).toBe(1);
    expect(ginRankIdx("5D")).toBe(4);
    expect(ginRankIdx("9H")).toBe(8);
  });

  it("returns 9 for Ten (T)", () => {
    expect(ginRankIdx("TC")).toBe(9);
  });

  it("returns 10 for Jack", () => {
    expect(ginRankIdx("JD")).toBe(10);
  });

  it("returns 11 for Queen", () => {
    expect(ginRankIdx("QH")).toBe(11);
  });

  it("returns 12 for King", () => {
    expect(ginRankIdx("KS")).toBe(12);
  });

  it("orders A < 2 < T < J < Q < K", () => {
    const cards = ["KH", "AH", "TH", "2H", "QH", "JH"];
    const sorted = [...cards].sort((a, b) => ginRankIdx(a) - ginRankIdx(b));
    expect(sorted).toEqual(["AH", "2H", "TH", "JH", "QH", "KH"]);
  });
});

// ---------------------------------------------------------------------------
// ginSuitIdx
// ---------------------------------------------------------------------------

describe("ginSuitIdx", () => {
  it("returns 0 for Clubs", () => {
    expect(ginSuitIdx("AC")).toBe(0);
    expect(ginSuitIdx("KC")).toBe(0);
  });

  it("returns 1 for Diamonds", () => {
    expect(ginSuitIdx("7D")).toBe(1);
  });

  it("returns 2 for Hearts", () => {
    expect(ginSuitIdx("JH")).toBe(2);
  });

  it("returns 3 for Spades", () => {
    expect(ginSuitIdx("QS")).toBe(3);
  });

  it("orders C < D < H < S", () => {
    const cards = ["AS", "AH", "AC", "AD"];
    const sorted = [...cards].sort((a, b) => ginSuitIdx(a) - ginSuitIdx(b));
    expect(sorted).toEqual(["AC", "AD", "AH", "AS"]);
  });
});

// ---------------------------------------------------------------------------
// Sort by rank (primary) + suit (tiebreaker)
// ---------------------------------------------------------------------------

describe("sort by rank then suit", () => {
  it("sorts a mixed hand correctly", () => {
    const hand = ["KS", "AH", "2C", "TC", "JD", "AS", "2D"];
    const sorted = [...hand].sort(
      (a, b) => ginRankIdx(a) - ginRankIdx(b) || ginSuitIdx(a) - ginSuitIdx(b),
    );
    expect(sorted).toEqual(["AH", "AS", "2C", "2D", "TC", "JD", "KS"]);
  });
});

// ---------------------------------------------------------------------------
// Sort by suit (primary) + rank (tiebreaker)
// ---------------------------------------------------------------------------

describe("sort by suit then rank", () => {
  it("groups by suit, ranks ascending within each suit", () => {
    const hand = ["7H", "3C", "KC", "2H", "AS", "AD"];
    const sorted = [...hand].sort(
      (a, b) => ginSuitIdx(a) - ginSuitIdx(b) || ginRankIdx(a) - ginRankIdx(b),
    );
    // C: 3C KC | D: AD | H: 2H 7H | S: AS
    expect(sorted).toEqual(["3C", "KC", "AD", "2H", "7H", "AS"]);
  });
});

// ---------------------------------------------------------------------------
// localOrder reconciliation logic (pure function extracted for testing)
// ---------------------------------------------------------------------------

describe("localOrder reconciliation", () => {
  function reconcile(prev: string[] | null, next: string[]): string[] {
    if (!prev) return next;
    const kept = prev.filter((c) => next.includes(c));
    const added = next.filter((c) => !prev.includes(c));
    return [...kept, ...added];
  }

  it("initializes from server order when no local order exists", () => {
    expect(reconcile(null, ["AH", "2C", "3D"])).toEqual(["AH", "2C", "3D"]);
  });

  it("preserves local order for existing cards", () => {
    const prev = ["3D", "AH", "2C"];
    const next = ["AH", "2C", "3D"]; // server reordered
    expect(reconcile(prev, next)).toEqual(["3D", "AH", "2C"]); // local order wins
  });

  it("appends newly drawn card at the end", () => {
    const prev = ["AH", "2C", "3D"];
    const next = ["AH", "2C", "3D", "KS"]; // KS drawn
    expect(reconcile(prev, next)).toEqual(["AH", "2C", "3D", "KS"]);
  });

  it("removes discarded card while preserving order of remaining", () => {
    const prev = ["AH", "2C", "3D", "KS"];
    const next = ["AH", "3D", "KS"]; // 2C discarded
    expect(reconcile(prev, next)).toEqual(["AH", "3D", "KS"]);
  });

  it("handles draw + discard in the same hand (net neutral)", () => {
    const prev = ["AH", "2C", "3D"];
    const next = ["AH", "3D", "JS"]; // 2C discarded, JS drawn
    expect(reconcile(prev, next)).toEqual(["AH", "3D", "JS"]);
  });
});
