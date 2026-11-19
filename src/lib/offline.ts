"use client";

// P11 — offline capture. Writes that cannot reach the server are kept in
// IndexedDB with an Idempotency-Key, then replayed when signal returns. The
// queue's count is an external store so banners update without effect loops.
import { OFFLINE_SYNCED_EVENT } from "@/lib/config";

const DB_NAME = "tola-offline";
const STORE = "queue";
const DB_VERSION = 1;

export type QueuedAction = {
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: string;
  headers: Record<string, string>;
  label?: string;
  createdAt: number;
  idempotencyKey: string;
};

export type FlushResult = {
  synced: number;
  failed: number;
  remaining: number;
};

export type SubmitResult =
  | { queued: true; idempotencyKey: string }
  | { queued: false; status: number; body: unknown };

// ---- idle store -----------------------------------------------------------------

let pendingSnapshot = 0;
const pendingListeners = new Set<() => void>();

export function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

export function getPendingSnapshot(): number {
  return pendingSnapshot;
}

/** The server render has no IndexedDB, so the banner starts empty there. */
export function getPendingServerSnapshot(): number {
  return 0;
}

function publishPending(count: number) {
  if (count === pendingSnapshot) return;
  pendingSnapshot = count;
  pendingListeners.forEach((listener) => listener());
}

// ---- online store ---------------------------------------------------------------

export function subscribeOnline(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function getOnlineSnapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function getOnlineServerSnapshot(): boolean {
  return true;
}

// ---- keys and queue records -----------------------------------------------------

export function newIdempotencyKey(): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `tola-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildQueuedAction(input: {
  url: string;
  method?: QueuedAction["method"];
  body?: unknown;
  label?: string;
  headers?: Record<string, string>;
  now?: number;
  key?: string;
}): QueuedAction {
  return {
    id: newIdempotencyKey(),
    url: input.url,
    method: input.method ?? "POST",
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: input.headers ?? {},
    label: input.label,
    createdAt: input.now ?? Date.now(),
    idempotencyKey: input.key ?? newIdempotencyKey(),
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline storage."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage failed."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const database = await openDb();
  try {
    const transaction = database.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    return await run(store);
  } finally {
    database.close();
  }
}

export async function enqueueAction(action: QueuedAction): Promise<void> {
  await withStore("readwrite", (store) => requestResult(store.put(action)));
  await refreshPending();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tola:queue-changed"));
  }
}

export async function listQueuedActions(): Promise<QueuedAction[]> {
  const actions = await withStore("readonly", (store) =>
    requestResult(store.getAll() as IDBRequest<QueuedAction[]>)
  );
  return actions.sort((a, b) => a.createdAt - b.createdAt);
}

export async function queueCount(): Promise<number> {
  return withStore("readonly", (store) => requestResult(store.count()));
}

export async function removeQueuedAction(id: string): Promise<void> {
  await withStore("readwrite", (store) => requestResult(store.delete(id)));
}

export async function clearQueue(): Promise<void> {
  await withStore("readwrite", (store) => requestResult(store.clear()));
  await refreshPending();
}

export async function refreshPending(): Promise<number> {
  try {
    const count = await queueCount();
    publishPending(count);
    return count;
  } catch {
    publishPending(0);
    return 0;
  }
}

// ---- sync -----------------------------------------------------------------------

/**
 * Replay queued actions oldest-first. A network failure stops the run and
 * leaves the rest queued. 4xx responses are dropped (a retry cannot help),
 * except 409/429, which are kept for a later attempt.
 */
export async function flushQueue(fetchImpl: typeof fetch = fetch): Promise<FlushResult> {
  let synced = 0;
  let failed = 0;
  let actions: QueuedAction[] = [];
  try {
    actions = await listQueuedActions();
  } catch {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  for (const action of actions) {
    try {
      const response = await fetchImpl(action.url, {
        method: action.method,
        headers: {
          ...(action.body ? { "Content-Type": "application/json" } : {}),
          ...action.headers,
          "Idempotency-Key": action.idempotencyKey,
        },
        body: action.body,
      });

      const retryLater = response.status === 409 || response.status === 429 || response.status >= 500;
      if (retryLater) break;

      await removeQueuedAction(action.id);
      if (response.ok) synced += 1;
      else failed += 1;
    } catch {
      break;
    }
  }

  const remaining = await refreshPending();
  if (synced > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_SYNCED_EVENT));
  }
  return { synced, failed, remaining };
}

/**
 * Send now when online; queue when the browser is offline or the request never
 * landed (patchy signal). Every attempt carries an Idempotency-Key, so a queued
 * action that was actually received is not applied twice.
 */
export async function submitOrQueue(input: {
  url: string;
  body: unknown;
  label?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<SubmitResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const idempotencyKey = newIdempotencyKey();
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (offline) {
    await enqueueAction(
      buildQueuedAction({
        url: input.url,
        body: input.body,
        label: input.label,
        headers: input.headers,
        key: idempotencyKey,
      })
    );
    return { queued: true, idempotencyKey };
  }

  try {
    const response = await fetchImpl(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...input.headers,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(input.body ?? {}),
    });
    const data = await response.json().catch(() => ({}));
    return { queued: false, status: response.status, body: data };
  } catch {
    await enqueueAction(
      buildQueuedAction({
        url: input.url,
        body: input.body,
        label: input.label,
        headers: input.headers,
        key: idempotencyKey,
      })
    );
    return { queued: true, idempotencyKey };
  }
}
