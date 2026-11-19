// P7 — WhatsApp chat commands for karigars.
//
// The same three commands work in the DEMO panel and on a real WhatsApp Business
// number. Every query is scoped to the karigar who sent it: a slip number that
// belongs to someone else gets the same answer as a slip that does not exist.
// "ok <slip>" only starts the OTP challenge — it never marks a payment paid.

import { db } from "@/lib/db";
import { requestPaymentOtp } from "@/lib/tola";

export type ChatCommand =
  | { kind: "balance" }
  | { kind: "status"; slipNumber: number }
  | { kind: "ok"; slipNumber: number }
  | { kind: "help"; reason: "empty" | "unknown" };

export type ChatReply = {
  ok: boolean;
  command: ChatCommand["kind"];
  reply: string;
  slipNumber?: number;
  challengeId?: string;
  demoCode?: string;
  expiresAt?: string;
};

const STATUS_TEXT: Record<string, string> = {
  ISSUED: "ISSUED",
  WORKING: "GOLD WITH KARIGAR",
  RETURNED: "RETURNED",
  SETTLED: "SETTLED",
};

const HELP_TEXT =
  'I can help with three things:\n• "balance" — gold in your hands\n• "status 211" — a slip\'s status and due date\n• "ok 211" — start the OTP to confirm a payment you received';

export function parseChatCommand(text: string): ChatCommand {
  const t = text.trim().toLowerCase().replace(/[?!.]+$/g, "");
  if (!t) return { kind: "help", reason: "empty" };
  if (t === "balance" || t === "my balance" || t === "gold") return { kind: "balance" };

  const status = t.match(/^status\s+#?(\d+)$/);
  if (status) return { kind: "status", slipNumber: Number(status[1]) };

  const ok = t.match(/^(?:ok|okay|received)\s+#?(\d+)$/);
  if (ok) return { kind: "ok", slipNumber: Number(ok[1]) };

  return { kind: "help", reason: "unknown" };
}

function rupees(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

function dateText(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const NOT_MINE =
  'I don\'t see that slip on your account. Reply "balance" to see the gold in your hands.';

export async function handleWhatsappChat(
  client: typeof db,
  args: { karigarId: string; text: string }
): Promise<ChatReply> {
  const command = parseChatCommand(args.text);

  const karigar = await client.karigar.findUnique({ where: { id: args.karigarId } });
  if (!karigar) {
    return {
      ok: false,
      command: command.kind,
      reply: "I couldn't find this account. Please check with the jeweller.",
    };
  }

  if (command.kind === "help") {
    return {
      ok: true,
      command: "help",
      reply:
        command.reason === "empty"
          ? `Namaste ${karigar.name.split(" ")[0]}. ${HELP_TEXT}`
          : `I didn't understand that. ${HELP_TEXT}`,
    };
  }

  if (command.kind === "balance") {
    const slips = await client.slip.findMany({
      where: { karigarId: karigar.id },
      select: { weightGrams: true, status: true, number: true },
    });
    const held = slips.filter((s) => s.status === "ISSUED" || s.status === "WORKING");
    const grams = held.reduce((a, s) => a + s.weightGrams, 0);
    const waiting = slips.filter((s) => s.status === "RETURNED");

    let reply =
      grams > 0
        ? `You are holding ${grams.toFixed(2)} g of gold across ${held.length} open ${held.length === 1 ? "slip" : "slips"}.`
        : "No gold is with you right now — every slip you took has been returned.";
    if (waiting.length) {
      reply += ` Slip ${waiting.map((s) => `#${s.number}`).join(", ")} ${waiting.length === 1 ? "is" : "are"} back and waiting for both approvals.`;
    }
    return { ok: true, command: "balance", reply };
  }

  const slip = await client.slip.findFirst({
    where: { number: command.slipNumber, karigarId: karigar.id },
    include: { payment: true },
  });
  if (!slip) {
    return {
      ok: true,
      command: command.kind,
      reply: NOT_MINE,
      slipNumber: command.slipNumber,
    };
  }

  if (command.kind === "status") {
    let reply = `Slip #${slip.number} — ${slip.job}. Status: ${STATUS_TEXT[slip.status] ?? slip.status}. Due ${dateText(slip.dueDate)}.`;
    if (slip.status === "RETURNED") {
      reply += " It is back with the jeweller and waiting for both approvals.";
    } else if (slip.status === "SETTLED" && slip.payment) {
      reply += ` Payment ${slip.payment.status === "PAID" ? "confirmed as received" : "is pending"} (${rupees(slip.payment.amount)}).`;
    }
    return { ok: true, command: "status", reply, slipNumber: slip.number };
  }

  // command.kind === "ok" — start the OTP; never mark paid here.
  if (slip.status !== "SETTLED" || !slip.payment) {
    return {
      ok: true,
      command: "ok",
      reply: `Slip #${slip.number} isn't at settlement yet. Current status: ${STATUS_TEXT[slip.status] ?? slip.status}. Once both sides approve, I can start the payment OTP.`,
      slipNumber: slip.number,
    };
  }
  if (slip.payment.status === "PAID") {
    return {
      ok: true,
      command: "ok",
      reply: `Slip #${slip.number} is already marked paid — ${rupees(slip.payment.amount)} received. Nothing more to do.`,
      slipNumber: slip.number,
    };
  }
  if (!slip.payment.upiRef) {
    return {
      ok: true,
      command: "ok",
      reply: `The jeweller hasn't recorded the UPI reference for slip #${slip.number} yet. I'll message you as soon as it's there.`,
      slipNumber: slip.number,
    };
  }

  const otp = await requestPaymentOtp(client, { paymentId: slip.payment.id });
  if (!otp.ok) {
    return {
      ok: false,
      command: "ok",
      reply: otp.error ?? "Could not start the OTP. Please try again.",
      slipNumber: slip.number,
    };
  }

  return {
    ok: true,
    command: "ok",
    reply: `OTP sent to your phone for slip #${slip.number} (${rupees(slip.payment.amount)}). Open the slip and tap "I received it" to enter the 6-digit code — Tola never marks a payment paid without it.${otp.demoCode ? ` (Demo code: ${otp.demoCode})` : ""}`,
    slipNumber: slip.number,
    challengeId: otp.challengeId,
    demoCode: otp.demoCode,
    expiresAt: otp.expiresAt,
  };
}
