"use client";

import * as React from "react";
import { ArrowLeft, Smartphone, BadgeCheck, MessageCircle } from "lucide-react";
import {
  SketchBox,
  SketchButton,
  GoldCoin,
  DueChip,
  Stamp,
  TapChip,
  Takeaway,
  Kicker,
} from "./sketch";
import {
  fmtDate,
  fmtDateTime,
  fmtRupees,
  type StateResponse,
  type SlipRow,
} from "./types";
import { DisputeBox, WastageProposalBox, PaymentPanel, PaymentClockChip } from "./slips";
import { useToast } from "@/hooks/use-toast";
import { OfflineBanner } from "./offline-banner";
import { LanguageSwitcher, useTranslation } from "./language-switcher";

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

// Feature flag: flip to true when offline mode and voice input actually ship
// in this build. Until then the phone footer stays honest about it.
const OFFLINE_AND_VOICE_LIVE = false;

const PHONE_FOOTER_NOTE = OFFLINE_AND_VOICE_LIVE
  ? "works offline, syncs later · voice in Kannada or Hindi"
  : "offline mode and voice: coming in this build";

export default function KarigarView({
  state,
  onRefresh,
  onBack,
  onLogout,
}: {
  state: StateResponse;
  onRefresh: () => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [karigarId, setKarigarId] = React.useState(state.karigars[0]?.id ?? "");
  const me = state.karigars.find((k) => k.id === karigarId) ?? state.karigars[0];
  const mySlips = state.slips.filter((s) => s.karigarId === karigarId);
  const paidTotal = mySlips.reduce((a, s) => a + (s.payment?.amount ?? 0), 0);
  const settledWithWastage = mySlips.filter((s) => s.status === "SETTLED" && s.wastageActualPct !== null);
  const benchForMe = (() => {
    const vals = settledWithWastage.map((s) => s.wastageActualPct as number);
    if (!vals.length) return null;
    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
    const bench =
      state.benchmarks.find((b) => mySlips.some((s) => s.job.toLowerCase().includes(b.keyword))) ?? null;
    return { avg, n: vals.length, bench };
  })();

  async function act(fn: () => Promise<unknown>, done: string) {
    try {
      await fn();
      toast({ title: done, description: "Both sides see the same entry now." });
      onRefresh();
    } catch (e) {
      toast({ title: "Could not do that", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  }

  // P14: share his public passport. Only delivered-job proof travels — no
  // phone number, jeweller name or money is on that page.
  async function sharePassport() {
    const url = `${window.location.origin}/passport/${karigarId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Passport link copied!", description: "Share it with a new jeweller or a lender." });
    } catch {
      toast({ title: "Could not copy the link", description: url });
    }
  }

  return (
    <div className="paper-bg flex min-h-screen flex-col font-hand">
      <header className="sticky top-0 z-40 border-b-[2.5px] border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <SketchButton tone="paper" onClick={onBack} className="!px-3 !py-1.5 text-sm min-h-12">
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" /> {t("karigar.back")}
            </span>
          </SketchButton>
          <p className="font-sketch text-xl font-bold text-ink">{t("karigar.title")}</p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="font-hand text-sm text-ink-soft">{t("karigar.viewingAs")}</span>
            <select
              value={karigarId}
              onChange={(e) => setKarigarId(e.target.value)}
              className="border-[2.5px] border-ink bg-white px-2 py-1.5 font-hand text-base text-ink sketch-c outline-none"
            >
              {state.karigars.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <SketchButton
              tone="green"
              onClick={sharePassport}
              className="!px-3 !py-1.5 text-sm min-h-12"
            >
              Share My Passport
            </SketchButton>
            <SketchButton
              tone="paper"
              onClick={onLogout}
              className="!px-3 !py-1.5 text-sm min-h-12"
            >
              Logout
            </SketchButton>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr]">
          {/* ---- phone ---- */}
          <div className="mx-auto w-full max-w-sm">
            <div className="phone-frame px-4 pb-5 pt-4">
              <div className="flex items-center gap-2 border-b-2 border-dashed border-ink-soft/40 pb-2">
                <Smartphone className="h-5 w-5 text-ink" />
                <p className="font-sketch font-bold text-ink">{me?.name}&apos;s Tola</p>
                <GoldCoin label="22K" className="ml-auto h-6 w-10" />
              </div>

              {/* balance */}
              <div className="mt-3 border-[2.5px] border-ink bg-[var(--marker-yellow-soft)] px-3 py-3 text-center sketch-c">
                <p className="font-hand text-sm text-ink-soft">{t("karigar.balance")}</p>
                <p className="font-sketch text-4xl font-bold text-ink">{me?.goldBalance.toFixed(2)} g</p>
                <p className="font-hand text-xs text-ink-soft">the jeweller sees this same number</p>
              </div>

              {/* slips */}
              <p className="mt-4 font-sketch text-sm font-bold tracking-wide text-ink-soft">MY GOLD SLIPS</p>
              <div className="tola-scroll mt-2 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {mySlips.length === 0 && (
                  <p className="font-hand text-sm text-ink-soft">No slips yet.</p>
                )}
                {mySlips.map((s) => (
                  <MySlipRow key={s.id} slip={s} me={me?.name ?? "Karigar"} onAct={act} onRefresh={onRefresh} />
                ))}
              </div>

              {/* payments */}
              <p className="mt-4 font-sketch text-sm font-bold tracking-wide text-ink-soft">PAYMENTS I GOT (UPI)</p>
              <div className="mt-2 space-y-1.5">
                {mySlips.filter((s) => s.payment).length === 0 && (
                  <p className="font-hand text-sm text-ink-soft">Nothing yet.</p>
                )}
                {mySlips
                  .filter((s) => s.payment)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2 border-[2px] border-[var(--green-line)] bg-[var(--green-fill)] px-2.5 py-1.5 sketch-c">
                      <BadgeCheck className="h-4 w-4 text-[var(--green-ink)]" />
                      <p className="font-hand text-sm text-ink">
                        Slip #{s.number} · <b>{fmtRupees(s.payment?.amount ?? 0)}</b>
                      </p>
                      <p className="ml-auto font-hand text-[11px] text-ink-soft">
                        {s.paidAt ? fmtDateTime(s.paidAt) : ""}
                      </p>
                    </div>
                  ))}
                <p className="font-hand text-sm text-ink-soft">
                  Total received on this phone: <b className="text-ink">{fmtRupees(paidTotal)}</b>
                </p>
              </div>
            </div>
            <p className="mt-3 text-center font-hand text-sm text-ink-soft">
              {PHONE_FOOTER_NOTE}
            </p>
          </div>

          {/* ---- side panel ---- */}
          <div className="space-y-5">
            <WhatsAppChat
              key={me?.id ?? "none"}
              karigarId={me?.id ?? ""}
              name={me?.name ?? "Karigar"}
              exampleSlip={mySlips[0]?.number}
            />

            <Takeaway>
              He sees the same numbers as the jeweller. That is the whole idea.
            </Takeaway>

            <div className="grid gap-4 sm:grid-cols-3">
              <SketchBox tone="green" variant="a" className="px-4 py-3 text-center">
                <p className="font-sketch text-2xl font-bold text-[var(--green-ink)]">{mySlips.filter((s) => s.status !== "SETTLED").length}</p>
                <p className="font-hand text-sm text-ink">slips open now</p>
              </SketchBox>
              <SketchBox tone="blue" variant="b" className="px-4 py-3 text-center">
                <p className="font-sketch text-2xl font-bold text-[var(--blue-ink)]">{mySlips.filter((s) => s.status === "SETTLED").length}</p>
                <p className="font-hand text-sm text-ink">slips settled</p>
              </SketchBox>
              <SketchBox tone="yellow" variant="c" className="px-4 py-3 text-center">
                <p className="font-sketch text-2xl font-bold text-ink">{me?.openSlips ?? 0}</p>
                <p className="font-hand text-sm text-ink">waiting on me</p>
              </SketchBox>
            </div>

            <SketchBox tone="paper" variant="b" className="px-4 py-4">
              <p className="font-sketch text-lg font-bold text-ink">My wastage history — my proof of fair dealing</p>
              {settledWithWastage.length === 0 ? (
                <p className="mt-1 font-hand text-base text-ink-soft">No settled jobs yet.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {settledWithWastage.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-x-3 font-hand text-sm text-ink sm:text-base">
                      <span className="font-sketch font-bold">#{s.number}</span>
                      <span>{s.job}</span>
                      <span>
                        wastage <b>{s.wastageActualPct}%</b> (agreed {s.wastageAgreedPct}%)
                      </span>
                      <span className="ml-auto font-hand text-xs text-ink-soft">{fmtDate(s.paidAt ?? s.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 border-t-2 border-dashed border-ink-soft/40 pt-2 font-hand text-sm leading-relaxed text-ink-soft">
                With his consent, this record can be shared with a new jeweller or a lender — his
                <b className="text-ink"> Tola passport</b>. A clean record of delivered work is
                trust that travels with him.
              </p>
            </SketchBox>

            <SketchBox tone="blue" variant="c" className="px-4 py-4">
              <p className="font-sketch text-lg font-bold text-ink">How my wastage compares</p>
              {!benchForMe ? (
                <p className="mt-1 font-hand text-base text-ink-soft">No settled jobs yet to compare.</p>
              ) : (
                <div className="mt-2 space-y-1 font-hand text-sm text-ink sm:text-base">
                  <p>
                    My settled jobs: <b>{benchForMe.n}</b> · my average wastage:{" "}
                    <b>{benchForMe.avg}%</b>
                  </p>
                  {benchForMe.bench ? (
                    <p>
                      Trade range for <b>{benchForMe.bench.keyword}</b> jobs:{" "}
                      <b>
                        {benchForMe.bench.minPct}%–{benchForMe.bench.maxPct}%
                      </b>{" "}
                      (avg {benchForMe.bench.avgPct}%)
                    </p>
                  ) : (
                    <p className="text-ink-soft">No trade range on file for my job types yet.</p>
                  )}
                  <p className="text-xs text-ink-soft">
                    Trade ranges are a demo assumption and editable — shown so both sides compare the
                    same numbers.
                  </p>
                </div>
              )}
            </SketchBox>

            <Kicker>Free for karigars, always. He never pays for Tola.</Kicker>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t-[2.5px] border-ink bg-[var(--paper-deep)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-hand text-sm text-ink-soft">Every gram, one record, two signatures.</p>
          <Kicker>Tech4Bharat 2026 | Problem 2.2: Jeweltech</Kicker>
        </div>
      </footer>
    </div>
  );
}

/* ================= WhatsApp chat (DEMO) ================= */

type ChatMessage = { from: "me" | "tola"; text: string; at: string };

function clockNow() {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function WhatsAppChat({
  karigarId,
  name,
  exampleSlip,
}: {
  karigarId: string;
  name: string;
  exampleSlip?: number;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [
    {
      from: "tola",
      text: `Namaste ${name.split(" ")[0]}. This is Tola. Reply "balance" to see the gold in your hands, "status ${exampleSlip ?? "211"}" for a slip, or "ok ${exampleSlip ?? "211"}" to confirm a payment with an OTP.`,
      at: clockNow(),
    },
  ]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function send(raw?: string) {
    const message = (raw ?? text).trim();
    if (!message || busy || !karigarId) return;
    setText("");
    setMessages((m) => [...m, { from: "me", text: message, at: clockNow() }]);
    setBusy(true);
    try {
      const res = await fetch("/api/whatsapp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ karigarId, text: message }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { from: "tola", text: data.reply ?? data.error ?? "Something went wrong.", at: clockNow() },
      ]);
      if (data.command === "ok" && data.challengeId) {
        toast({
          title: "OTP sent",
          description: "Open the slip and tap “I received it” to enter the code.",
        });
      }
    } catch {
      setMessages((m) => [
        ...m,
        { from: "tola", text: "I couldn't reach Tola just now. Please try again.", at: clockNow() },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SketchBox tone="green" variant="c" className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircle className="h-5 w-5 text-[var(--green-ink)]" />
        <p className="font-sketch text-lg font-bold text-ink">Karigar&apos;s WhatsApp (DEMO)</p>
        <span className="stamp ml-auto" style={{ background: "var(--green-fill)", border: "2px solid var(--green-line)", color: "var(--green-ink)" }}>
          WHATSAPP FIRST · SMS FALLBACK
        </span>
      </div>
      <p className="mt-1 font-hand text-sm text-ink-soft">
        The same commands work on a WhatsApp Business number when it is connected. Every answer is
        limited to this karigar&apos;s own slips.
      </p>

      <div className="tola-scroll mt-3 max-h-64 space-y-2 overflow-y-auto rounded-sm bg-[var(--paper-deep)] px-2 py-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] border-[2px] border-ink-soft/50 px-2.5 py-1.5 font-hand text-sm leading-snug text-ink sketch-c"
              style={{ background: m.from === "me" ? "var(--marker-yellow-soft)" : "white" }}
            >
              <p className="whitespace-pre-line">{m.text}</p>
              <p className="mt-1 text-right font-hand text-[10px] text-ink-soft">{m.at}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {["balance", exampleSlip ? `status ${exampleSlip}` : null, exampleSlip ? `ok ${exampleSlip}` : null]
          .filter((c): c is string => !!c)
          .map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => send(c)}
              disabled={busy}
              className="border-[2px] border-ink-soft bg-white px-2 py-0.5 font-hand text-xs text-ink sketch-c transition-transform hover:-translate-y-0.5"
            >
              {c}
            </button>
          ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Type balance, status 211, ok 211…"
          className="min-w-0 flex-1 border-[2.5px] border-ink-soft bg-white px-2.5 py-1.5 font-hand text-sm text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
        />
        <SketchButton tone="green" className="!px-3 !py-1 text-sm" disabled={busy || !text.trim()} onClick={() => send()}>
          Send
        </SketchButton>
      </div>
      <p className="mt-2 font-hand text-xs text-ink-soft">
        &quot;ok {exampleSlip ?? "211"}&quot; only sends the OTP — the payment is never marked received
        without that code.
      </p>
    </SketchBox>
  );
}

function MySlipRow({
  slip,
  me,
  onAct,
  onRefresh,
}: {
  slip: SlipRow;
  me: string;
  onAct: (fn: () => Promise<unknown>, done: string) => void;
  onRefresh: () => void;
}) {
  const due = new Date(slip.dueDate);
  return (
    <div className="border-[2.5px] border-ink bg-white px-3 py-2.5 sketch-b">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-sketch font-bold text-ink">#{slip.number}</span>
        <span className="font-hand text-sm text-ink">
          {slip.job} · {slip.weightGrams.toFixed(2)} g {slip.purity}
        </span>
        {slip.disputed && (
          <span className="stamp" style={{ background: "var(--salmon-fill)", border: "2px solid var(--marker-red)", color: "var(--ink)" }}>
            DISPUTE
          </span>
        )}
        <span className="ml-auto">
          <Stamp status={slip.status} />
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 font-hand text-sm text-ink-soft">
        <span>due</span>
        <DueChip
          day={fmtDate(slip.dueDate, false)}
          month={due.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
          className="scale-90"
        />
        {slip.isWedding && <span className="font-sketch text-xs font-bold text-marker-red">WEDDING ORDER</span>}
        {slip.status === "RETURNED" && (
          <span>
            · wastage {slip.wastageActualPct}% (agreed {slip.wastageAgreedPct}%)
          </span>
        )}
      </div>

      {slip.status === "ISSUED" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TapChip label="Jeweller" checked who="jeweller" />
          <TapChip
            label={`Tap: it's me, ${me.split(" ")[0]}`}
            checked={false}
            who="karigar"
            disabled={slip.wastageProposalStatus === "PENDING"}
            onTap={() => onAct(() => post(`/api/slips/${slip.id}/confirm`), "Confirmed — the gold shows in my account")}
          />
        </div>
      )}

      {slip.status === "ISSUED" && (
        <WastageProposalBox slip={slip} side="karigar" onRefresh={onRefresh} compact />
      )}

      {slip.status === "RETURNED" && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TapChip label="Jeweller" checked={slip.jewellerApproved} who="jeweller" />
            <TapChip
              label="My approval"
              checked={slip.karigarApproved}
              who="karigar"
              disabled={slip.disputed}
              onTap={() =>
                onAct(
                  () => post(`/api/slips/${slip.id}/approve`, { side: "karigar" }),
                  "Approved — waiting for the jeweller's tap, then UPI pays me"
                )
              }
            />
          </div>
          {slip.disputed && (
            <p className="font-hand text-xs font-bold text-marker-red">
              My approval tap is locked while the dispute is open.
            </p>
          )}
          <DisputeBox slip={slip} side="karigar" onRefresh={onRefresh} compact />
        </div>
      )}

      {slip.status === "WORKING" && (
        <>
          <p className="mt-1.5 font-hand text-sm text-ink-soft">
            Gold is with me — the jeweller can see this balance live.
          </p>
          <DisputeBox slip={slip} side="karigar" onRefresh={onRefresh} compact />
        </>
      )}

      {slip.status === "SETTLED" && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-hand text-sm text-[var(--green-ink)]">
              Making charges {fmtRupees(slip.payment?.amount ?? slip.makingCharges ?? 0)} by{" "}
              {slip.payment?.method ?? "UPI"}.
            </p>
            <PaymentClockChip slip={slip} className="ml-auto" />
          </div>
          <PaymentPanel slip={slip} side="karigar" onRefresh={onRefresh} compact />
        </div>
      )}
    </div>
  );
}
