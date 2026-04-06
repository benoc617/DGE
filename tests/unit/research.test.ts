import { describe, it, expect } from "vitest";
import { getAvailableTech, getTech, TECH_TREE } from "@/lib/research";

describe("research", () => {
  describe("TECH_TREE", () => {
    it("has at least 15 techs", () => {
      expect(TECH_TREE.length).toBeGreaterThanOrEqual(15);
    });

    it("has at least 5 categories", () => {
      const categories = new Set(TECH_TREE.map((t) => t.category));
      expect(categories.size).toBeGreaterThanOrEqual(5);
    });

    it("all techs have required fields", () => {
      for (const tech of TECH_TREE) {
        expect(tech.id).toBeTruthy();
        expect(tech.name).toBeTruthy();
        expect(tech.category).toBeTruthy();
        expect(tech.cost).toBeGreaterThan(0);
        expect(tech.description).toBeTruthy();
      }
    });

    it("prerequisite references exist", () => {
      const ids = new Set(TECH_TREE.map((t) => t.id));
      for (const tech of TECH_TREE) {
        for (const prereq of tech.prerequisites) {
          expect(ids.has(prereq)).toBe(true);
        }
      }
    });

    it("has no duplicate IDs", () => {
      const ids = TECH_TREE.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("getTech", () => {
    it("returns a tech by ID", () => {
      const tech = getTech(TECH_TREE[0].id);
      expect(tech).toBeDefined();
      expect(tech!.name).toBe(TECH_TREE[0].name);
    });

    it("returns undefined for unknown ID", () => {
      expect(getTech("nonexistent_tech")).toBeUndefined();
    });
  });

  describe("getAvailableTech", () => {
    it("returns techs with no prerequisites when nothing unlocked", () => {
      const available = getAvailableTech([]);
      expect(available.length).toBeGreaterThan(0);
      for (const tech of available) {
        expect(tech.prerequisites.length).toBe(0);
      }
    });

    it("does not include already unlocked techs", () => {
      const available = getAvailableTech([]);
      const firstId = available[0].id;
      const availableAfter = getAvailableTech([firstId]);
      const ids = availableAfter.map((t) => t.id);
      expect(ids).not.toContain(firstId);
    });

    it("unlocking a prerequisite makes dependent techs available", () => {
      const withPrereqs = TECH_TREE.find((t) => t.prerequisites.length > 0);
      expect(withPrereqs).toBeDefined();
      if (!withPrereqs) return;

      // This tech shouldn't be available with nothing unlocked
      const availBefore = getAvailableTech([]);
      const idsBefore = availBefore.map((t) => t.id);

      if (!idsBefore.includes(withPrereqs.id)) {
        const availAfter = getAvailableTech(withPrereqs.prerequisites);
        const idsAfter = availAfter.map((t) => t.id);
        expect(idsAfter).toContain(withPrereqs.id);
      }
    });
  });
});
