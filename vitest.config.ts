import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shime/core": path.resolve(__dirname, "packages/core/src"),
      "@shime/db": path.resolve(__dirname, "packages/db/src"),
      "@shime/questionnaire": path.resolve(__dirname, "packages/questionnaire/src"),
    },
  },
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json", "html"] },
  },
});
