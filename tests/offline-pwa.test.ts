// P11 tests: the offline PWA and replay-safe writes. The service worker's own
// cachePolicy function is loaded from public/sw.js into a sandbox, so the test
// exercises the shipped policy rather than a copy of it.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { OFFLINE_LIVE } from "@/lib/config";
import { buildQueuedAction, newIdempotencyKey } from "@/lib/offline";
import {
  beginIdempotency,
  idempotencyKeyFrom,
  releaseIdempotency,
  saveIdempotencyResponse,
} from "@/app/api/idempotency";

type Policy = {
  handle: boolean;
  strategy?: string;
  cache?: string;
  reason?: string;
};

function loadServiceWorker() {
  const source = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners: Record<string, Array<() => void>> = {};
  const self = {
    addEventListener(type: string, fn: () => void) {
      (listeners[type] ??= []).push(fn);
    },
    location: { origin: "http://localhost:3000" },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const cache = {
    addAll: async () => undefined,
    put: async () => undefined,
    match: async () => undefined,
  };

  vm.runInNewContext(source, {
    self,
    caches: {
      open: async () => cache,
      keys: async () => ["tola-shell-v1"],
      delete: async () => true,
      match: async () => undefined,
    },
    fetch: async () => new Response("ok"),
    Response,
    URL,
    Promise,
  });

  const policy = (
    self as unknown as {
      __TOLA_CACHE_POLICY__: (method: string, pathname: string) => Policy;
    }
  ).__TOLA_CACHE_POLICY__;

  return { policy, listeners };
}

describe("web manifest and feature flag", () => {
  it("ships a standalone manifest with the Tola start URL and colours", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "manifest.json"), "utf8")
    ) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };

    expect(manifest.name).toContain("Tola");
    expect(manifest.short_name).toBe("Tola");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#FBF3E2");
    expect(manifest.background_color).toBe("#FBF3E2");
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"])
    );
  });

  it("has real PNG icon files for every manifest icon", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public", "manifest.json"), "utf8")
    ) as { icons: Array<{ src: string }> };

    for (const icon of new Set(manifest.icons.map((entry) => entry.src))) {
      const file = path.join(process.cwd(), "public", icon.replace(/^\//, ""));
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(0);
      expect(fs.readFileSync(file).subarray(1, 4).toString("ascii")).toBe("PNG");
    }
  });

  it("turns the offline feature flag on for the demo build", () => {
    expect(OFFLINE_LIVE).toBe(true);
  });
});

describe("service worker caching policy", () => {
  const { policy, listeners } = loadServiceWorker();

  it("uses network-first with a cached fallback for /api/state", () => {
    expect(policy("GET", "/api/state")).toMatchObject({
      handle: true,
      strategy: "network-first",
    });
    expect(policy("GET", "/api/state").cache).toBeTruthy();
  });

  it("never handles POST, PATCH, PUT or DELETE", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(policy(method, "/api/slips").handle).toBe(false);
    }
  });

  it("never caches auth or OTP routes", () => {
    expect(policy("GET", "/api/auth/session").handle).toBe(false);
    expect(policy("GET", "/api/auth/session").reason).toBe("auth");
    expect(policy("GET", "/api/otp/challenge").handle).toBe(false);
    expect(policy("GET", "/api/otp/challenge").reason).toBe("otp");
  });

  it("leaves every other API route to the network", () => {
    expect(policy("GET", "/api/slips").handle).toBe(false);
    expect(policy("GET", "/api/payments/123").handle).toBe(false);
  });

  it("serves the app shell cache-first but navigations network-first", () => {
    expect(policy("GET", "/manifest.json")).toMatchObject({
      handle: true,
      strategy: "cache-first",
    });
    expect(policy("GET", "/icon-192.png")).toMatchObject({ strategy: "cache-first" });
    expect(policy("GET", "/")).toMatchObject({
      handle: true,
      strategy: "network-first",
    });
  });

  it("registers install, activate and fetch handlers", () => {
    expect(listeners.install).toHaveLength(1);
    expect(listeners.activate).toHaveLength(1);
    expect(listeners.fetch).toHaveLength(1);
  });
});

describe("offline queue payloads", () => {
  it("builds a POST action with a JSON body and its own idempotency key", () => {
    const action = buildQueuedAction({
      url: "/api/slips",
      body: { karigarId: "k1", weightGrams: 25.4 },
      label: "Issue gold — necklace",
      key: "key-12345678",
      now: 1700000000000,
    });

    expect(action.method).toBe("POST");
    expect(action.url).toBe("/api/slips");
    expect(JSON.parse(action.body as string)).toEqual({
      karigarId: "k1",
      weightGrams: 25.4,
    });
    expect(action.idempotencyKey).toBe("key-12345678");
    expect(action.createdAt).toBe(1700000000000);
    expect(action.id).not.toBe(action.idempotencyKey);
  });

  it("generates unique keys that fit the server's accepted format", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
    for (const key of keys) {
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key).toMatch(/^[A-Za-z0-9._:-]+$/);
    }
  });
});

// ---- server idempotency ------------------------------------------------------

describe("server idempotency", () => {
  let dir = "";
  let client: PrismaClient;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-offline-"));
    const url = `file:${path.join(dir, "offline.db").replace(/\\/g, "/")}`;
    execFileSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }
    );
    client = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  beforeEach(async () => {
    await client.idempotencyKey.deleteMany({});
  });

  afterAll(async () => {
    await client?.$disconnect();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  function request(key?: string) {
    return new Request("http://localhost:3000/api/slips", {
      method: "POST",
      headers: key ? { "Idempotency-Key": key } : undefined,
    });
  }

  it("replays the stored response instead of running the action twice", async () => {
    const key = "idem-replay-0001";
    const first = await beginIdempotency(request(key), client);
    expect(first.state).toBe("proceed");

    const stored = { slip: { number: 216, source: "typed" } };
    await saveIdempotencyResponse(key, 200, stored, client);

    const replay = await beginIdempotency(request(key), client);
    expect(replay.state).toBe("replay");
    if (replay.state === "replay") {
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(stored);
    }
    expect(await client.idempotencyKey.count()).toBe(1);
  });

  it("replays a stored validation error too", async () => {
    const key = "idem-replay-0002";
    await beginIdempotency(request(key), client);
    await saveIdempotencyResponse(key, 400, { error: "Fill every field." }, client);

    const replay = await beginIdempotency(request(key), client);
    expect(replay).toMatchObject({
      state: "replay",
      status: 400,
      body: { error: "Fill every field." },
    });
  });

  it("reports in_progress while the first request still holds the key", async () => {
    const key = "idem-locked-0003";
    await beginIdempotency(request(key), client);
    const second = await beginIdempotency(request(key), client);
    expect(second.state).toBe("in_progress");
  });

  it("releases a failed action so a retry can proceed", async () => {
    const key = "idem-release-0004";
    await beginIdempotency(request(key), client);
    await releaseIdempotency(key, client);
    expect((await beginIdempotency(request(key), client)).state).toBe("proceed");
  });

  it("proceeds without a key and stores nothing", async () => {
    const result = await beginIdempotency(request(), client);
    expect(result).toEqual({ state: "proceed", key: null });
    await saveIdempotencyResponse(null, 200, { ok: true }, client);
    expect(await client.idempotencyKey.count()).toBe(0);
  });

  it("ignores malformed keys and keeps different keys independent", async () => {
    expect(idempotencyKeyFrom(request("short"))).toBeNull();
    expect(idempotencyKeyFrom(request("bad key with spaces"))).toBeNull();
    expect(idempotencyKeyFrom(request("good-key-12345"))).toBe("good-key-12345");

    await beginIdempotency(request("idem-a-00000001"), client);
    await beginIdempotency(request("idem-b-00000002"), client);
    await saveIdempotencyResponse("idem-a-00000001", 200, { slip: 1 }, client);
    await saveIdempotencyResponse("idem-b-00000002", 200, { slip: 2 }, client);

    const a = await beginIdempotency(request("idem-a-00000001"), client);
    const b = await beginIdempotency(request("idem-b-00000002"), client);
    expect(a.state === "replay" && a.body).toEqual({ slip: 1 });
    expect(b.state === "replay" && b.body).toEqual({ slip: 2 });
  });
});
