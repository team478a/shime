import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shime/checkin": path.resolve(__dirname, "packages/checkin/src"),
      "@shime/concierge": path.resolve(__dirname, "packages/concierge/src"),
      "@shime/core": path.resolve(__dirname, "packages/core/src"),
      "@shime/db": path.resolve(__dirname, "packages/db/src"),
      "@shime/event-core": path.resolve(__dirname, "packages/event-core/src"),
      "@shime/integrations": path.resolve(__dirname, "packages/integrations/src"),
      "@shime/interactions": path.resolve(__dirname, "packages/interactions/src"),
      "@shime/match-chat": path.resolve(__dirname, "packages/match-chat/src"),
      "@shime/notifications": path.resolve(__dirname, "packages/notifications/src"),
      "@shime/operations-analytics": path.resolve(__dirname, "packages/operations-analytics/src"),
      "@shime/questionnaire": path.resolve(__dirname, "packages/questionnaire/src"),
      "@shime/seating": path.resolve(__dirname, "packages/seating/src"),
      "@shime/web": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    environment: "node",
    coverage: { reporter: ["text", "json", "html"] },
  },
});
