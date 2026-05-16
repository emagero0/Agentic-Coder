/** env-loader.test.ts — Environment variable loader */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";

// Mock fs/promises with a shared store accessible via closure
const envStore = new Map<string, string>();

vi.mock("fs/promises", () => ({
  readFile: vi.fn(async (filePath: string) => {
    const c = envStore.get(filePath);
    if (!c) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return c;
  }),
}));

import { loadEnvVariables } from "../../tool/env/index.js";
const p = (rel: string) => path.resolve(rel);

describe("loadEnvVariables", () => {
  beforeEach(() => { vi.clearAllMocks(); envStore.clear(); });

  it("should load variables from .env file", async () => {
    envStore.set(p(".env"), "KEY=value\nDB_URL=localhost");
    const result = await loadEnvVariables({ searchPaths: [".env"] });
    expect(result.KEY).toBe("value");
    expect(result.DB_URL).toBe("localhost");
  });

  it("should skip missing files silently", async () => {
    const result = await loadEnvVariables({ searchPaths: ["missing.env"] });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should override existing env vars when configured", async () => {
    process.env.TEST_ENV_OVR_FN = "original";
    envStore.set(p("override.env"), "TEST_ENV_OVR_FN=overridden");
    await loadEnvVariables({ searchPaths: ["override.env"], override: true });
    expect(process.env.TEST_ENV_OVR_FN).toBe("overridden");
    delete process.env.TEST_ENV_OVR_FN;
  });

  it("should not override existing env vars by default", async () => {
    process.env.TEST_ENV_STICKY_FN = "original";
    envStore.set(p("sticky.env"), "TEST_ENV_STICKY_FN=should-not-win");
    await loadEnvVariables({ searchPaths: ["sticky.env"] });
    expect(process.env.TEST_ENV_STICKY_FN).toBe("original");
    delete process.env.TEST_ENV_STICKY_FN;
  });

  it("should parse quoted values", async () => {
    envStore.set(p("quoted.env"), 'GREETING="Hello World"');
    const result = await loadEnvVariables({ searchPaths: ["quoted.env"] });
    expect(result.GREETING).toBe("Hello World");
  });

  it("should use default search paths when none provided", async () => {
    const result = await loadEnvVariables();
    expect(typeof result).toBe("object");
  });
});
