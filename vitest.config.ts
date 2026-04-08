import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // @dge/* packages are linked via npm workspaces in node_modules/@dge/
      // Explicit alias only needed for packages not yet in the workspace registry.
      "@dge/srx": path.resolve(__dirname, "games/srx/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
