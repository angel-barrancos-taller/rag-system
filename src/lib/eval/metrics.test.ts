import {
  matchesRelevant,
  mean,
  meanReciprocalRank,
  precisionAtK,
  recallAtK,
  reciprocalRank,
} from "./metrics";

describe("matchesRelevant", () => {
  it("matches an exact chunk id", () => {
    expect(
      matchesRelevant("src/cart.ts#Cart.getTotal", "src/cart.ts#Cart.getTotal"),
    ).toBe(true);
    expect(
      matchesRelevant("src/cart.ts#Cart.addItem", "src/cart.ts#Cart.getTotal"),
    ).toBe(false);
  });

  it("matches any chunk of a file when the relevant id is a bare file path", () => {
    expect(matchesRelevant("src/format.ts#file", "src/format.ts")).toBe(true);
    expect(matchesRelevant("src/format.ts#window-2", "src/format.ts")).toBe(
      true,
    );
    expect(matchesRelevant("src/other.ts#file", "src/format.ts")).toBe(false);
  });

  it("does not treat a path prefix as a match", () => {
    expect(matchesRelevant("src/format-extra.ts#file", "src/format.ts")).toBe(
      false,
    );
  });
});

describe("precisionAtK", () => {
  const relevant = ["a#f1", "b#f2"];

  it("computes the fraction of the top K that is relevant", () => {
    const retrieved = ["a#f1", "x#g", "b#f2", "y#g", "z#g"];
    expect(precisionAtK(retrieved, relevant, 5)).toBeCloseTo(2 / 5);
  });

  it("divides by k even when fewer than k results were retrieved", () => {
    expect(precisionAtK(["a#f1"], relevant, 5)).toBeCloseTo(1 / 5);
  });

  it("only considers the first k results", () => {
    const retrieved = ["x#g", "y#g", "a#f1"];
    expect(precisionAtK(retrieved, relevant, 2)).toBe(0);
  });

  it("returns 0 for empty retrieval", () => {
    expect(precisionAtK([], relevant, 5)).toBe(0);
  });

  it("throws on k < 1", () => {
    expect(() => precisionAtK(["a#f1"], relevant, 0)).toThrow();
  });

  it("counts each relevant id at most once even with duplicate retrievals", () => {
    expect(
      precisionAtK(["a#f1", "a#f1", "a#f1", "x#g", "y#g"], relevant, 5),
    ).toBeCloseTo(1 / 5);
  });
});

describe("recallAtK", () => {
  const relevant = ["a#f1", "b#f2", "c#f3"];

  it("computes the fraction of relevant items found in the top K", () => {
    expect(recallAtK(["a#f1", "x#g", "b#f2"], relevant, 3)).toBeCloseTo(2 / 3);
  });

  it("is 1 when all relevant items are retrieved within k", () => {
    expect(recallAtK(["a#f1", "b#f2", "c#f3"], relevant, 3)).toBe(1);
  });

  it("is 0 when nothing relevant is retrieved", () => {
    expect(recallAtK(["x#g", "y#g"], relevant, 2)).toBe(0);
  });

  it("returns 0 when there are no relevant ids", () => {
    expect(recallAtK(["x#g"], [], 1)).toBe(0);
  });

  it("respects the k cutoff", () => {
    expect(recallAtK(["x#g", "a#f1"], relevant, 1)).toBe(0);
  });

  it("supports bare file-path relevant ids", () => {
    expect(recallAtK(["src/format.ts#window-1"], ["src/format.ts"], 1)).toBe(1);
  });
});

describe("reciprocalRank", () => {
  const relevant = ["a#f1"];

  it("is 1 when the first result is relevant", () => {
    expect(reciprocalRank(["a#f1", "x#g"], relevant)).toBe(1);
  });

  it("is 1/3 when the first relevant result is third", () => {
    expect(reciprocalRank(["x#g", "y#g", "a#f1"], relevant)).toBeCloseTo(1 / 3);
  });

  it("is 0 when no relevant result is retrieved", () => {
    expect(reciprocalRank(["x#g", "y#g"], relevant)).toBe(0);
  });

  it("is 0 for empty retrieval", () => {
    expect(reciprocalRank([], relevant)).toBe(0);
  });
});

describe("meanReciprocalRank", () => {
  it("averages reciprocal ranks across queries", () => {
    const mrr = meanReciprocalRank([
      { retrievedIds: ["a#f1"], relevantIds: ["a#f1"] }, // RR 1
      { retrievedIds: ["x#g", "a#f1"], relevantIds: ["a#f1"] }, // RR 1/2
      { retrievedIds: ["x#g"], relevantIds: ["a#f1"] }, // RR 0
    ]);
    expect(mrr).toBeCloseTo((1 + 0.5 + 0) / 3);
  });

  it("returns 0 for an empty query set", () => {
    expect(meanReciprocalRank([])).toBe(0);
  });
});

describe("mean", () => {
  it("averages numbers", () => {
    expect(mean([1, 2, 3])).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    expect(mean([])).toBe(0);
  });
});
