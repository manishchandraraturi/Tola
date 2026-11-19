import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger, makingCharges, newPublicToken } from "@/lib/tola";
import { normaliseSlipPhoto } from "@/lib/scale-photo";
import {
  IDEMPOTENCY_HEADER,
  beginIdempotency,
  releaseIdempotency,
  saveIdempotencyResponse,
} from "@/app/api/idempotency";

export const dynamic = "force-dynamic";

// Issue gold: jeweller fills the slip and taps. The karigar's tap is still pending.
// A retry after an offline sync carries the same Idempotency-Key, so it replays
// the first response instead of issuing a second slip.
export async function POST(req: NextRequest) {
  const idem = await beginIdempotency(req);

  if (idem.state === "replay") {
    return NextResponse.json(idem.body, {
      status: idem.status,
      headers: {
        [IDEMPOTENCY_HEADER]: idem.key,
        "Idempotency-Replayed": "true",
        "Cache-Control": "no-store",
      },
    });
  }

  if (idem.state === "in_progress") {
    return NextResponse.json(
      { error: "This action is still processing. Try again in a moment." },
      {
        status: 409,
        headers: { [IDEMPOTENCY_HEADER]: idem.key, "Retry-After": "1" },
      }
    );
  }

  const idempotencyKey = idem.key;

  async function reply(status: number, payload: unknown) {
    await saveIdempotencyResponse(idempotencyKey, status, payload);
    return NextResponse.json(payload, {
      status,
      headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : undefined,
    });
  }

  try {
    const body = await req.json();
    const karigarId = String(body.karigarId ?? "");
    const weightGrams = Number(body.weightGrams);
    const purity = String(body.purity ?? "22K");
    const job = String(body.job ?? "").trim();
    const isWedding = Boolean(body.isWedding);
    const wastageAgreedPct = Number(body.wastageAgreedPct);
    const dueDate = new Date(body.dueDate);
    const customerName = String(body.customerName ?? "").trim().slice(0, 80) || null;
    const customerPhone = String(body.customerPhone ?? "").trim().slice(0, 24) || null;
    const requestedSource = String(body.source ?? "typed");
    const photo = body.photo ? normaliseSlipPhoto(body.photo) : null;
    if (body.photo && !photo) {
      return reply(400, {
        error: "The scale photo record is not valid. Read the photo again.",
      });
    }
    const source = photo
      ? "photo"
      : ["voice", "typed", "photo"].includes(requestedSource)
        ? requestedSource
        : "typed";

    if (
      !karigarId ||
      !weightGrams ||
      weightGrams <= 0 ||
      !job ||
      !isFinite(wastageAgreedPct) ||
      isNaN(dueDate.getTime())
    ) {
      return reply(400, {
        error: "Fill every field: karigar, weight, job, due date, wastage.",
      });
    }

    const karigar = await db.karigar.findUnique({ where: { id: karigarId } });
    if (!karigar) return reply(404, { error: "Karigar not found." });

    const last = await db.slip.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 210) + 1;

    const slip = await db.slip.create({
      data: {
        number,
        karigarId,
        weightGrams: Math.round(weightGrams * 100) / 100,
        purity,
        job,
        isWedding,
        dueDate,
        wastageAgreedPct: Math.round(wastageAgreedPct * 100) / 100,
        status: "ISSUED",
        source,
        photos: photo ? { create: { ...photo, actor: "jeweller" } } : undefined,
        makingCharges: makingCharges(weightGrams),
        customerName,
        customerPhone,
        publicToken: newPublicToken(),
      },
    });

    await appendLedger(
      "ISSUE",
      `Slip #${number} issued — ${slip.weightGrams.toFixed(2)} g, ${purity}, ${job}, to ${karigar.name}. Agreed wastage ${slip.wastageAgreedPct}%. Jeweller tapped.`,
      slip.id
    );

    return reply(200, { slip });
  } catch (error) {
    // Do not leave a claimed key behind if the handler failed.
    await releaseIdempotency(idempotencyKey);
    throw error;
  }
}
