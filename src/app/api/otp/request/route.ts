import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { createOtpChallenge } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Require authentication
  const actor = await getActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { purpose, targetId } = body;

  if (!purpose) {
    return NextResponse.json({ error: "purpose is required" }, { status: 400 });
  }

  // Validate purpose
  const validPurposes = [
    "issue",
    "confirm",
    "return",
    "approve",
    "resolve-dispute",
  ];
  if (!validPurposes.includes(purpose)) {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }

  // Call createOtpChallenge from the library
  const result = await createOtpChallenge({
    actor: actor.actorString,
    purpose,
    targetId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }

  return NextResponse.json({
    ok: true,
    challengeId: result.challengeId,
    expiresAt: result.expiresAt,
  });
}