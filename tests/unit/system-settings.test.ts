import { describe, it, expect } from "vitest";
import { maskGeminiApiKeyPreview } from "@/lib/system-settings";

describe("system-settings masks", () => {
  it("masks Gemini key preview", () => {
    expect(maskGeminiApiKeyPreview(null)).toEqual({ configured: false, preview: "" });
    expect(maskGeminiApiKeyPreview("")).toEqual({ configured: false, preview: "" });
    expect(maskGeminiApiKeyPreview("abcd")).toEqual({ configured: true, preview: "***" });
    expect(maskGeminiApiKeyPreview("secret-key-here")).toEqual({ configured: true, preview: "***here" });
  });
});
