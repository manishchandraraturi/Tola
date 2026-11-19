import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  customerStatusDto,
  customerStatusLine,
  type CustomerStatusDTO,
} from "@/lib/tola";
import { SketchBox, Takeaway, Kicker } from "@/components/tola/sketch";

export const dynamic = "force-dynamic";

// Public page — no login. Everything it renders comes from the whitelisted
// customerStatusDto: no weights, purity, wastage, karigar name, money or hashes.
const STEPS = ["Order taken", "Gold with karigar", "Back for checking", "Settled"];

function longDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function countdownLabel(dto: CustomerStatusDTO) {
  if (dto.status === "SETTLED") return "Completed";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dto.dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "Due tomorrow";
  if (days === 0) return "Due today";
  const late = Math.abs(days);
  return `${late} day${late === 1 ? "" : "s"} past the planned date`;
}

export default async function CustomerStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length > 128) notFound();

  const slip = await db.slip.findUnique({ where: { publicToken: token } });
  if (!slip) notFound();

  const events = await db.ledgerEntry.findMany({
    where: { slipId: slip.id },
    orderBy: { seq: "asc" },
    select: { kind: true, createdAt: true },
    take: 200,
  });

  const dto = customerStatusDto(slip, events);
  if (!dto) notFound();

  const currentStep = dto.progressStep;
  const lastEvents = [...dto.events].reverse();

  return (
    <main className="paper-bg min-h-screen px-5 py-10 font-hand text-ink">
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-[2.5px] border-ink pb-3">
          <div>
            <p className="font-sketch text-3xl font-bold">Tola</p>
            <p className="text-ink-soft">Sri Lakshmi Jewellers · Bengaluru</p>
            <p className="mt-1 font-sketch text-lg font-bold">
              Order #{dto.number} · {dto.job}
            </p>
          </div>
          {dto.isWedding && (
            <span
              className="stamp"
              style={{
                background: "var(--salmon-fill)",
                border: "2px solid var(--salmon-line)",
                color: "var(--salmon-ink)",
              }}
            >
              WEDDING ORDER
            </span>
          )}
        </header>

        <div className="mt-5">
          <Takeaway>{countdownLabel(dto)}</Takeaway>
        </div>

        <SketchBox tone="white" variant="b" className="mt-5 px-5 py-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-sketch text-lg font-bold">Where your order is</p>
            <span className="font-hand text-sm text-ink-soft">
              Step {currentStep} of 4
            </span>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {STEPS.map((label, i) => {
              const step = i + 1;
              const done = step <= currentStep;
              const current = step === currentStep;
              return (
                <div key={label} className="flex flex-col items-center text-center">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] font-sketch text-sm font-bold"
                    style={{
                      borderColor: done ? "var(--green-line)" : "var(--ink)",
                      background: current
                        ? "var(--marker-yellow)"
                        : done
                          ? "var(--green-fill)"
                          : "#fff",
                      color: done ? "var(--green-ink)" : "var(--ink)",
                    }}
                    aria-current={current ? "step" : undefined}
                  >
                    {done && !current ? "✓" : step}
                  </div>
                  <p
                    className={`mt-2 font-hand text-xs leading-tight sm:text-sm ${
                      done ? "text-ink" : "text-ink-soft"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-5 border-t-2 border-dashed border-ink-soft/40 pt-3 text-base leading-relaxed">
            {customerStatusLine(dto.status)}
          </p>
        </SketchBox>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SketchBox tone="blue" variant="c" className="px-4 py-4">
            <p className="font-sketch text-sm font-bold">Planned date</p>
            <p className="mt-1 text-lg">{longDate(dto.dueDate)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {dto.status === "SETTLED"
                ? "This order is complete."
                : "The jeweller will update this page as the piece moves."}
            </p>
          </SketchBox>
          <SketchBox tone="yellow" variant="c" className="px-4 py-4">
            <p className="font-sketch text-sm font-bold">Opened</p>
            <p className="mt-1 text-lg">{longDate(dto.createdAt)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              One shared record. Nothing changes without both sides approving.
            </p>
          </SketchBox>
        </div>

        <SketchBox tone="white" variant="a" className="mt-5 px-5 py-4">
          <p className="font-sketch text-lg font-bold">Latest updates</p>
          {lastEvents.length === 0 ? (
            <p className="mt-2 text-ink-soft">The order has just been opened.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {lastEvents.map((event) => (
                <li key={`${event.label}-${event.at}`} className="flex items-start gap-2">
                  <span className="mt-1 text-[var(--green-ink)]">✓</span>
                  <span>
                    <span className="block text-base">{event.label}</span>
                    <span className="block text-xs text-ink-soft">
                      {shortDateTime(event.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SketchBox>

        <p className="mt-5 border-t-2 border-dashed border-ink-soft/40 pt-3 text-sm text-ink-soft">
          This page is for the customer. It deliberately never shows gold weights, making charges,
          payments, the karigar&apos;s details or ledger proofs — only progress. Keep the link
          private; it stops working if the jeweller revokes it, and 30 days after settlement.
        </p>
        <Kicker className="mt-4">Tola · nothing changes without both taps</Kicker>
      </div>
    </main>
  );
}
