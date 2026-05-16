import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve .js imports to .ts for NodeNext compatibility
      "/events/": path.resolve(__dirname, "events/"),
      "/graph/": path.resolve(__dirname, "graph/"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: ".opencode/coverage",
      include: [
        "events/handlers/**/*.ts",
        "events/router/**/*.ts",
        "events/adapters/**/*.ts",
        "tool/**/*.ts",
        "graph/**/*.ts",
      ],
      exclude: [
        "node_modules/**",
        "tests/**",
        "graph/schemas/**",  // Type-only files
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
