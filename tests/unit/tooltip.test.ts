import { describe, it, expect } from "vitest";
import Tooltip from "@/components/Tooltip";

describe("Tooltip", () => {
  it("exports a client component", () => {
    expect(typeof Tooltip).toBe("function");
  });
});
