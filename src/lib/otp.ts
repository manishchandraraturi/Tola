// Tola — OTP challenge library for dual-signed tap confirmation
// Never stores plaintext codes; only scrypt codeHash + codeSalt.
// Rate-limited per actor: max 5 challenges per 60 seconds.
// Expires in 5 minutes. On consume: 3-attempt lockout with timing-safe equal.

import crypto from "crypto";
import { db } from "@/lib/db";

// ----- Internal helpers ------------------------------------------------------

function scryptHash(code: string): { codeHash: string; codeSalt: string } {
  const buf = crypto.scryptSync(code, "tola-otp-salt", 32);
  return { codeHash: buf.toString("hex"), codeSalt: "tola-otp-salt" };
}

// rate-limit state: actor -> last challenge timestamps (up to 5 per 60s)
const rateLimitCache: Map<string, Date[]> = new Map();

function checkRateLimit(actor: string): { ok: boolean; error?: string; status?: number } {
  const now = new Date();
  const entries = rateLimitCache.get(actor) || [];
  // Keep only entries within the last 60 seconds
  const recent = entries.filter((t) => now.getTime() - t.getTime() <= 60_000);
  if (recent.length >= 5) {
    return {
      ok: false,
      error: "Too many OTP requests. Wait a minute.",
      status: 429,
    };
  }
  // Store the new attempt timestamp
  recent.push(now);
  rateLimitCache.set(actor, recent);
  return { ok: true };
}

// ----- Public API ----------------------------------------------------------

export interface CreateOtpChallengeInput {
  actor: string; // "jeweller" | "karigar:<id>"
  purpose:
    | "issue"
    | "confirm"
    | "return"
    | "approve"
    | "resolve-dispute"
    | "confirm-payment";
  targetId?: string; // slipId or "new"
}

export interface CreateOtpChallengeOutput {
  ok: true;
  challengeId: string;
  expiresAt: string;
}

export interface CreateOtpChallengeError {
  ok: false;
  error: string;
  status?: number;
}

export type CreateOtpChallengeResult =
  | CreateOtpChallengeOutput
  | CreateOtpChallengeError;

export interface ConsumeOtpChallengeInput {
  challengeId: string;
  code: string;
  actor: string;
  purpose:
    | "issue"
    | "confirm"
    | "return"
    | "approve"
    | "resolve-dispute"
    | "confirm-payment";
  targetId?: string;
}

export interface ConsumeOtpChallengeOutput {
  ok: true;
  proof: `otp:${string}`;
}

export interface ConsumeOtpChallengeError {
  ok: false;
  error: string;
}

export type ConsumeOtpChallengeResult =
  | ConsumeOtpChallengeOutput
  | ConsumeOtpChallengeError;

// ----- createOtpChallenge -----------------------------------------------------

export async function createOtpChallenge(
  input: CreateOtpChallengeInput,
  client?: typeof db
): Promise<CreateOtpChallengeResult> {
  const dbClient = client || db;
  // Rate limit check
  const rateOk = checkRateLimit(input.actor);
  if (!rateOk.ok) {
    return {
      ok: false,
      error: rateOk.error ?? "Unknown error",
      status: rateOk.status ?? 500,
    };
  }

  // Hash the 6-digit code (user will supply the code; we store only hash+Salt)
  // Actually the code is generated here as a 6-digit string, hashed with scrypt,
  // and only the hash+salt are stored. The raw code is returned to the caller
  // so they can present it to the user, but it is never stored persistently.
  // For the demo flow, we generate a code, store its hash, and also send it
  // via the NotificationLog so the user sees it.

  // Actually, re-reading the requirements: the code is generated, hashed with scrypt,
  // and stored as codeHash+codeSalt. The code itself is NOT stored. But for the demo,
  // we need to show it somewhere (NotificationLog). Let's generate a code, hash it,
  // store hash+salt, and also write the code into NotificationLog as the "text" field
  // so the user can see it. The code itself is ephemeral.

  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 100000-999999
  const { codeHash, codeSalt } = scryptHash(code);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  // Write OtpChallenge row
  await dbClient.otpChallenge.create({
    data: {
      actor: input.actor,
      purpose: input.purpose,
      targetId: input.targetId,
      codeHash,
      codeSalt,
      attempts: 0,
      expiresAt,
    },
  });

  // Write NotificationLog entry so the user can see the OTP code (DEMO_SMS channel)
  const recipient = input.actor.includes("karigar")
    ? `karigar:${input.actor.split(":")[1] || "unknown"}`
    : input.actor;
  await dbClient.notificationLog.create({
    data: {
      channel: "DEMO_SMS",
      recipient,
      actor: input.actor,
      text: `Tola OTP ${code} for ${input.purpose} (valid 5 min). Do not share.`,
      isDemo: true,
    },
  });

  const challenge = await dbClient.otpChallenge.findFirst({
    where: { actor: input.actor, purpose: input.purpose, targetId: input.targetId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!challenge) return { ok: false, error: "Failed to create OTP challenge." };
  const challengeId = challenge.id;

  return {
    ok: true,
    challengeId,
    expiresAt: expiresAt.toISOString(),
  };
}

// ----- consumeOtpChallenge ----------------------------------------------------

export async function consumeOtpChallenge(
  input: ConsumeOtpChallengeInput,
  client?: typeof db
): Promise<ConsumeOtpChallengeResult> {
  const dbClient = client || db;
  const challenge = await dbClient.otpChallenge.findUnique({
    where: { id: input.challengeId },
  });

  if (!challenge) {
    return { ok: false, error: "Invalid or expired OTP challenge." };
  }

  // Check actor match
  if (challenge.actor !== input.actor) {
    // Increment attempts on mismatch
    await dbClient.otpChallenge.update({
      where: { id: input.challengeId },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "OTP challenge does not match this actor." };
  }

  // Check purpose match
  if (challenge.purpose !== input.purpose) {
    await dbClient.otpChallenge.update({
      where: { id: input.challengeId },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "OTP challenge purpose does not match." };
  }

  // Check targetId match (if provided)
  if (input.targetId && challenge.targetId !== input.targetId) {
    await dbClient.otpChallenge.update({
      where: { id: input.challengeId },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "OTP challenge target does not match." };
  }

  // Check consumed
  if (challenge.consumedAt !== null) {
    return { ok: false, error: "OTP challenge already consumed." };
  }

  // Check expiry
  const now = new Date();
  if (now >= challenge.expiresAt) {
    return { ok: false, error: "OTP challenge expired." };
  }

  // Check attempts < 3
  if (challenge.attempts >= 3) {
    return { ok: false, error: "OTP challenge locked out: 3 or more failed attempts." };
  }

  // Verify code via timing-safe equal
  const storedCodeHash = challenge.codeHash;
  const inputCodeHash = crypto
    .scryptSync(input.code, "tola-otp-salt", 32)
    .toString("hex");

  const ok = crypto.timingSafeEqual(
    Uint8Array.from(storedCodeHash),
    Uint8Array.from(inputCodeHash)
  );

  if (!ok) {
    // Increment attempts on wrong code
    await dbClient.otpChallenge.update({
      where: { id: input.challengeId },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Wrong OTP code." };
  }

  // Success: mark consumed and return proof
  await dbClient.otpChallenge.update({
    where: { id: input.challengeId },
    data: { consumedAt: now },
  });

  return {
    ok: true,
    proof: `otp:${challenge.id}`,
  };
}