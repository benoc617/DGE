import path from "node:path";
import { fileURLToPath } from "node:url";

/** Real directory containing this config (cwd can differ under Next / Docker). */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const disableDevIndicator = (() => {
  const v = process.env.NEXT_DISABLE_DEV_INDICATOR;
  if (!v) return false;
  const lower = v.toLowerCase();
  return v === "1" || lower === "true" || lower === "yes";
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker bind-mount + Turbopack can infer src/app as root; breaks postcss/lightningcss resolution.
  turbopack: {
    root: __dirname,
  },
  ...(disableDevIndicator ? { devIndicators: false } : {}),
};

export default nextConfig;
