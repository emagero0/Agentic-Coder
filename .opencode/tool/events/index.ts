/**
 * OAC Cognitive Event Plugin — Entry Point
 *
 * OpenCode plugin that hooks into the event bus and routes all events
 * through the Priority Router. This is the only file that touches
 * the OpenCode plugin API directly.
 *
 * Plugin API reference: .opencode/context/openagents-repo/plugins/context/capabilities/events.md
 */

import { routeEvent } from "../events/router/priority-router.js";
import { createBunAdapter } from "../events/adapters/runtime/bun/index.js";

// Create the runtime adapter once and reuse across all events
const adapter = createBunAdapter(".opencode/events/outputs");

/**
 * OpenCode plugin export.
 * The `event` hook is called for every event fired by the OpenCode runtime.
 */
export default async function CognitiveEventPlugin(_context: unknown) {
  return {
    /**
     * Called for every OpenCode event.
     * Routes to the priority router which dispatches to the correct tier.
     */
    event: async ({ event }: { event: { type: string; [key: string]: unknown } }) => {
      try {
        await routeEvent(event, adapter);
      } catch (err) {
        adapter.log(`[CognitiveEventPlugin] Unhandled error routing ${event.type}: ${err}`);
      }
    },
  };
}
