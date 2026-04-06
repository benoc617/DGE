import { describe, it, expect, beforeEach } from "vitest";
import * as rng from "@/lib/rng";

describe("rng", () => {
  beforeEach(() => {
    rng.setSeed(null);
  });

  describe("setSeed / getSeed", () => {
    it("starts with null seed", () => {
      expect(rng.getSeed()).toBeNull();
    });

    it("sets and gets a seed", () => {
      rng.setSeed(42);
      expect(rng.getSeed()).toBe(42);
    });

    it("clears seed with null", () => {
      rng.setSeed(42);
      rng.setSeed(null);
      expect(rng.getSeed()).toBeNull();
    });
  });

  describe("determinism", () => {
    it("produces same sequence for same seed", () => {
      rng.setSeed(123);
      const seq1 = Array.from({ length: 10 }, () => rng.random());

      rng.setSeed(123);
      const seq2 = Array.from({ length: 10 }, () => rng.random());

      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences for different seeds", () => {
      rng.setSeed(1);
      const seq1 = Array.from({ length: 5 }, () => rng.random());

      rng.setSeed(2);
      const seq2 = Array.from({ length: 5 }, () => rng.random());

      expect(seq1).not.toEqual(seq2);
    });
  });

  describe("randomInt", () => {
    it("produces values within range", () => {
      rng.setSeed(42);
      for (let i = 0; i < 100; i++) {
        const val = rng.randomInt(5, 10);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(10);
      }
    });

    it("returns min when min equals max", () => {
      rng.setSeed(42);
      expect(rng.randomInt(7, 7)).toBe(7);
    });
  });

  describe("randomFloat", () => {
    it("produces values within range", () => {
      rng.setSeed(42);
      for (let i = 0; i < 100; i++) {
        const val = rng.randomFloat(1.0, 2.0);
        expect(val).toBeGreaterThanOrEqual(1.0);
        expect(val).toBeLessThan(2.0);
      }
    });
  });

  describe("chance", () => {
    it("always true for p=1", () => {
      rng.setSeed(42);
      for (let i = 0; i < 50; i++) {
        expect(rng.chance(1.0)).toBe(true);
      }
    });

    it("always false for p=0", () => {
      rng.setSeed(42);
      for (let i = 0; i < 50; i++) {
        expect(rng.chance(0)).toBe(false);
      }
    });
  });

  describe("shuffle", () => {
    it("produces same shuffle for same seed", () => {
      rng.setSeed(99);
      const a = rng.shuffle([1, 2, 3, 4, 5]);

      rng.setSeed(99);
      const b = rng.shuffle([1, 2, 3, 4, 5]);

      expect(a).toEqual(b);
    });

    it("preserves all elements", () => {
      rng.setSeed(42);
      const arr = [10, 20, 30, 40, 50];
      rng.shuffle(arr);
      expect(arr.sort()).toEqual([10, 20, 30, 40, 50]);
    });
  });
});
