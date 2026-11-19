"use client";

import * as React from "react";
import { OFFLINE_LIVE } from "@/lib/config";

/** Registers the hand-written service worker; silently absent in dev browsers that block it. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (!OFFLINE_LIVE) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  return null;
}
