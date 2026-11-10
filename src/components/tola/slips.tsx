"use client";

import * as React from "react";
import {
  SketchBox,
  SketchButton,
  Takeaway,
  Stamp,
  TapChip,
  SlipCard,
  DueChip,
  FlowArrow,
  Kicker,
} from "./sketch";
import { StickKarigar } from "./sketch";
import { fmtDate, fmtDateTime, fmtRupees, type SlipRow, type KarigarRow, type SlipStatus } from "./types";
import { useToast } from "@/hooks/use-toast";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

/* ================= Slips list ================= */

export function SlipsPanel({
  slips,
  selectedId,
  onSelect,
  onRefresh,
}: {
  slips: SlipRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = React.useState<"ALL" | SlipStatus>("ALL");
  const filtered = slips.filter((s) => filter === "ALL" || s.status === filter);
  const selected = slips.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "ISSUED", "WORKING", "RETURNED", "SETTLED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`stamp transition-transform hover:-translate-y-0.5 ${
                filter === f ? "" : "opacity-55"
              }`}
              style={{
                background: filter === f ? "var(--marker-yellow)" : "#fff",
                border: "2px solid var(--ink)",
                color: "var(--ink)",
              }}
            >
              {f === "ALL" ? "ALL" : f === "WORKING" ? "WITH KARIGAR" : f}
            </button>
          ))}
        </div>

        <div className="tola-scroll mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <SketchBox tone="gray" className="px-4 py-6 text-center font-hand text-ink-soft">
              No slips here yet.
            </SketchBox>
          )}
          {filtered.map((s, i) => (
            <button key={s.id} onClick={() => onSelect(s.id)} className="block w-full text-left">
              <SketchBox
                tone={s.id === selectedId ? "yellow" : "white"}
                variant={(["a", "b", "c", "d"] as const)[i % 4]}
                className={`px-4 py-3 transition-transform ${s.id === selectedId ? "ring-2 ring-[var(--gold-deep)]" : "hover:-translate-y-0.5"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sketch text-lg font-bold text-ink">#{s.number}</span>
                  <span className="font-hand text-base text-ink">
                    {s.job} · {s.weightGrams.toFixed(2)} g {s.purity}
                  </span>
                  {s.isWedding && (
                    <span className="stamp" style={{ background: "var(--salmon-fill)", border: "2px solid var(--salmon-line)", color: "var(--ink)" }}>
                      WEDDING
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <Stamp status={s.status} />
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-hand text-sm text-ink-soft">
                  <span>with {s.karigarName}</span>
                  <span className="flex items-center gap-1.5">
                    due
                    <DueChip
                      day={fmtDate(s.dueDate, false)}
                      month={new Date(s.dueDate).toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
                      className="scale-90"
                    />
                  </span>
                  <span>agreed wastage {s.wastageAgreedPct}%</span>
                </div>
              </SketchBox>
            </button>
          ))}
        </div>
      </div>

      <div>
        {selected ? (
          <SlipDetail slip={selected} onRefresh={onRefresh} />
        ) : (
          <SketchBox tone="paper" variant="c" className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <StickKarigar className="h-24 w-16 opacity-70" mood="happy" />
            <p className="font-hand text-lg text-ink-soft">
              Pick a slip to weigh, return, approve or settle it.
            </p>
          </SketchBox>
        )}
      </div>
    </div>
  );
}

/* ================= Slip detail with the whole flow ================= */

export function SlipDetail({ slip, onRefresh }: { slip: SlipRow; onRefresh: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [piece, setPiece] = React.useState("");
  const [scrap, setScrap] = React.useState("");
  const [statement, setStatement] = React.useState<null | {
    lines: string[];
    upiLink: string;
    clockStartedAt: string;
    waitingFor: string[];
  }>(null);

  const wastagePreview =
    slip.status === "ISSUED" || slip.status === "WORKING"
      ? (() => {
          const p = parseFloat(piece);
          const sc = parseFloat(scrap);
          if (!isFinite(p) || p <= 0 || !isFinite(sc) || sc < 0) return null;
          if (p + sc > slip.weightGrams) return null;
          return Math.round(((slip.weightGrams - p - sc) / slip.weightGrams) * 10000) / 100;
        })()
      : null;

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast({ title: done, description: "The ledger got a new entry. Both sides see it." });
      onRefresh();
    } catch (e) {
      toast({ title: "Could not do that", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SlipCard
        number={slip.number}
        weightGrams={slip.weightGrams}
        purity={slip.purity}
        job={slip.job}
        dueDate={slip.dueDate}
        isWedding={slip.isWedding}
        wastageAgreedPct={slip.wastageAgreedPct}
        jewellerApproved={slip.jewellerApproved || slip.status === "WORKING" || slip.status === "RETURNED" || slip.status === "SETTLED"}
        karigarApproved={slip.karigarApproved || slip.status === "WORKING" || slip.status === "RETURNED" || slip.status === "SETTLED"}
        className="max-w-full"
      />

      {/* ---- ISSUED ---- */}
      {slip.status === "ISSUED" && (
        <SketchBox tone="blue" variant="b" className="px-4 py-4">
          <p className="font-sketch font-bold">Step 1 · waiting for his tap</p>
          <p className="mt-1 font-hand text-base leading-relaxed text-ink">
            The jeweller tapped. {slip.karigarName} got the slip on his phone — nothing changes
            until he taps too.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <TapChip label="Jeweller" checked who="jeweller" />
            <TapChip label={slip.karigarName} checked={false} disabled who="karigar" />
            <SketchButton
              tone="green"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await post(`/api/slips/${slip.id}/confirm`);
                }, "Both taps done — gold is now in his account")
              }
            >
              Simulate: he taps confirm on his phone
            </SketchButton>
          </div>
        </SketchBox>
      )}

      {/* ---- WORKING ---- */}
      {slip.status === "WORKING" && (
        <SketchBox tone="green" variant="c" className="px-4 py-4">
          <p className="font-sketch font-bold">Gold is with {slip.karigarName}</p>
          <p className="mt-1 font-hand text-base leading-relaxed text-ink">
            Live balance seen by both. When the piece comes back, weigh it, snap the scale, and
            enter the two weights below.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="font-sketch text-sm font-bold text-ink">
              Finished piece (g)
              <input
                value={piece}
                onChange={(e) => setPiece(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 24.10"
                className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
              />
            </label>
            <label className="font-sketch text-sm font-bold text-ink">
              Scrap recovered (g)
              <input
                value={scrap}
                onChange={(e) => setScrap(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 0.30"
                className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
              />
            </label>
          </div>
          {wastagePreview !== null && (
            <p className="mt-2 font-hand text-base text-ink">
              Wastage will work out to <b>{wastagePreview}%</b> (agreed {slip.wastageAgreedPct}%).
            </p>
          )}
          <SketchButton
            tone="orange"
            className="mt-3"
            disabled={busy || wastagePreview === null}
            onClick={() =>
              run(async () => {
                await post(`/api/slips/${slip.id}/return`, {
                  pieceWeightGrams: parseFloat(piece),
                  scrapWeightGrams: parseFloat(scrap),
                });
                setPiece("");
                setScrap("");
              }, "Return recorded — wastage worked out")
            }
          >
            Record the return
          </SketchButton>
        </SketchBox>
      )}

      {/* ---- RETURNED ---- */}
      {slip.status === "RETURNED" && (
        <>
          <SketchBox tone="orange" variant="b" className="px-4 py-4">
            <p className="font-sketch font-bold">Step 3 · wastage, worked out in the open</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-hand text-base text-ink">
              <span>
                Piece: <b>{(slip.pieceWeightGrams ?? 0).toFixed(2)} g</b>
              </span>
              <span>
                Scrap: <b>{(slip.scrapWeightGrams ?? 0).toFixed(2)} g</b>
              </span>
              <span>
                Actual wastage:{" "}
                <b className={((slip.wastageActualPct ?? 0) > slip.wastageAgreedPct + 1) ? "text-marker-red" : "text-[var(--green-ink)]"}>
                  {slip.wastageActualPct}%
                </b>{" "}
                (agreed {slip.wastageAgreedPct}%)
              </span>
            </div>
            {slip.fairFlag && (
              <p className="mt-3 border-t-2 border-dashed border-ink-soft/40 pt-3 font-hand text-base leading-relaxed text-ink">
                <b className="font-sketch">Fair-wastage agent:</b> {slip.fairFlag}
              </p>
            )}
          </SketchBox>

          <SketchBox tone="salmon" variant="c" className="px-4 py-4">
            <p className="font-sketch font-bold">Step 4 · settle — both must tap</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <TapChip
                label="Jeweller"
                checked={slip.jewellerApproved}
                who="jeweller"
                onTap={() =>
                  run(async () => {
                    const r = await post(`/api/slips/${slip.id}/approve`, { side: "jeweller" });
                    if (r.settled) toast({ title: "Settled! UPI paid out." });
                  }, "Jeweller approved")
                }
              />
              <TapChip
                label={slip.karigarName}
                checked={slip.karigarApproved}
                who="karigar"
                onTap={() =>
                  run(async () => {
                    const r = await post(`/api/slips/${slip.id}/approve`, { side: "karigar" });
                    if (r.settled) toast({ title: "Settled! UPI paid out." });
                  }, `${slip.karigarName} approved`)
                }
              />
              <span className="font-hand text-sm text-ink-soft">
                (tap either side here to see both approvals — on two real phones they are two people)
              </span>
            </div>

            <div className="mt-4">
              {statement ? (
                <div className="border-[2.5px] border-ink bg-white px-4 py-3 sketch">
                  <p className="font-sketch font-bold text-ink">Statement for both phones</p>
                  <ul className="mt-1 space-y-0.5 font-hand text-sm text-ink sm:text-base">
                    {statement.lines.map((l) => (
                      <li key={l}>• {l}</li>
                    ))}
                  </ul>
                  <p className="mt-2 flex items-center gap-2 font-hand text-sm text-[var(--blue-ink)]">
                    <span className="font-sketch font-bold">UPI link ready:</span>
                    <code className="rounded bg-[var(--blue-fill)] px-1.5 py-0.5 text-xs">{statement.upiLink}</code>
                  </p>
                  <p className="mt-1 font-hand text-sm text-ink-soft">
                    Payment clock started {fmtDateTime(statement.clockStartedAt)} · waiting for:{" "}
                    {statement.waitingFor.length ? statement.waitingFor.join(" + ") : "nobody — both tapped"}
                  </p>
                </div>
              ) : (
                <SketchButton
                  tone="blue"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await post("/api/agents/settler", { slipId: slip.id });
                      setStatement(r.statement);
                    }, "Settler built the statements and started the clock")
                  }
                >
                  Run Settler: statements + payment clock + UPI link
                </SketchButton>
              )}
            </div>
          </SketchBox>
        </>
      )}

      {/* ---- SETTLED ---- */}
      {slip.status === "SETTLED" && (
        <SketchBox tone="green" variant="b" className="px-4 py-4">
          <p className="font-sketch text-lg font-bold text-[var(--green-ink)]">
            Settled — paid on the clock, not on mood
          </p>
          <div className="mt-2 space-y-1 font-hand text-base text-ink">
            <p>
              Making charges paid: <b>{fmtRupees(slip.payment?.amount ?? slip.makingCharges ?? 0)}</b> by{" "}
              {slip.payment?.method ?? "UPI"}
            </p>
            <p>Paid at: {slip.paidAt ? fmtDateTime(slip.paidAt) : "—"}</p>
            <p>
              Wastage: {slip.wastageActualPct}% against agreed {slip.wastageAgreedPct}%
            </p>
          </div>
        </SketchBox>
      )}

      <p className="font-hand text-sm text-ink-soft">
        Every step above wrote one entry to the shared ledger. Hash-linked, so tampering shows.
      </p>
    </div>
  );
}

/* ================= Issue gold form ================= */

export type ScribeDraft = {
  karigarId?: string;
  weightGrams?: number;
  purity?: string;
  job?: string;
  isWedding?: boolean;
  dueDate?: string;
  wastageAgreedPct?: number;
};

export function IssuePanel({
  karigars,
  onCreated,
  prefill,
}: {
  karigars: KarigarRow[];
  onCreated: (slip: SlipRow) => void;
  prefill?: ScribeDraft | null;
}) {
  const { toast } = useToast();
  const [karigarId, setKarigarId] = React.useState(karigars[0]?.id ?? "");
  const [weight, setWeight] = React.useState("");
  const [purity, setPurity] = React.useState("22K");
  const [job, setJob] = React.useState("");
  const [wedding, setWedding] = React.useState(false);
  const [wastage, setWastage] = React.useState("3");
  const [due, setDue] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!prefill) return;
    if (prefill.karigarId) setKarigarId(prefill.karigarId);
    if (prefill.weightGrams) setWeight(String(prefill.weightGrams));
    if (prefill.purity) setPurity(prefill.purity);
    if (prefill.job) setJob(prefill.job);
    if (prefill.isWedding !== undefined) setWedding(prefill.isWedding);
    if (prefill.wastageAgreedPct !== undefined) setWastage(String(prefill.wastageAgreedPct));
    if (prefill.dueDate) setDue(prefill.dueDate.slice(0, 10));
  }, [prefill]);

  const makingCharges = (() => {
    const w = parseFloat(weight);
    if (!isFinite(w) || w <= 0) return null;
    return Math.round((w * 380) / 10) * 10;
  })();

  async function submit() {
    setBusy(true);
    try {
      const r = await post("/api/slips", {
        karigarId,
        weightGrams: parseFloat(weight),
        purity,
        job,
        isWedding: wedding,
        wastageAgreedPct: parseFloat(wastage),
        dueDate: new Date(due + "T09:00:00").toISOString(),
      });
      toast({
        title: `Slip #${r.slip.number} issued`,
        description: "Jeweller tapped. Now the karigar must tap on his phone.",
      });
      setWeight("");
      setJob("");
      setWedding(false);
      onCreated(r.slip as SlipRow);
    } catch (e) {
      toast({
        title: "Could not issue the slip",
        description: e instanceof Error ? e.message : "Check the fields",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = karigarId && parseFloat(weight) > 0 && job.trim().length > 2 && due;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <SketchBox tone="paper" variant="b" className="px-5 py-5">
        <p className="font-sketch text-xl font-bold text-ink">Weigh, snap the scale, fill the slip</p>
        <p className="mt-1 font-hand text-base text-ink-soft">
          The weight can come from a photo of the scale, or from speech. Here, type it like the
          Scribe agent would read it.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="font-sketch text-sm font-bold text-ink">
            Karigar
            <select
              value={karigarId}
              onChange={(e) => setKarigarId(e.target.value)}
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none"
            >
              {karigars.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} — {k.speciality}
                </option>
              ))}
            </select>
          </label>
          <label className="font-sketch text-sm font-bold text-ink">
            Purity
            <select
              value={purity}
              onChange={(e) => setPurity(e.target.value)}
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none"
            >
              {["22K", "18K", "24K"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="font-sketch text-sm font-bold text-ink">
            Gold issued (g)
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              placeholder="25.40"
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </label>
          <label className="font-sketch text-sm font-bold text-ink">
            Agreed wastage (%)
            <input
              value={wastage}
              onChange={(e) => setWastage(e.target.value)}
              inputMode="decimal"
              placeholder="3"
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </label>
          <label className="font-sketch text-sm font-bold text-ink sm:col-span-2">
            Job
            <input
              value={job}
              onChange={(e) => setJob(e.target.value)}
              placeholder="Necklace set"
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </label>
          <label className="font-sketch text-sm font-bold text-ink">
            Due date
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </label>
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={wedding}
              onChange={(e) => setWedding(e.target.checked)}
              className="h-5 w-5 accent-[var(--marker-red)]"
            />
            <span className="font-sketch text-sm font-bold text-ink">
              Wedding order — dates come first
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <SketchButton tone="yellow" disabled={busy || !canSubmit} onClick={submit}>
            Tap to issue — slip goes to both phones
          </SketchButton>
          {makingCharges !== null && (
            <span className="font-hand text-base text-ink-soft">
              Making charges at settle: ~{fmtRupees(makingCharges)} (demo rate ₹380/g)
            </span>
          )}
        </div>
      </SketchBox>

      <div className="space-y-4">
        <Takeaway>Nothing changes without both taps.</Takeaway>
        <SketchBox tone="white" variant="c" className="px-5 py-4">
          <p className="font-sketch font-bold text-ink">What happens next</p>
          <div className="mt-3 space-y-2">
            {[
              "You tap — the slip reaches his phone.",
              "He taps — the gold shows in his account, seen by both.",
              "He works. The balance stays visible to both sides.",
              "On return: piece and scrap weighed, wastage worked out.",
              "Both approve. UPI pays out on the clock.",
            ].map((t, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <span className="num-dot !h-6 !w-6 text-xs">{i + 1}</span>
                <p className="font-hand text-sm text-ink sm:text-base">{t}</p>
                {i < arr.length - 1 && <FlowArrow className="ml-auto hidden h-5 w-7 sm:block" />}
              </div>
            ))}
          </div>
        </SketchBox>
        <Kicker>Prototype scope: one jeweller · three karigars</Kicker>
      </div>
    </div>
  );
}
