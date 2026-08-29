import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // node:test suites live next to their modules as *.test.ts and are run by
    // scripts/run-node-tests.mjs; vitest owns everything under __tests__/.
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});