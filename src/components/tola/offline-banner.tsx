"use client";

import * as React from "react";
import { OFFLINE_LIVE } from "@/lib/config";
import {
  flushQueue,
  getOnlineServerSnapshot,
  getOnlineSnapshot,
  getPendingServerSnapshot,
  getPendingSnapshot,
  refreshPending,
  subscribeOnline,
  subscribePending,
} from "@/lib/offline";
import { useTranslation } from "./language-switcher";

/**
 * "Offline: N actions waiting to sync" — visible on both the jeweller and
 * karigar screens. The count comes from IndexedDB; syncing is manual here and
 * also happens automatically when the browser reports it is back online.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = React.useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const pending = React.useSyncExternalStore(
    subscribePending,
    getPendingSnapshot,
    getPendingServerSnapshot
  );
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!OFFLINE_LIVE) return;
    void refreshPending();
  }, []);

  React.useEffect(() => {
    if (!OFFLINE_LIVE) return;
    const onOnline = () => {
      void flushQueue();
    };
    const onQueueChanged = () => {
      void refreshPending();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("tola:queue-changed", onQueueChanged);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("tola:queue-changed", onQueueChanged);
    };
  }, []);

  if (!OFFLINE_LIVE) return null;
  if (online && pending === 0) return null;

  const label =
    pending === 1
      ? t(online ? "offline.backOne" : "offline.titleOne")
      : t(online ? "offline.back" : "offline.title", { count: pending });

  async function syncNow() {
    setBusy(true);
    try {
      const result = await flushQueue();
      if (result.synced > 0) {
        setNotice(
          `${result.synced} ${result.synced === 1 ? "action" : "actions"} synced. ${
            result.remaining > 0 ? `${result.remaining} still waiting.` : "All caught up."
          }`
        );
      } else if (result.remaining > 0) {
        setNotice("Still no signal. The actions stay saved on this phone.");
      } else {
        setNotice("Nothing left to sync.");
      }
    } catch {
      setNotice("Could not sync right now. The actions are still saved on this phone.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b-[2px] border-ink bg-[var(--marker-yellow)] px-4 py-2"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-sketch text-sm font-bold text-ink">{label}</p>
        <p className="font-hand text-xs text-ink-soft">
          {online
            ? t("offline.sameKey")
            : `${t("offline.savedLocal")} ${t("offline.tapsNeedConnection")}`}
        </p>
        <button
          type="button"
          onClick={syncNow}
          disabled={!online || busy}
          className="ml-auto min-h-12 border-[2px] border-ink bg-white px-2.5 py-1 font-sketch text-xs font-bold text-ink sketch-c transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "Syncing…" : t("action.syncNow")}
        </button>
      </div>
      {notice && <p className="mx-auto mt-1 max-w-7xl font-hand text-xs text-ink">{notice}</p>}
    </div>
  );
}
