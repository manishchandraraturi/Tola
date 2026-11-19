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
  MessageSquare,
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
import {
  SlipsPanel,
  IssuePanel,
  ScribeDraft,
  CustomerShareButtons,
  customerStatusPath,
} from "./slips";
import { VoiceScribeCard } from "./voice-scribe";
import { ScalePhotoCard } from "./scale-photo";
import { OfflineBanner } from "./offline-banner";
import { OFFLINE_SYNCED_EVENT } from "@/lib/config";
import {
  fmtDate,
  fmtDateTime,
  fmtRupees,
  type StateResponse,
  type SlipRow,
  type WatcherAlert,
} from "./types";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher, useTranslation } from "./language-switcher";
import type { TranslationKey } from "@/lib/i18n";

type Tab = "overview" | "slips" | "issue" | "karigars" | "agents" | "messages" | "ledger";

const TABS: Array<{ id: Tab; labelKey: TranslationKey; icon: React.ReactNode }> = [
  { id: "overview", labelKey: "nav.overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "slips", labelKey: "nav.slips", icon: <ScrollText className="h-4 w-4" /> },
  { id: "issue", labelKey: "nav.issue", icon: <PenLine className="h-4 w-4" /> },
  { id: "karigars", labelKey: "nav.karigars", icon: <Users className="h-4 w-4" /> },
  { id: "agents", labelKey: "nav.agents", icon: <Bot className="h-4 w-4" /> },
  { id: "messages", labelKey: "nav.messages", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "ledger", labelKey: "nav.ledger", icon: <BookLock className="h-4 w-4" /> },
];

const KIND_TONE: Record<string, { bg: string; line: string }> = {
  ISSUE: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
  TAP: { bg: "var(--marker-yellow-soft)", line: "#B99420" },
  RETURN: { bg: "var(--orange-fill)", line: "var(--orange-line)" },
  APPROVE: { bg: "var(--green-fill)", line: "var(--green-line)" },
  SETTLE: { bg: "var(--green-fill)", line: "var(--green-line)" },
  FLAG: { bg: "var(--salmon-fill)", line: "var(--salmon-line)" },
  CLOCK: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
  DISPUTE: { bg: "var(--salmon-fill)", line: "var(--marker-red)" },
  RESOLVE: { bg: "var(--green-fill)", line: "var(--green-line)" },
  PROPOSE: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
  ACCEPT: { bg: "var(--green-fill)", line: "var(--green-line)" },
  DECLINE: { bg: "var(--orange-fill)", line: "var(--orange-line)" },
};

// Fair-wastage v2 levels → sketch chip tones.
function monthShort(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, (m ?? 1) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
}

const FAIR_TONE: Record<string, { bg: string; line: string }> = {
  ok: { bg: "var(--green-fill)", line: "var(--green-line)" },
  light: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
  heavy: { bg: "var(--orange-fill)", line: "var(--orange-line)" },
  odd: { bg: "var(--salmon-fill)", line: "var(--salmon-line)" },
  "no-history": { bg: "var(--gray-fill)", line: "var(--gray-line)" },
};

export default function Dashboard({
  onExit,
  onOpenKarigar,
  onLogout,
}: {
  onExit: () => void;
  onOpenKarigar: () => void;
  onLogout: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
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

  // A queue flush after reconnect changes the ledger; pull the fresh state.
  React.useEffect(() => {
    const onSynced = () => {
      void refresh();
    };
    window.addEventListener(OFFLINE_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(OFFLINE_SYNCED_EVENT, onSynced);
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
          <p className="font-sketch text-xl font-bold text-ink">{t("app.loading")}</p>
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
            <SketchButton
              tone="paper"
              onClick={onLogout}
              className="min-h-12 !px-3 !py-1.5 text-sm"
            >
              Logout
            </SketchButton>
            <LanguageSwitcher className="mr-1" />
            <button
              onClick={onOpenKarigar}
              className="flex min-h-12 items-center gap-1.5 border-[2.5px] border-ink bg-white px-3 py-1.5 font-sketch text-sm font-bold text-ink sketch-c transition-transform hover:-translate-y-0.5"
            >
              <Smartphone className="h-4 w-4" />
              {t("action.karigarPhone")}
            </button>
            <button
              onClick={onExit}
              className="flex min-h-12 items-center gap-1.5 border-[2.5px] border-ink-soft bg-white px-3 py-1.5 font-sketch text-sm font-bold text-ink-soft sketch-c transition-transform hover:-translate-y-0.5"
            >
              <Globe className="h-4 w-4" />
              {t("action.website")}
            </button>
            <button
              onClick={reseed}
              title="Reset the demo data"
              className="flex min-h-12 items-center gap-1.5 border-[2.5px] border-ink bg-[var(--marker-yellow)] px-3 py-1.5 font-sketch text-sm font-bold text-ink sketch-c transition-transform hover:-translate-y-0.5"
            >
              <RotateCcw className="h-4 w-4" />
              {t("action.resetDemo")}
            </button>
          </div>
        </div>
        {/* tabs */}
        <nav aria-label="Dashboard sections" className="border-t-2 border-dashed border-ink-soft/40">
          <div className="tola-scroll mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-1.5">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`flex min-h-12 shrink-0 items-center gap-1.5 border-[2.5px] px-3 py-1.5 font-sketch text-sm font-bold transition-all sketch-c ${
                  tab === tabItem.id
                    ? "border-ink bg-[var(--marker-yellow)] text-ink"
                    : "border-ink-soft/60 bg-white text-ink-soft hover:border-ink hover:text-ink"
                }`}
              >
                {tabItem.icon}
                {t(tabItem.labelKey)}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <OfflineBanner />

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
        {tab === "karigars" && <Karigars state={state} onRefresh={refresh} />}
        {tab === "agents" && <Agents state={state} onPrefill={(d) => { setPrefill({ ...(d ?? {}) }); setTab("issue"); }} onSelectSlipByNumber={(n) => { const id = state.slips.find((s) => s.number === n)?.id; if (id) { setSelectedSlipId(id); setTab("slips"); } }} onRefresh={refresh} />}
        {tab === "messages" && <Messages state={state} onRefresh={refresh} />}
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
  const { t } = useTranslation();
  const { stats } = state;
  const kpis = [
    { labelKey: "dash.goldWithKarigars" as const, value: `${stats.goldOut.toFixed(2)} g`, sub: "live balance, seen by both", tone: "gold" as const },
    { labelKey: "dash.openSlips" as const, value: String(stats.openSlips), sub: `${stats.settledCount} settled so far`, tone: "blue" as const },
    { labelKey: "dash.dueSoon" as const, value: String(stats.dueSoon), sub: "wedding dates come first", tone: "salmon" as const },
    { labelKey: "dash.daysToPay" as const, value: `${stats.avgPayDays}`, sub: `${fmtRupees(stats.paidTotal)} paid by UPI`, tone: "green" as const },
    {
      labelKey: "dash.openDisputes" as const,
      value: String(stats.disputes),
      sub: `${stats.disputesThisMonth} opened this month · avg ${stats.avgDisputeDays}d to resolve`,
      tone: "gray" as const,
    },
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>{t("dash.title")}</SectionTitle>
        <SketchButton tone="yellow" className="ml-auto min-h-12" onClick={onIssue}>
          {t("action.issueGold")}
        </SketchButton>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k, i) => (
          <SketchBox key={k.labelKey} tone={k.tone} variant={(["a", "b", "c", "d", "a"] as const)[i]} className="px-4 py-4">
            <p className="font-sketch text-sm font-bold tracking-wide opacity-80">{t(k.labelKey)}</p>
            <p className="mt-1 font-sketch text-3xl font-bold">{k.value}</p>
            <p className="mt-1 font-hand text-sm opacity-80">{k.sub}</p>
          </SketchBox>
        ))}
      </div>

      {/* P13: impact metrics + audit links */}
      <SketchBox tone="white" variant="b" className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-sketch text-lg font-bold text-ink">
            Impact · the three numbers from the deck
          </p>
          <span
            className="stamp ml-auto"
            style={{ background: "var(--blue-fill)", border: "2px solid var(--blue-line)", color: "var(--ink)" }}
          >
            MONTH BY MONTH
          </span>
        </div>
        <p className="mt-1 font-hand text-sm text-ink-soft">
          Computed from this ledger: disputes opened, days from approval to money received,
          and jobs returned by the due date.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            {
              label: "Disputes this month",
              value: String(stats.disputesThisMonth),
              sub: `${stats.disputes} open now`,
            },
            {
              label: "Avg days approval → paid",
              value: stats.avgPayDays.toFixed(1),
              sub: `${stats.paidSample} paid slip${stats.paidSample === 1 ? "" : "s"}`,
            },
            {
              label: "Returned on time",
              value: `${stats.onTimeDeliveryPct.toFixed(1)}%`,
              sub: `${stats.onTimeCount} of ${stats.returnedCount} dated returns`,
            },
            {
              label: "Gold with karigars",
              value: `${stats.goldOut.toFixed(2)} g`,
              sub: "same number on both phones",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="border-[2px] border-ink-soft/50 bg-white px-3 py-2 sketch-c"
            >
              <p className="font-hand text-xs text-ink-soft">{metric.label}</p>
              <p className="font-sketch text-2xl font-bold text-ink">{metric.value}</p>
              <p className="font-hand text-xs text-ink-soft">{metric.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.disputeTrend.map((m) => (
            <div
              key={m.month}
              className="min-w-16 flex-1 border-[2px] border-ink-soft/50 bg-white px-2 py-1 text-center sketch-c"
            >
              <p className="font-hand text-[11px] text-ink-soft">{monthShort(m.month)}</p>
              <p className="font-sketch text-lg font-bold text-ink">{m.opened}</p>
              <p className="font-hand text-[10px] text-ink-soft">opened</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-dashed border-ink-soft/40 pt-3">
          <span className="font-sketch text-sm font-bold text-ink">Audit &amp; month-end:</span>
          <a
            href="/audit/export"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center font-hand text-sm text-[var(--blue-ink)] underline"
          >
            Audit export · print view
          </a>
          <a
            href="/api/audit/export"
            className="inline-flex min-h-12 items-center font-hand text-sm text-[var(--blue-ink)] underline"
          >
            Download CSV
          </a>
          <span className="font-hand text-sm text-ink-soft">Statement:</span>
          {state.karigars.map((k) => (
            <a
              key={k.id}
              href={`/statement/karigar/${k.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center font-hand text-sm text-[var(--blue-ink)] underline"
            >
              {k.name}
            </a>
          ))}
        </div>
      </SketchBox>

      {/* P8: customer links — no login, progress only */}
      <SketchBox tone="paper" variant="c" className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-sketch text-lg font-bold text-ink">
            Customer status links · no login
          </p>
          <span
            className="stamp ml-auto"
            style={{ background: "#fff", border: "2px solid var(--ink)", color: "var(--ink)" }}
          >
            PROGRESS ONLY
          </span>
        </div>
        <p className="mt-1 font-hand text-sm text-ink-soft">
          Send a customer a private link with the due-date countdown and the last updates. It never
          shows gold weights, wastage, making charges, payments or the karigar&apos;s details.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {state.slips
            .filter((s) => s.publicToken)
            .slice(0, 4)
            .map((s) => (
              <div
                key={s.id}
                className="border-[2px] border-dashed border-ink-soft/50 bg-white px-3 py-2 sketch-c"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-sketch font-bold text-ink">#{s.number}</span>
                  <span className="font-hand text-sm text-ink">
                    {s.customerName ?? "No customer saved"}
                  </span>
                  <a
                    href={customerStatusPath(s.publicToken as string)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto font-hand text-sm text-[var(--blue-ink)] underline"
                  >
                    Open status page
                  </a>
                </div>
                <div className="mt-1">
                  <CustomerShareButtons
                    token={s.publicToken as string}
                    slipNumber={s.number}
                    customerName={s.customerName}
                    customerPhone={s.customerPhone}
                  />
                </div>
              </div>
            ))}
        </div>
      </SketchBox>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Watcher alerts */}
        <SketchBox tone="white" variant="b" className="px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="font-sketch text-lg font-bold text-ink">{t("dash.watcher")}</p>
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
          <p className="font-sketch text-lg font-bold text-ink">{t("dash.balances")}</p>
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
                <a
                  href={`/statement/karigar/${k.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex min-h-12 items-center font-hand text-xs text-[var(--blue-ink)] underline"
                >
                  Month-end statement
                </a>
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
          <p className="font-sketch text-lg font-bold text-ink">{t("dash.latestLedger")}</p>
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

function Karigars({ state, onRefresh }: { state: StateResponse; onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [speciality, setSpeciality] = React.useState("");
  const [city, setCity] = React.useState("Bengaluru");
  const [busy, setBusy] = React.useState(false);
  const count = state.karigars.length;
  const cap = state.plan.cap;
  const atCap = count >= cap;

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/karigars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, speciality, city }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not add the karigar");
      toast({ title: `${name} added`, description: "He now has his own Tola account." });
      setName("");
      setPhone("");
      setSpeciality("");
      setCity("Bengaluru");
      setOpen(false);
      onRefresh();
    } catch (e) {
      toast({ title: "Could not add the karigar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>Every karigar, his balance, his history</SectionTitle>
        <span
          className="stamp ml-auto"
          style={{ background: "var(--marker-yellow)", border: "2px solid #B99420", color: "var(--ink)" }}
        >
          Karigar {count} of {cap} · Proposed ₹{state.plan.proposedRupees}/mo plan
        </span>
      </div>

      <SketchBox tone="white" variant="b" className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-sketch text-lg font-bold text-ink">Add a karigar to the workshop</p>
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto font-hand text-sm text-ink-soft underline hover:text-ink"
          >
            {open ? "close" : "add a karigar"}
          </button>
        </div>
        <p className="mt-1 font-hand text-sm text-ink-soft">
          The cap of {cap} and ₹{state.plan.proposedRupees}/month are the <b>proposed</b> plan from the
          deck — clearly a proposal, not a limit on the prototype.
        </p>
        {atCap && (
          <p className="mt-2 font-hand text-sm text-marker-red">
            This prototype is already at the proposed {cap}-karigar cap.
          </p>
        )}
        {open && !atCap && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="font-sketch text-sm font-bold text-ink">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lakshmi Devi" className={inputCls} />
            </label>
            <label className="font-sketch text-sm font-bold text-ink">
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98450 00000" className={inputCls} />
            </label>
            <label className="font-sketch text-sm font-bold text-ink">
              Speciality
              <input value={speciality} onChange={(e) => setSpeciality(e.target.value)} placeholder="Necklace sets" className={inputCls} />
            </label>
            <label className="font-sketch text-sm font-bold text-ink">
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" className={inputCls} />
            </label>
            <div className="sm:col-span-2">
              <SketchButton tone="yellow" disabled={busy} onClick={add}>
                {busy ? "Adding…" : "Add karigar — he gets his own account"}
              </SketchButton>
            </div>
          </div>
        )}
      </SketchBox>

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
  const [text, setText] = React.useState(
    "Ravi Kumar: 25.4 grams 22K necklace set, wastage 3, due 12 Nov, wedding order"
  );
  const [out, setOut] = React.useState<null | {
    heard: string;
    note: string;
    missing: string[];
    karigarId: string | null;
    karigarName: string | null;
    parsed: {
      weight?: number;
      purity?: string;
      wastage?: number;
      wedding: boolean;
      due?: string;
      job?: string;
    };
  }>(null);
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  async function run() {
    setBusy(true);
    setOut(null);
    setPick("");
    try {
      const res = await fetch("/api/agents/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOut(data);
      // Scribe matched a name in the note? Pre-select him. Otherwise the
      // dropdown starts empty and the user picks who this slip is for.
      setPick(data.karigarId ?? "");
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
        Speak in Kannada, Hindi or English, or snap the scale. Check the confirmation card,
        then send it to the issue form.
      </p>
      <div className="mt-3 space-y-3">
        <ScalePhotoCard onUse={(draft) => onPrefill(draft)} />
        <VoiceScribeCard karigars={karigars} onUse={(draft) => onPrefill(draft)} />
      </div>
      <p className="mt-3 font-sketch text-xs font-bold uppercase tracking-wide text-ink-soft">
        Quick typed demo
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
          <label className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-sketch text-sm font-bold text-ink">This slip is for</span>
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="border-[2.5px] border-ink bg-white px-2 py-1 font-hand text-base text-ink sketch-c outline-none"
            >
              {!pick && <option value="">— pick who this is for —</option>}
              {karigars.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            {out.karigarId && pick === out.karigarId ? (
              <span className="font-hand text-xs text-ink-soft">name matched from what was said</span>
            ) : (
              <span className="font-hand text-xs text-marker-red">no name in the note — picked by hand</span>
            )}
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SketchButton
              tone="yellow"
              className="!py-1 text-sm"
              disabled={!pick}
              onClick={() =>
                onPrefill({
                  karigarId: pick,
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
            {!pick && (
              <span className="font-hand text-xs text-ink-soft">
                Scribe will not guess the karigar — pick one above first.
              </span>
            )}
          </div>
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
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();
  return (
    <SketchBox tone="yellow" variant="b" className="flex flex-col px-4 py-4">
      <p className="font-sketch text-lg font-bold text-ink">Watcher · due dates, wedding dates first</p>
      <p className="mt-1 font-hand text-sm text-ink-soft">
        Watches every slip, warns early. Reminders queue for WhatsApp and SMS.
      </p>
      <div className="mt-2">
        <SketchButton
          tone="yellow"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/agents/watcher/run", { method: "POST" });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Could not run the Watcher");
              setRan(true);
              toast({ title: "Watcher run", description: data.summary });
              onRefresh();
            } catch (e) {
              toast({ title: "Watcher could not send", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Run the Watcher now"}
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
    trade: Array<{ keyword: string; minPct: number; maxPct: number; avgPct: number; source: string }>;
    bands: Array<{
      name: string;
      jobs: number;
      band: { min: number; avg: number; max: number } | null;
      pairBand: { min: number; max: number; avg: number; median: number; q1: number; q3: number; n: number } | null;
      agreedAvg: number | null;
      actualAvg: number | null;
      flags: Array<{ slipNumber: number; level: string; text: string; evidence: string }>;
    }>;
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

          {/* trade-wide ranges — demo assumption, editable */}
          <div className="border-[2px] border-dashed border-ink-soft/60 bg-white px-3 py-2 sketch-c">
            <p className="font-sketch text-xs font-bold uppercase tracking-wide text-ink-soft">
              Trade-wide ranges · demo assumption, editable
            </p>
            <div className="mt-1 flex flex-wrap gap-2 font-hand text-sm text-ink">
              {out.trade.map((t) => (
                <span key={t.keyword} className="border-[2px] border-ink-soft/50 px-2 py-0.5 sketch-c">
                  {t.keyword} {t.minPct}%–{t.maxPct}%{" "}
                  <span className="text-ink-soft">(avg {t.avgPct}%)</span>
                </span>
              ))}
            </div>
          </div>

          {out.bands.map((b) => (
            <div key={b.name} className="border-[2px] border-ink-soft/50 bg-white px-3 py-2 sketch-c">
              <p className="font-sketch text-sm font-bold text-ink">
                {b.name}{" "}
                <span className="font-hand font-normal text-ink-soft">
                  · {b.jobs} settled job{b.jobs === 1 ? "" : "s"}
                </span>
              </p>
              <p className="mt-0.5 font-hand text-xs text-ink-soft">
                {b.pairBand
                  ? `his usual ${b.pairBand.q1}%–${b.pairBand.q3}% (median ${b.pairBand.median}%, n=${b.pairBand.n})`
                  : "not enough history yet — trade benchmark used"}
                {b.agreedAvg !== null && b.actualAvg !== null
                  ? ` · agreed avg ${b.agreedAvg}% vs actual avg ${b.actualAvg}%`
                  : ""}
              </p>
              {b.flags.map((f) => (
                <p key={f.slipNumber} className="mt-1 font-hand text-sm leading-snug text-ink">
                  <span
                    className="stamp mr-1.5 align-middle"
                    style={{
                      background: (FAIR_TONE[f.level] ?? FAIR_TONE["no-history"]).bg,
                      border: `2px solid ${(FAIR_TONE[f.level] ?? FAIR_TONE["no-history"]).line}`,
                      color: "var(--ink)",
                      fontSize: "10px",
                    }}
                  >
                    {f.level.toUpperCase()}
                  </span>
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
      // Settling a slip removes it from this list; keep the picker pointing at
      // a slip that still exists and drop the stale statement.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile picker with a changed list
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

/* ================= Message log ================= */

const LEVEL_TONE: Record<WatcherAlert["level"], { bg: string; line: string }> = {
  "wedding-soon": { bg: "var(--marker-yellow)", line: "#B99420" },
  overdue: { bg: "var(--salmon-fill)", line: "var(--marker-red)" },
  urgent: { bg: "var(--orange-fill)", line: "var(--orange-line)" },
  info: { bg: "var(--blue-fill)", line: "var(--blue-line)" },
};

function Messages({ state, onRefresh }: { state: StateResponse; onRefresh: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [lastRun, setLastRun] = React.useState<string | null>(null);

  const ranked = [...state.alerts].sort((a, b) => {
    const rank = { "wedding-soon": 0, overdue: 1, urgent: 2, info: 3 } as const;
    return rank[a.level] - rank[b.level] || a.daysLeft - b.daysLeft;
  });

  function actorName(actor: string) {
    if (actor === "jeweller") return state.jeweller.name;
    const k = state.karigars.find((x) => actor === `karigar:${x.id}`);
    return k?.name ?? actor;
  }

  async function runWatcher() {
    setBusy(true);
    try {
      const res = await fetch("/api/agents/watcher/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not run the Watcher");
      setLastRun(data.summary ?? null);
      toast({ title: "Watcher run", description: data.summary });
      onRefresh();
    } catch (e) {
      toast({
        title: "Watcher could not send",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>Message log — WhatsApp first, SMS fallback</SectionTitle>
        <SketchButton tone="yellow" className="ml-auto" disabled={busy} onClick={runWatcher}>
          {busy ? "Sending…" : "Run the Watcher now"}
        </SketchButton>
      </div>
      <p className="font-hand text-sm text-ink-soft">
        One reminder per slip, per level, per day. With no WhatsApp token configured, messages land in
        the DEMO SMS inbox instead — nothing leaves this machine.
      </p>
      {lastRun && <p className="font-hand text-base text-[var(--green-ink)]">{lastRun}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <SketchBox tone="yellow" variant="b" className="px-4 py-4">
          <p className="font-sketch text-lg font-bold text-ink">
            Queued reminders · wedding dates first ({ranked.length})
          </p>
          <div className="tola-scroll mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {ranked.length === 0 && (
              <p className="font-hand text-sm text-ink-soft">All quiet — nothing due right now.</p>
            )}
            {ranked.map((a) => {
              const tone = LEVEL_TONE[a.level];
              return (
                <div
                  key={a.slipNumber + a.level}
                  className="border-[2px] bg-white px-3 py-2 sketch-c"
                  style={{ borderColor: tone.line }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="stamp" style={{ background: tone.bg, border: `2px solid ${tone.line}`, color: "var(--ink)" }}>
                      {a.level.toUpperCase()}
                    </span>
                    <span className="font-sketch text-sm font-bold text-ink">#{a.slipNumber}</span>
                    <span className="font-hand text-xs text-ink-soft">{a.karigarName}</span>
                  </div>
                  <p className="mt-1 font-hand text-sm leading-snug text-ink">{a.message}</p>
                </div>
              );
            })}
          </div>
        </SketchBox>

        <SketchBox tone="white" variant="c" className="px-4 py-4">
          <p className="font-sketch text-lg font-bold text-ink">Sent messages</p>
          <div className="tola-scroll mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {state.notifications.length === 0 && (
              <p className="font-hand text-sm text-ink-soft">
                No messages yet. Run the Watcher, or request a payment OTP, and it shows here.
              </p>
            )}
            {state.notifications.map((n) => (
              <div key={n.id} className="border-[2px] border-ink-soft/40 bg-white px-3 py-2 sketch-c">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="stamp"
                    style={{
                      background: n.channel === "WHATSAPP" ? "var(--green-fill)" : "var(--gray-fill)",
                      border: `2px solid ${n.channel === "WHATSAPP" ? "var(--green-line)" : "var(--gray-line)"}`,
                      color: "var(--ink)",
                    }}
                  >
                    {n.channel}
                  </span>
                  <span className="font-hand text-xs text-ink-soft">to {actorName(n.actor)}</span>
                  <span className="ml-auto font-hand text-xs text-ink-soft">{fmtDateTime(n.createdAt)}</span>
                </div>
                <p className="mt-1 font-hand text-sm leading-snug text-ink">{n.text}</p>
              </div>
            ))}
          </div>
        </SketchBox>
      </div>

      <Takeaway>
        The Watcher speaks once a day per slip — early enough to matter, never so often that a karigar
        stops reading.
      </Takeaway>
    </div>
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
