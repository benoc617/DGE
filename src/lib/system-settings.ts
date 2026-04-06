/** Preview only — never send full secrets to the client. */
export function maskGeminiApiKeyPreview(key: string | null | undefined): { configured: boolean; preview: string } {
  if (!key?.trim()) return { configured: false, preview: "" };
  const k = key.trim();
  if (k.length <= 4) return { configured: true, preview: "***" };
  return { configured: true, preview: `***${k.slice(-4)}` };
}
