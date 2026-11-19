import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { Karigar } from "@prisma/client";

export const AUTH_SECRET = process.env.AUTH_SECRET ?? "tola-dev-secret-change-me";
export const COOKIE_NAME = "tola_session";

export interface ActorSession {
  role: "jeweller" | "karigar";
  karigarId?: string;
  actorString: string;
  name: string;
}

// --- PIN hashing ---

export function hashPin(pin: string): { pinHash: string; pinSalt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = crypto.scryptSync(pin as any, salt as any, 32) as Buffer;
  return { pinHash: buf.toString("hex"), pinSalt: salt };
}

export function verifyPin(pin: string, pinHash: string, pinSalt: string): boolean {
  const buf = crypto.scryptSync(pin as any, pinSalt as any, 32) as Buffer;
  return crypto.timingSafeEqual(new Uint8Array(buf), new Uint8Array(Buffer.from(pinHash, "hex")));
}

// --- Session cookie helpers ---

// Token format: base64url(payload JSON) + "." + base64url(HMAC-SHA256 of that payload).
// Signing and verification therefore operate on exactly the same bytes.
export function signSession(payload: { role: "jeweller" | "karigar"; karigarId?: string }): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): { role: "jeweller" | "karigar"; karigarId?: string } | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;

    const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
    const given = Buffer.from(sig, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (parsed?.role !== "jeweller" && parsed?.role !== "karigar") return null;
    if (parsed.role === "karigar" && typeof parsed.karigarId !== "string") return null;
    return parsed as { role: "jeweller" | "karigar"; karigarId?: string };
  } catch {
    return null;
  }
}

// --- Actor detection from request ---

export async function getActor(
  req?: Request | null
): Promise<ActorSession | null> {
  try {
    // Read the cookie from the request when one is passed; otherwise fall back
    // to the Next.js request-scoped cookie store (routes that call getActor()).
    let cookieValue = "";
    if (req && "headers" in req) {
      const raw = req.headers.get("cookie");
      if (raw) {
        const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
        if (match) cookieValue = match[1];
      }
    } else {
      const store = await cookies();
      cookieValue = store.get(COOKIE_NAME)?.value ?? "";
    }

    if (cookieValue) {
      try {
        cookieValue = decodeURIComponent(cookieValue);
      } catch {
        // Keep the raw value if it is not percent-encoded.
      }
    }

    if (!cookieValue) return null;

    const payload = verifySession(cookieValue);
    if (!payload) return null;

    if (payload.role === "jeweller") {
      return { role: "jeweller", actorString: "jeweller", name: "Sri Lakshmi Jewellers" };
    }

    if (payload.role === "karigar" && payload.karigarId) {
      // Verify the karigar actually exists in DB
      const k = await db.karigar.findUnique({ where: { id: payload.karigarId } });
      if (!k) return null;
      return {
        role: "karigar",
        karigarId: k.id,
        actorString: `karigar:${k.id}`,
        name: k.name,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function requireActor(req?: Request | null) {
  return async (): Promise<ActorSession | null> => {
    const actor = await getActor(req);
    if (!actor) return null;
    return actor;
  };
}

export function requireJeweller(req?: Request | null) {
  return async (): Promise<ActorSession | null> => {
    const actor = await requireActor(req)();
    if (!actor || actor.role !== "jeweller") {
      return null;
    }
    return actor;
  };
}

export function requireKarigar(req?: Request | null) {
  return async (): Promise<ActorSession | null> => {
    const actor = await requireActor(req)();
    if (!actor || actor.role !== "karigar") {
      return null;
    }
    return actor;
  };
}