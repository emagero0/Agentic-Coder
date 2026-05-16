/**
 * priority-router.test.ts — Unit tests for the event priority router
 *
 * Tests classifyEvent() and routeEvent() directly from the source module.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyEvent, routeEvent } from "../../events/router/priority-router.js";
import type { RuntimeAdapter } from "../../events/adapters/runtime/bun/index.js";

// ── Mock Adapter ──────────────────────────────────────────────────────────────

function createMockAdapter(): RuntimeAdapter {
  return {
    log: vi.fn(),
    readJSON: vi.fn().mockResolvedValue({}),
    writeJSONAtomic: vi.fn().mockResolvedValue(undefined),
    snapshot: vi.fn().mockResolvedValue(undefined),
    appendOutput: vi.fn().mockResolvedValue(undefined),
    runSync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn(),
    runDeferred: vi.fn(),
    fileExists: vi.fn().mockReturnValue(false),
    readTextFile: vi.fn().mockReturnValue(null),
    writeTextFile: vi.fn(),
    deleteFile: vi.fn(),
    ensureDirectory: vi.fn(),
    hashString: vi.fn().mockReturnValue("mock-hash"),
  };
}

// ── classifyEvent Tests ──────────────────────────────────────────────────────

describe("classifyEvent", () => {
  it("should route state.registry.write to Tier 1 update-registry", () => {
    const result = classifyEvent({ type: "state.registry.write" });
    expect(result.tier).toBe(1);
    expect(result.handler).toBe("update-registry");
  });

  it("should route audit.promotion.confirmed to Tier 1 update-registry", () => {
    const result = classifyEvent({ type: "audit.promotion.confirmed" });
    expect(result.tier).toBe(1);
    expect(result.handler).toBe("update-registry");
  });

  it("should route cache.invalidate to Tier 1 invalidate-cache", () => {
    const result = classifyEvent({ type: "cache.invalidate" });
    expect(result.tier).toBe(1);
    expect(result.handler).toBe("invalidate-cache");
  });

  it("should route experiment.completed to Tier 1 update-registry", () => {
    const result = classifyEvent({ type: "experiment.completed" });
    expect(result.tier).toBe(1);
    expect(result.handler).toBe("update-registry");
  });

  it("should route file.watcher.updated to Tier 2 analyze-drift", () => {
    const result = classifyEvent({ type: "file.watcher.updated" });
    expect(result.tier).toBe(2);
    expect(result.handler).toBe("analyze-drift");
  });

  it("should route file.edited to Tier 2 analyze-drift", () => {
    const result = classifyEvent({ type: "file.edited" });
    expect(result.tier).toBe(2);
    expect(result.handler).toBe("analyze-drift");
  });

  it("should route tool.execute.after to Tier 2 check-dependencies", () => {
    const result = classifyEvent({ type: "tool.execute.after" });
    expect(result.tier).toBe(2);
    expect(result.handler).toBe("check-dependencies");
  });

  it("should route session.completed to Tier 2 analyze-drift", () => {
    const result = classifyEvent({ type: "session.completed" });
    expect(result.tier).toBe(2);
    expect(result.handler).toBe("analyze-drift");
  });

  it("should route research.topic.created to Tier 2 analyze-drift", () => {
    const result = classifyEvent({ type: "research.topic.created" });
    expect(result.tier).toBe(2);
    expect(result.handler).toBe("analyze-drift");
  });

  it("should route session.start to Tier 1 session-manager", () => {
    const result = classifyEvent({ type: "session.start" });
    expect(result.tier).toBe(1);
    expect(result.handler).toBe("session-manager");
  });

  it("should route session.idle to Tier 3 session-manager", () => {
    const result = classifyEvent({ type: "session.idle" });
    expect(result.tier).toBe(3);
    expect(result.handler).toBe("session-manager");
  });

  it("should route schedule.weekly to Tier 3 weekly-audit", () => {
    const result = classifyEvent({ type: "schedule.weekly" });
    expect(result.tier).toBe(3);
    expect(result.handler).toBe("weekly-audit");
  });

  it("should route ecosystem.watch.trigger to Tier 3 ecosystem-watch", () => {
    const result = classifyEvent({ type: "ecosystem.watch.trigger" });
    expect(result.tier).toBe(3);
    expect(result.handler).toBe("ecosystem-watch");
  });

  it("should route unknown events to Tier 2 analyze-drift (default)", () => {
    const result = classifyEvent({ type: "unknown.event.type" });
    expect(result.tier).toBe(2);
    expect(result.handler).toBe("analyze-drift");
  });

  it("should preserve the original event in the result", () => {
    const event = { type: "file.edited", path: "/some/file.ts" };
    const result = classifyEvent(event);
    expect(result.original).toBe(event);
    expect((result.original as typeof event).path).toBe("/some/file.ts");
  });

  it("should classify all 14 registered events without throwing", () => {
    const events = [
      "state.registry.write",
      "audit.promotion.confirmed",
      "file.watcher.updated",
      "file.edited",
      "tool.execute.after",
      "session.completed",
      "session.start",
      "session.idle",
      "schedule.weekly",
      "research.topic.created",
      "experiment.completed",
      "ecosystem.watch.trigger",
      "cache.invalidate",
    ];
    for (const type of events) {
      expect(() => classifyEvent({ type })).not.toThrow();
      const result = classifyEvent({ type });
      expect([1, 2, 3]).toContain(result.tier);
      expect(typeof result.handler).toBe("string");
    }
  });
});

// ── routeEvent Tests ─────────────────────────────────────────────────────────

describe("routeEvent", () => {
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    adapter = createMockAdapter();
  });

  it("should call adapter.runSync for Tier 1 events", async () => {
    await routeEvent({ type: "state.registry.write" }, adapter);
    expect(adapter.runSync).toHaveBeenCalledWith("update-registry", { type: "state.registry.write" });
  });

  it("should route session.start to Tier 1 sync dispatch", async () => {
    await routeEvent({ type: "session.start" }, adapter);
    expect(adapter.runSync).toHaveBeenCalledWith("session-manager", { type: "session.start" });
  });

  it("should call adapter.runAsync for Tier 2 events", async () => {
    await routeEvent({ type: "file.edited", path: "/test.ts" }, adapter);
    expect(adapter.runAsync).toHaveBeenCalledWith("analyze-drift", { type: "file.edited", path: "/test.ts" });
  });

  it("should call adapter.runDeferred for Tier 3 events", async () => {
    await routeEvent({ type: "session.idle" }, adapter);
    expect(adapter.runDeferred).toHaveBeenCalledWith("session-manager", { type: "session.idle" });
  });

  it("should route unknown events to Tier 2 (async)", async () => {
    await routeEvent({ type: "custom.event" }, adapter);
    expect(adapter.runAsync).toHaveBeenCalledWith("analyze-drift", { type: "custom.event" });
  });

  it("should call adapter.log with the routing info", async () => {
    await routeEvent({ type: "cache.invalidate" }, adapter);
    expect(adapter.log).toHaveBeenCalledWith("[EventRouter] cache.invalidate → Tier 1 (invalidate-cache)");
  });

  it("should handle events with extra properties", async () => {
    const event = { type: "file.watcher.updated", path: "/src/index.ts", timestamp: Date.now() };
    await routeEvent(event, adapter);
    expect(adapter.runAsync).toHaveBeenCalledWith("analyze-drift", event);
  });

  it("should propagate errors when runSync rejects", async () => {
    const badAdapter = createMockAdapter();
    badAdapter.runSync = vi.fn().mockRejectedValue(new Error("handler error"));
    // Tier 1 errors propagate — the caller is responsible for handling them
    await expect(routeEvent({ type: "state.registry.write" }, badAdapter)).rejects.toThrow("handler error");
  });
});
