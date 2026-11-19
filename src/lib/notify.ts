// P7 — notifications, the Watcher's send loop, and channel fallback.
//
// Tola talks to karigars on WhatsApp first and SMS second. In this prototype
// nothing leaves the machine unless WHATSAPP_TOKEN + WHATSAPP_PHONE_ID are set:
// the demo notifier writes to NotificationLog so the DEMO SMS inbox shows it.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { watcherAlerts, type WatcherAlert } from "@/lib/tola";

export type NotificationChannel = "DEMO_SMS" | "SMS" | "WHATSAPP";

export type NotifyInput = {
  /** Phone number for real channels; the demo log accepts any label. */
  recipient: string;
  text: string;
  /** "jeweller" or "karigar:<id>" — keeps the log scoped. */
  actor: string;
  channel?: NotificationChannel;
};

export type NotifyResult = {
  ok: boolean;
  channel: NotificationChannel;
  demo: boolean;
  error?: string;
};

export interface Notifier {
  readonly name: string;
  send(input: NotifyInput): Promise<NotifyResult>;
}

/** Default: no network. Writes the message to NotificationLog (DEMO_SMS). */
export class DemoNotifier implements Notifier {
  readonly name = "demo";
  constructor(private readonly client: typeof db = db) {}

  async send(input: NotifyInput): Promise<NotifyResult> {
    await this.client.notificationLog.create({
      data: {
        channel: "DEMO_SMS",
        recipient: input.recipient,
        actor: input.actor,
        text: input.text,
        isDemo: true,
      },
    });
    return { ok: true, channel: "DEMO_SMS", demo: true };
  }
}

export type WhatsAppNotifierOptions = {
  client?: typeof db;
  token?: string;
  phoneId?: string;
  fallback?: Notifier;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
};

/**
 * WhatsApp Cloud API adapter. Falls back to the demo/SMS notifier whenever the
 * token or phone id is missing, or the API call fails — a reminder should not
 * vanish because one channel is down.
 */
export class WhatsAppNotifier implements Notifier {
  readonly name = "whatsapp";
  private readonly client: typeof db;
  private readonly token?: string;
  private readonly phoneId?: string;
  private readonly fallback: Notifier;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: WhatsAppNotifierOptions = {}) {
    this.client = opts.client ?? db;
    this.token = opts.token ?? process.env.WHATSAPP_TOKEN;
    this.phoneId = opts.phoneId ?? process.env.WHATSAPP_PHONE_ID;
    this.fallback = opts.fallback ?? new DemoNotifier(this.client);
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async send(input: NotifyInput): Promise<NotifyResult> {
    if (!this.token || !this.phoneId) return this.fallback.send(input);

    const to = input.recipient.replace(/\D/g, "");
    if (!to) return this.fallback.send(input);

    try {
      const res = await this.fetchImpl(
        `https://graph.facebook.com/v20.0/${this.phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: input.text },
          }),
        }
      );
      if (!res.ok) throw new Error(`WhatsApp API returned ${res.status}`);

      await this.client.notificationLog.create({
        data: {
          channel: "WHATSAPP",
          recipient: input.recipient,
          actor: input.actor,
          text: input.text,
          isDemo: false,
        },
      });
      return { ok: true, channel: "WHATSAPP", demo: false };
    } catch (e) {
      const fallback = await this.fallback.send(input);
      return {
        ...fallback,
        error: e instanceof Error ? e.message : "WhatsApp send failed",
      };
    }
  }
}

/** WhatsApp when configured, otherwise the in-app demo log. */
export function defaultNotifier(client: typeof db = db): Notifier {
  return new WhatsAppNotifier({ client, fallback: new DemoNotifier(client) });
}

export async function sendNotification(
  input: NotifyInput,
  notifier: Notifier = defaultNotifier()
): Promise<NotifyResult> {
  return notifier.send(input);
}

// ---- Watcher send loop ------------------------------------------------------

/** Local calendar day, used for the AlertLog day key. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const RANK: Record<WatcherAlert["level"], number> = {
  "wedding-soon": 0,
  overdue: 1,
  urgent: 2,
  info: 3,
};

/**
 * Sending order: wedding orders first, then overdue, urgent, and info.
 * (`watcherAlerts` keeps its own display order for the dashboard.)
 */
export function rankWatcherAlerts(alerts: WatcherAlert[]): WatcherAlert[] {
  return [...alerts].sort(
    (a, b) => RANK[a.level] - RANK[b.level] || a.daysLeft - b.daysLeft
  );
}

export type WatcherRunEntry = {
  alert: WatcherAlert;
  slipId: string;
  status: "sent" | "duplicate" | "failed";
  channel?: NotificationChannel;
  error?: string;
};

export type WatcherRunResult = {
  day: string;
  generated: number;
  sent: number;
  skipped: number;
  failed: number;
  entries: WatcherRunEntry[];
};

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError
      ? e.code === "P2002"
      : (e as { code?: string } | null)?.code === "P2002"
  );
}

/**
 * Recompute today's alerts, send only the ones not already logged for this
 * slip + level + day, and record each send in AlertLog. Re-running the Watcher
 * on the same day is safe: duplicates are skipped, not resent.
 */
export async function runWatcher(
  client: typeof db = db,
  notifier: Notifier = defaultNotifier(client),
  now: Date = new Date(),
  origin?: string
): Promise<WatcherRunResult> {
  const day = dayKey(now);
  const slips = await client.slip.findMany({
    include: { karigar: true },
    orderBy: { dueDate: "asc" },
  });

  const byNumber = new Map(slips.map((s) => [s.number, s]));
  const alerts = rankWatcherAlerts(
    watcherAlerts(
      slips.map((s) => ({
        number: s.number,
        job: s.job,
        isWedding: s.isWedding,
        dueDate: s.dueDate,
        status: s.status,
        karigarName: s.karigar.name,
      }))
    )
  );

  const entries: WatcherRunEntry[] = [];
  for (const alert of alerts) {
    const slip = byNumber.get(alert.slipNumber);
    if (!slip) continue;

    try {
      await client.alertLog.create({ data: { slipId: slip.id, level: alert.level, day } });
    } catch (e) {
      if (isUniqueViolation(e)) {
        entries.push({ alert, slipId: slip.id, status: "duplicate" });
        continue;
      }
      throw e;
    }

    // Wedding nudges carry the customer's status link so the jeweller can keep
    // the family posted from the same message.
    const statusLink =
      slip.isWedding && slip.publicToken && origin
        ? ` Customer status page: ${origin.replace(/\/$/, "")}/status/${slip.publicToken}`
        : "";

    const result = await notifier.send({
      recipient: slip.karigar.phone,
      actor: `karigar:${slip.karigarId}`,
      text: `${alert.message}${statusLink}`,
      channel: "WHATSAPP",
    });

    entries.push({
      alert,
      slipId: slip.id,
      status: result.ok ? "sent" : "failed",
      channel: result.channel,
      error: result.error,
    });
  }

  const sent = entries.filter((e) => e.status === "sent").length;
  return {
    day,
    generated: alerts.length,
    sent,
    skipped: entries.filter((e) => e.status === "duplicate").length,
    failed: entries.length - sent - entries.filter((e) => e.status === "duplicate").length,
    entries,
  };
}
