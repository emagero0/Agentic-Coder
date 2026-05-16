/**
 * session-manager.ts — Tier 3 Deferred Session Handler (re-export)
 *
 * Re-exports from sync/ so both Tier 1 and Tier 3 routing can
 * use the same handler. The adapter dispatch imports from the
 * tier-specific subdirectory, so this file provides Tier 3 access.
 */
export { handleSessionEvent } from "../sync/session-manager.js";
