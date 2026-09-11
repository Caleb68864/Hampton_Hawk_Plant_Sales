import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror vite.config.ts so pages that import via "@/..." can be rendered in tests.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // node:test suites live next to their modules as *.test.ts and are run by
    // scripts/run-node-tests.mjs; vitest owns everything under __tests__/.
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    // Node 26 removes globalThis.localStorage and vitest's jsdom environment
    // then fails to install jsdom's; see vitest.setup.ts.
    setupFiles: ["./vitest.setup.ts"],
  },
});
