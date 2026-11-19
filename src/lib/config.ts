// Prototype feature flags. OFFLINE_LIVE gates the offline queue banner and
// service-worker registration; it is on for the demo build.
export const OFFLINE_LIVE = true;

/** Fired on window after queued actions sync, so screens can refresh. */
export const OFFLINE_SYNCED_EVENT = "tola:queue-synced";
