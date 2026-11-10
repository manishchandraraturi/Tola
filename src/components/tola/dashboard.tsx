"use client";

import * as React from "react";
import {
  LayoutDashboard,
  ScrollText,
  PenLine,
  Users,
  Bot,
  BookLock,
  Globe,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import {
  SketchBox,
  SketchButton,
  Takeaway,
  SectionTitle,
  GoldBar,
  DueChip,
  Kicker,
} from "./sketch";
import { SlipsPanel, IssuePanel, ScribeDraft } from "./slips";
import {
  fmtDate,
  fmtDateTime,
  fmtRupees,
  type StateResponse,
  type SlipRow,
  type WatcherAlert,
} from "./types";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "slips" | "issue" | "karigars" | "agents" | "ledger";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "slips", label: "Gold slips", icon: <ScrollText className="h-4 w-4" /> },
  { id: "issue", label: "Issue gold", icon: <PenLine className="h-4 w-4" /> },
  { id: "karigars", label: "Karigars", icon: <Users className="h-4 w-4" /> },
  { id: "agents", label: "AI agents", icon: <Bot className="h-4 w-4" /> },
  { id: "ledger", label: "Ledger", icon: <BookLock className="h-4 w-4" /> },
];

const KIND_TONE: Record<string, { bg: string; line: string }> = {
  ISSUE: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
  TAP: { bg: "var(--marker-yellow-soft)", line: "#B99420" },
  RETURN: { bg: "var(--orange-fill)", line: "var(--orange-line)" },
  APPROVE: { bg: "var(--green-fill)", line: "var(--green-line)" },
  SETTLE: { bg: "var(--green-fill)", line: "var(--green-line)" },
  FLAG: { bg: "var(--salmon-fill)", line: "var(--salmon-line)" },
  CLOCK: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
};

export default function Dashboard({
  onExit,
  onOpenKarigar,
}: {
  onExit: () => void;
  onOpenKarigar: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("overview");
  const [state, setState] = React.useState<StateResponse | null>(null);
  const [selectedSlipId, setSelectedSlipId] = React.useState<string | null>(null);
  const [prefill, setPrefill] = React.useState<ScribeDraft | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data: StateResponse = await res.json();
      setState(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function reseed() {
    setLoading(true);
    await fetch("/api/seed", { method: "POST" });
    setSelectedSlipId(null);
    await refresh();
    toast({ title: "Demo reset", description: "Back to the prototype's seed data." });
  }

  if (loading && !state) {
    return (
      <div className="paper-bg flex min-h-screen items-center justify-center font-hand">
        <div className="flex flex-col items-center gap-4">
          <GoldBar label="1 TOLA" className="tola-float h-16 w-32" />
          <p className="font-sketch text-xl font-bold text-ink">Opening the shared record…</p>
        </div>
      </div>
    );
  }
  if (!state) return null;

  const selectedSlip = state.slips.find((s) => s.id === selectedSlipId) ?? null;

  return (
    <div className="paper-bg flex min-h-screen flex-col font-hand">
      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-40 border-b-[2.5px] border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <button onClick={onExit} className="flex items-center gap-2" title="Back to the website">
            <GoldBar label="1 TOLA" className="h-7 w-12" />
            <span className="font-sketch text-2xl font-bold text-ink">Tola</span>
          </button>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="font-sketch text-sm font-bold text-ink">{state.jeweller.name}</span>
            <span className="font-hand text-xs text-ink-soft">
              {state.jeweller.city} · prototype: one jeweller, three karigars
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenKarigar}
              className="flex items-center gap-1.5 border-[2.5px] border-ink bg-white px-3 py-1.5 font-sketch text-sm font-bold text-ink sketch-c transition-transform hover:-translate-y-0.5"
            >
              <Smartphone className="h-4 w-4" />
              Karigar&apos;s phone
            </button>
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 border-[2.5px] border-ink-soft bg-white px-3 py-1.5 font-sketch text-sm font-bold text-ink-soft sketch-c transition-transform hover:-translate-y-0.5"
            >
              <Globe className="h-4 w-4" />
              Website
            </button>
            <button
              onClick={reseed}
              title="Reset the demo data"
              className="flex items-center gap-1.5 border-[2.5px] border-ink bg-[var(--marker-yellow)] px-3 py-1.5 font-sketch text-sm font-bold text-ink sketch-c transition-transform hover:-translate-y-0.5"
            >
              <RotateCcw className="h-4 w-4" />
              Reset demo
            </button>
          </div>
        </div>
        {/* tabs */}
        <nav aria-label="Dashboard sections" className="border-t-2 border-dashed border-ink-soft/40">
          <div className="tola-scroll mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 border-[2.5px] px-3 py-1.5 font-sketch text-sm font-bold transition-all sketch-c ${
                  tab === t.id
                    ? "border-ink bg-[var(--marker-yellow)] text-ink"
                    : "border-ink-soft/60 bg-white text-ink-soft hover:border-ink hover:text-ink"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {tab === "overview" && <Overview state={state} onSelectSlip={(id) => { setSelectedSlipId(id); setTab("slips"); }} onIssue={() => setTab("issue")} />}
        {tab === "slips" && (
          <SlipsPanel
            slips={state.slips}
            selectedId={selectedSlipId}
            onSelect={setSelectedSlipId}
            onRefresh={refresh}
          />
        )}
        {tab === "issue" && (
          <IssuePanel
            karigars={state.karigars}
            prefill={prefill}
            onCreated={(slip) => {
              setSelectedSlipId(slip.id);
              setTab("slips");
              refresh();
            }}
          />
        )}
        {tab === "karigars" && <Karigars state={state} />}
        {tab === "agents" && <Agents state={state} onPrefill={(d) => { setPrefill({ ...(d ?? {}) }); setTab("issue"); }} onSelectSlipByNumber={(n) => { const id = state.slips.find((s) => s.number === n)?.id; if (id) { setSelectedSlipId(id); setTab("slips"); } }} onRefresh={refresh} />}
        {tab === "ledger" && <Ledger state={state} />}
      </main>

      <footer className="mt-auto border-t-[2.5px] border-ink bg-[var(--paper-deep)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-hand text-sm text-ink-soft">
            Tola — every gram, one record, two signatures.
          </p>
          <Kicker>Tech4Bharat 2026 | Problem 2.2: Jeweltech</Kicker>
        </div>
      </footer>
    </div>
  );
}

/* ================= Overview ================= */

function Overview({
  state,
  onSelectSlip,
  onIssue,
}: {
  state: StateResponse;
  onSelectSlip: (id: string) => void;
  onIssue: () => void;
}) {
  const { stats } = state;
  const kpis = [
    { label: "Gold with karigars", value: `${stats.goldOut.toFixed(2)} g`, sub: "live balance, seen by both", tone: "gold" as const },
    { label: "Open slips", value: String(stats.openSlips), sub: `${stats.settledCount} settled so far`, tone: "blue" as const },
    { label: "Due within 7 days", value: String(stats.dueSoon), sub: "wedding dates come first", tone: "salmon" as const },
    { label: "Days to pay a karigar", value: `${stats.avgPayDays}`, sub: `${fmtRupees(stats.paidTotal)} paid by UPI`, tone: "green" as const },
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>One dashboard: every karigar, every open order</SectionTitle>
        <SketchButton tone="yellow" className="ml-auto" onClick={onIssue}>
          + Issue gold
        </SketchButton>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <SketchBox key={k.label} tone={k.tone} variant={(["a", "b", "c", "d"] as const)[i]} className="px-4 py-4">
            <p className="font-sketch text-sm font-bold tracking-wide opacity-80">{k.label}</p>
            <p className="mt-1 font-sketch text-3xl font-bold">{k.value}</p>
            <p className="mt-1 font-hand text-sm opacity-80">{k.sub}</p>
          </SketchBox>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Watcher alerts */}
        <SketchBox tone="white" variant="b" className="px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="font-sketch text-lg font-bold text-ink">Watcher · what needs you today</p>
            <span className="stamp" style={{ background: "var(--marker-yellow)", border: "2px solid #B99420", color: "var(--ink)" }}>
              AI SUGGESTS · YOU APPROVE
            </span>
          </div>
          <div className="tola-scroll mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {state.alerts.length === 0 && (
              <p className="font-hand text-base text-ink-soft">All quiet. Nothing due this week.</p>
            )}
            {state.alerts.map((a) => (
              <AlertRow key={a.slipNumber} alert={a} onClick={() => onSelectSlip(state.slips.find((s) => s.number === a.slipNumber)?.id ?? "")} />
            ))}
          </div>
        </SketchBox>

        {/* Karigar balances */}
        <div className="space-y-3">
          <p className="font-sketch text-lg font-bold text-ink">Live gold balance with each karigar</p>
          {state.karigars.map((k, i) => (
            <SketchBox key={k.id} tone={k.goldBalance > 0 ? "yellow" : "gray"} variant={(["b", "c", "d"] as const)[i % 3]} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div>
                <p className="font-sketch text-base font-bold text-ink">{k.name}</p>
                <p className="font-hand text-sm text-ink-soft">
                  {k.speciality} · {k.openSlips} open slip{k.openSlips === 1 ? "" : "s"}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-sketch text-2xl font-bold text-ink">{k.goldBalance.toFixed(2)} g</p>
                <p className="font-hand text-xs text-ink-soft">gold in his hands</p>
              </div>
            </SketchBox>
          ))}
          <p className="font-hand text-sm text-ink-soft">
            The same numbers sit on each karigar&apos;s phone. One record instead of two memories.
          </p>
        </div>
      </div>

      {/* Latest ledger */}
      <SketchBox tone="paper" variant="a" className="px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="font-sketch text-lg font-bold text-ink">Latest entries in the shared ledger</p>
          <span className="font-hand text-sm text-ink-soft">append-only · hash-linked</span>
        </div>
        <div className="mt-2 divide-y divide-dashed divide-ink-soft/40">
          {state.ledger.slice(0, 5).map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span
                className="stamp"
                style={{
                  background: (KIND_TONE[e.kind] ?? KIND_TONE.ISSUE).bg,
                  border: `2px solid ${(KIND_TONE[e.kind] ?? KIND_TONE.ISSUE).line}`,
                  color: "var(--ink)",
                }}
              >
                {e.kind}
              </span>
              <p className="min-w-0 flex-1 font-hand text-sm text-ink sm:text-base">{e.text}</p>
              <span className="font-mono text-[10px] text-ink-soft">{e.hash.slice(0, 8)}…</span>
            </div>
          ))}
        </div>
      </SketchBox>
    </div>
  );
}

function AlertRow({ alert, onClick }: { alert: WatcherAlert; onClick: () => void }) {
  const tone = {
    "wedding-soon": { bg: "var(--salmon-fill)", line: "var(--salmon-line)" },
    urgent: { bg: "var(--marker-yellow)", line: "#B99420" },
    overdue: { bg: "var(--salmon-fill)", line: "var(--salmon-line)" },
    info: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
  }[alert.level];
  return (
    <button onClick={onClick} className="block w-full text-left">
      <div
        className="flex items-start gap-3 border-[2px] px-3 py-2 sketch-c transition-transform hover:-translate-y-0.5"
        style={{ background: tone.bg, borderColor: tone.line }}
      >
        <DueChip
          day={fmtDate(alert.dueDate, false)}
          month={new Date(alert.dueDate).toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
          className="mt-0.5 scale-90"
        />
        <p className="flex-1 font-hand text-sm leading-snug text-ink sm:text-base">{alert.message}</p>
      </div>
    </button>
  );
}

/* ================= Karigars ================= */

function Karigars({ state }: { state: StateResponse }) {
  return (
    <div className="space-y-6">
      <SectionTitle>Every karigar, his balance, his history</SectionTitle>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {state.karigars.map((k, i) => {
          const his = state.slips.filter((s) => s.karigarId === k.id);
          const settled = his.filter((s) => s.status === "SETTLED" && s.wastageActualPct !== null);
          const vals = settled.map((s) => s.wastageActualPct as number);
          const band = vals.length
            ? `${Math.min(...vals).toFixed(1)}% – ${Math.max(...vals).toFixed(1)}%`
            : "no history yet";
          const paid = his.reduce((a, s) => a + (s.payment?.amount ?? 0), 0);
          return (
            <SketchBox key={k.id} tone="paper" variant={(["a", "b", "c"] as const)[i % 3]} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="font-sketch text-xl font-bold text-ink">{k.name}</p>
                <span className="stamp" style={{ background: "var(--green-fill)", border: "2px solid var(--green-line)", color: "var(--green-ink)" }}>
                  FREE, ALWAYS
                </span>
              </div>
              <p className="font-hand text-sm text-ink-soft">
                {k.speciality} · {k.city} · {k.phone}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="border-2 border-ink-soft/50 bg-white px-1 py-2 sketch-c">
                  <p className="font-sketch text-lg font-bold text-ink">{k.goldBalance.toFixed(2)} g</p>
                  <p className="font-hand text-[11px] text-ink-soft">gold with him</p>
                </div>
                <div className="border-2 border-ink-soft/50 bg-white px-1 py-2 sketch-c">
                  <p className="font-sketch text-lg font-bold text-ink">{k.openSlips}</p>
                  <p className="font-hand text-[11px] text-ink-soft">open slips</p>
                </div>
                <div className="border-2 border-ink-soft/50 bg-white px-1 py-2 sketch-c">
                  <p className="font-sketch text-lg font-bold text-ink">{settled.length}</p>
                  <p className="font-hand text-[11px] text-ink-soft">settled</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 font-hand text-sm text-ink">
                <p>Wastage band from settled jobs: <b>{band}</b></p>
                <p>Paid to date by UPI: <b>{fmtRupees(paid)}</b></p>
              </div>
            </SketchBox>
          );
        })}
      </div>
      <Takeaway>The karigar sees his full account. That is what makes the numbers trusted.</Takeaway>
    </div>
  );
}

/* ================= Agents ================= */

function Agents({
  state,
  onPrefill,
  onSelectSlipByNumber,
  onRefresh,
}: {
  state: StateResponse;
  onPrefill: (draft: ScribeDraft | null) => void;
  onSelectSlipByNumber: (slipNumber: number) => void;
  onRefresh: () => void;
}) {
  const returnable = state.slips.filter((s) => s.status === "RETURNED");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>Four agents, one job: keep it fair</SectionTitle>
        <span className="stamp ml-auto" style={{ background: "var(--marker-yellow)", border: "2px solid #B99420", color: "var(--ink)" }}>
          AI SUGGESTS · PEOPLE APPROVE
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ScribeConsole karigars={state.karigars} onPrefill={onPrefill} />
        <WatcherConsole alerts={state.alerts} onSelectSlipByNumber={onSelectSlipByNumber} onRefresh={onRefresh} />
        <FairConsole />
        <SettlerConsole slips={returnable} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

function ScribeConsole({
  karigars,
  onPrefill,
}: {
  karigars: StateResponse["karigars"];
  onPrefill: (draft: ScribeDraft | null) => void;
}) {
  const [text, setText] = React.useState("25.4 grams 22K necklace set wastage 3, due 12 Nov, wedding order");
  const [out, setOut] = React.useState<null | { heard: string; note: string; missing: string[]; parsed: ScribeDraft & { wastage?: number } }>(null);
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  async function run() {
    setBusy(true);
    setOut(null);
    try {
      const res = await fetch("/api/agents/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOut(data);
    } catch (e) {
      toast({ title: "Scribe could not listen", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SketchBox tone="blue" variant="a" className="flex flex-col px-4 py-4">
      <p className="font-sketch text-lg font-bold text-ink">Scribe · voice and scale photos become slips</p>
      <p className="mt-1 font-hand text-sm text-ink-soft">
        Speak in Kannada or Hindi, or snap the scale. (Demo: type what was said.)
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mt-2 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <SketchButton tone="blue" onClick={run} disabled={busy}>
          {busy ? "Listening…" : "Let Scribe listen"}
        </SketchButton>
        <button
          onClick={() => setText("14 grams 18K ring set, wastage 3, in 5 days")}
          className="font-hand text-sm text-ink-soft underline hover:text-ink"
        >
          try another sentence
        </button>
      </div>
      {out && (
        <div className="tola-pop mt-3 border-[2px] border-ink bg-white px-3 py-2 sketch-c">
          <p className="font-hand text-sm text-ink">{out.heard}</p>
          <p className="mt-1 font-hand text-sm text-ink-soft">{out.note}</p>
          <SketchButton
            tone="yellow"
            className="mt-2 !py-1 text-sm"
            onClick={() =>
              onPrefill({
                karigarId: karigars[0]?.id,
                weightGrams: out.parsed.weight,
                purity: out.parsed.purity,
                job: out.parsed.job,
                isWedding: out.parsed.wedding,
                dueDate: out.parsed.due,
                wastageAgreedPct: out.parsed.wastage,
              })
            }
          >
            Send to the issue form →
          </SketchButton>
        </div>
      )}
    </SketchBox>
  );
}

function WatcherConsole({
  alerts,
  onSelectSlipByNumber,
  onRefresh,
}: {
  alerts: WatcherAlert[];
  onSelectSlipByNumber: (slipNumber: number) => void;
  onRefresh: () => void;
}) {
  const [ran, setRan] = React.useState(false);
  return (
    <SketchBox tone="yellow" variant="b" className="flex flex-col px-4 py-4">
      <p className="font-sketch text-lg font-bold text-ink">Watcher · due dates, wedding dates first</p>
      <p className="mt-1 font-hand text-sm text-ink-soft">
        Watches every slip, warns early, nudges on WhatsApp. SMS as fallback.
      </p>
      <div className="mt-2">
        <SketchButton
          tone="yellow"
          onClick={async () => {
            await fetch("/api/agents/watcher");
            setRan(true);
            onRefresh();
          }}
        >
          Run the Watcher now
        </SketchButton>
      </div>
      <div className="tola-scroll mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {(ran ? alerts : alerts.slice(0, 2)).map((a) => (
          <button
            key={a.slipNumber + a.level}
            onClick={() => onSelectSlipByNumber(a.slipNumber)}
            className="block w-full text-left border-[2px] border-ink-soft/50 bg-white px-3 py-1.5 font-hand text-sm leading-snug sketch-c transition-transform hover:-translate-y-0.5"
          >
            <b className="font-sketch">#{a.slipNumber}</b> · {a.message}
          </button>
        ))}
        {alerts.length === 0 && <p className="font-hand text-sm text-ink-soft">All quiet right now.</p>}
      </div>
    </SketchBox>
  );
}

function FairConsole() {
  const [out, setOut] = React.useState<null | {
    summary: string;
    bands: Array<{ name: string; jobs: number; band: { min: number; avg: number; max: number } | null; flags: Array<{ slipNumber: number; text: string }> }>;
  }>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <SketchBox tone="green" variant="c" className="flex flex-col px-4 py-4">
      <p className="font-sketch text-lg font-bold text-ink">Fair-wastage · plain words, never accuses</p>
      <p className="mt-1 font-hand text-sm text-ink-soft">
        Compares each job with that pair&apos;s history and the usual range.
      </p>
      <div className="mt-2">
        <SketchButton
          tone="green"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/agents/fairwastage");
            setOut(await res.json());
            setBusy(false);
          }}
        >
          {busy ? "Checking…" : "Check every pair"}
        </SketchButton>
      </div>
      {out && (
        <div className="tola-pop mt-3 space-y-2">
          <p className="font-hand text-sm text-ink">{out.summary}</p>
          {out.bands.map((b) => (
            <div key={b.name} className="border-[2px] border-ink-soft/50 bg-white px-3 py-2 sketch-c">
              <p className="font-sketch text-sm font-bold text-ink">
                {b.name}{" "}
                <span className="font-hand font-normal text-ink-soft">
                  · {b.jobs} settled job{b.jobs === 1 ? "" : "s"} · band{" "}
                  {b.band ? `${b.band.min}% – ${b.band.max}% (avg ${b.band.avg}%)` : "not enough history yet"}
                </span>
              </p>
              {b.flags.map((f) => (
                <p key={f.slipNumber} className="mt-1 font-hand text-sm leading-snug text-ink">
                  <b>#{f.slipNumber}</b> — {f.text}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </SketchBox>
  );
}

function SettlerConsole({
  slips,
  onRefresh,
}: {
  slips: SlipRow[];
  onRefresh: () => void;
}) {
  const [slipId, setSlipId] = React.useState(slips[0]?.id ?? "");
  const [out, setOut] = React.useState<null | { lines: string[]; upiLink: string; clockStartedAt: string; waitingFor: string[] }>(null);
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!slips.find((s) => s.id === slipId)) {
      setSlipId(slips[0]?.id ?? "");
      setOut(null);
    }
  }, [slips, slipId]);

  return (
    <SketchBox tone="salmon" variant="d" className="flex flex-col px-4 py-4">
      <p className="font-sketch text-lg font-bold text-ink">Settler · statements, clock, UPI</p>
      <p className="mt-1 font-hand text-sm text-ink-soft">
        Builds both statements, starts the payment clock, waits for both approvals.
      </p>
      {slips.length === 0 ? (
        <p className="mt-3 font-hand text-base text-ink-soft">
          No returned slips waiting right now. Record a return on a slip first.
        </p>
      ) : (
        <>
          <select
            value={slipId}
            onChange={(e) => {
              setSlipId(e.target.value);
              setOut(null);
            }}
            className="mt-2 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none"
          >
            {slips.map((s) => (
              <option key={s.id} value={s.id}>
                Slip #{s.number} · {s.job} · {s.karigarName}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <SketchButton
              tone="salmon"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await fetch("/api/agents/settler", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slipId }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setOut(data.statement);
                  onRefresh();
                } catch (e) {
                  toast({ title: "Settler cannot start", description: e instanceof Error ? e.message : "", variant: "destructive" });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Building…" : "Build statements + start the clock"}
            </SketchButton>
          </div>
          {out && (
            <div className="tola-pop mt-3 border-[2px] border-ink bg-white px-3 py-2 sketch-c">
              <ul className="space-y-0.5 font-hand text-sm text-ink">
                {out.lines.map((l) => (
                  <li key={l}>• {l}</li>
                ))}
              </ul>
              <p className="mt-2 font-hand text-xs text-ink-soft">
                Clock started {fmtDateTime(out.clockStartedAt)} · waiting for{" "}
                {out.waitingFor.length ? out.waitingFor.join(" + ") : "nobody"}
              </p>
            </div>
          )}
        </>
      )}
    </SketchBox>
  );
}

/* ================= Ledger ================= */

function Ledger({ state }: { state: StateResponse }) {
  return (
    <div className="space-y-5">
      <SectionTitle>The shared ledger</SectionTitle>
      <SketchBox tone="paper" variant="a" className="px-4 py-3">
        <p className="font-hand text-sm text-ink-soft sm:text-base">
          Append-only entries, each one hash-linked to the one before it. Both sides confirm with an
          OTP on their own phone. If anyone edits yesterday&apos;s entry, the chain shows it — that
          is the whole point of a record both sides trust.
        </p>
      </SketchBox>
      <div className="tola-scroll max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {state.ledger.map((e, i) => {
          const tone = KIND_TONE[e.kind] ?? KIND_TONE.ISSUE;
          return (
            <div key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className="pt-1 font-mono text-[10px] text-ink-soft">{state.ledger.length - i}.</span>
              <div className="min-w-0 flex-1 border-[2px] px-3 py-2 sketch-c" style={{ background: "rgba(255,255,255,0.7)", borderColor: tone.line }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="stamp" style={{ background: tone.bg, border: `2px solid ${tone.line}`, color: "var(--ink)" }}>
                    {e.kind}
                  </span>
                  {e.slip?.number && (
                    <span className="font-sketch text-sm font-bold text-ink">slip #{e.slip.number}</span>
                  )}
                  <span className="font-hand text-xs text-ink-soft">{fmtDateTime(e.createdAt)}</span>
                  <span className="ml-auto font-mono text-[10px] text-ink-soft" title={e.hash}>
                    {e.hash.slice(0, 10)}…
                  </span>
                </div>
                <p className="mt-1 font-hand text-sm leading-snug text-ink sm:text-base">{e.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
