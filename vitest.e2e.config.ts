import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

/** E2E hits a shared DB — run test files sequentially to avoid cross-suite collisions. */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["tests/e2e/**/*.test.ts"],
      setupFiles: ["tests/e2e/setup.ts"],
      fileParallelism: false,
      maxConcurrency: 1,
    },
  }),
);
