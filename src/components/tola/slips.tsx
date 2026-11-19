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
import { VoiceScribeCard, type VoiceDraft } from "./voice-scribe";
import { ScalePhotoCard, type ScalePhotoDraft } from "./scale-photo";
import { submitOrQueue } from "@/lib/offline";

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

async function patch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

/* ================= P8: customer status link ================= */

/** The shareable path shown to the jeweller; no origin on the server. */
export function customerStatusPath(token: string) {
  return `/status/${token}`;
}

function absoluteCustomerStatusUrl(token: string) {
  return typeof window === "undefined"
    ? customerStatusPath(token)
    : `${window.location.origin}${customerStatusPath(token)}`;
}

export function CustomerShareButtons({
  token,
  slipNumber,
  customerName,
  customerPhone,
}: {
  token: string;
  slipNumber: number;
  customerName?: string | null;
  customerPhone?: string | null;
}) {
  const { toast } = useToast();

  function copy() {
    const url = absoluteCustomerStatusUrl(token);
    navigator.clipboard
      .writeText(url)
      .then(() =>
        toast({ title: "Customer link copied", description: "Paste it into any chat or SMS." })
      )
      .catch(() => toast({ title: "Could not copy", description: url, variant: "destructive" }));
  }

  function sendOnWhatsApp() {
    const greeting = customerName ? `Hello ${customerName} — ` : "Hello — ";
    const text = `${greeting}you can follow order #${slipNumber} here: ${absoluteCustomerStatusUrl(token)}`;
    const digits = (customerPhone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noreferrer");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="sketch-btn px-3 py-1.5 text-sm"
        style={{ background: "var(--blue-fill)", borderColor: "var(--blue-line)", color: "var(--blue-ink)" }}
        onClick={copy}
      >
        Copy customer link
      </button>
      <button
        type="button"
        className="sketch-btn px-3 py-1.5 text-sm"
        style={{ background: "var(--green-fill)", borderColor: "var(--green-line)", color: "var(--green-ink)" }}
        onClick={sendOnWhatsApp}
      >
        Send on WhatsApp
      </button>
    </div>
  );
}

/** Customer name/phone live on the slip; the link itself can be copied here. */
export function CustomerLinkBox({ slip, onRefresh }: { slip: SlipRow; onRefresh: () => void }) {
  const { toast } = useToast();
  const [name, setName] = React.useState(slip.customerName ?? "");
  const [phone, setPhone] = React.useState(slip.customerPhone ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await patch(`/api/slips/${slip.id}`, { customerName: name, customerPhone: phone });
      toast({
        title: "Customer details saved",
        description: "The status link shows progress only — never weights or money.",
      });
      onRefresh();
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SketchBox tone="yellow" variant="d" className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-sketch font-bold text-ink">Customer status link · no login</p>
        <span
          className="stamp ml-auto"
          style={{ background: "#fff", border: "2px solid var(--ink)", color: "var(--ink)" }}
        >
          CUSTOMER VIEW
        </span>
      </div>
      <p className="mt-1 font-hand text-sm text-ink">
        A private link for the customer: progress, due date and the last updates only. No gold
        weights, wastage, making charges, payments or karigar details.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="font-sketch text-sm font-bold text-ink">
          Customer name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ananya Rao"
            className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </label>
        <label className="font-sketch text-sm font-bold text-ink">
          Customer phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+91 90080 22114"
            className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SketchButton tone="green" className="px-3 py-1.5" disabled={busy} onClick={save}>
          Save customer
        </SketchButton>
        {slip.publicToken ? (
          <CustomerShareButtons
            token={slip.publicToken}
            slipNumber={slip.number}
            customerName={slip.customerName}
            customerPhone={slip.customerPhone}
          />
        ) : (
          <span className="font-hand text-sm text-ink-soft">
            Link not generated yet — reload the dashboard.
          </span>
        )}
      </div>
      {slip.publicToken && (
        <p className="mt-2 truncate font-mono text-xs text-ink-soft">
          {customerStatusPath(slip.publicToken)}
        </p>
      )}
    </SketchBox>
  );
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
                  {s.disputed && (
                    <span className="stamp" style={{ background: "var(--salmon-fill)", border: "2px solid var(--marker-red)", color: "var(--ink)" }}>
                      DISPUTE
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <PaymentClockChip slip={s} />
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

/* ================= Dispute (both sides) ================= */

// "Flag a dispute" lives on RETURNED slips for both sides. An open dispute
// writes a DISPUTE ledger entry and blocks settlement until it is resolved.
export function DisputeBox({
  slip,
  side,
  onRefresh,
  compact = false,
}: {
  slip: SlipRow;
  side: "jeweller" | "karigar";
  onRefresh: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const iOpened = slip.disputeOpenedBy === side;

  async function act(action: "open" | "note" | "resolve" | "withdraw") {
    setBusy(true);
    try {
      await post(`/api/slips/${slip.id}/dispute`, { side, note, action });
      toast({
        title:
          action === "withdraw"
            ? "Dispute withdrawn — settlement can go ahead"
            : action === "resolve"
              ? "You agreed — dispute resolved"
              : action === "note"
                ? "Your side joined the dispute record"
                : "Dispute flagged — settlement is blocked",
        description: "The ledger got a new entry. Both sides see it.",
      });
      setNote("");
      onRefresh();
    } catch (e) {
      toast({ title: "Could not do that", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const inputCls = compact
    ? "mt-1 w-full border-[2px] border-ink-soft bg-white px-2 py-1 font-hand text-sm text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
    : "mt-1 w-full border-[2.5px] border-ink-soft bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]";

  if (!slip.disputed) {
    return (
      <div className={`border-[2.5px] border-dashed border-ink-soft/60 bg-white ${compact ? "px-2.5 py-2" : "px-4 py-3"} sketch-c`}>
        <p className={`font-hand text-ink-soft ${compact ? "text-sm" : "text-base"}`}>
          Weights or charges not matching? <b className="text-ink">Flag a dispute</b> — the record
          keeps both sides honest until it is talked out.
        </p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note — what does not match?"
          className={inputCls}
        />
        <SketchButton tone="salmon" className="mt-2 !py-1 text-sm" disabled={busy} onClick={() => act("open")}>
          Flag a dispute
        </SketchButton>
      </div>
    );
  }

  return (
    <SketchBox tone="salmon" variant={compact ? "c" : "b"} className={compact ? "px-2.5 py-2" : "px-4 py-3"}>
      <p className={`font-sketch font-bold ${compact ? "text-sm" : "text-base"} text-ink`}>
        Open dispute — settlement is blocked
      </p>
      {slip.disputeNote && (
        <div className={`mt-1 whitespace-pre-line border-l-4 border-[var(--marker-red)] bg-white/70 px-2 py-1 font-hand text-ink ${compact ? "text-sm" : "text-base"}`}>
          {slip.disputeNote}
        </div>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add your side (optional)…"
        className={inputCls}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SketchButton tone="salmon" className="!py-1 text-sm" disabled={busy || !note.trim()} onClick={() => act("note")}>
          Add my side
        </SketchButton>
        {iOpened ? (
          <SketchButton tone="green" className="!py-1 text-sm" disabled={busy} onClick={() => act("withdraw")}>
            Withdraw my dispute
          </SketchButton>
        ) : (
          <SketchButton tone="green" className="!py-1 text-sm" disabled={busy} onClick={() => act("resolve")}>
            Agree — resolve it
          </SketchButton>
        )}
      </div>
      <p className={`mt-1.5 font-hand text-ink-soft ${compact ? "text-xs" : "text-sm"}`}>
        {iOpened
          ? "You opened this dispute. Only the other side can agree to close it, or you can withdraw it."
          : "The other side opened this dispute. Your agreement (or their withdrawal) is needed to close it."}
      </p>
    </SketchBox>
  );
}

/* ================= Wastage counter-proposal (P4) ================= */

// On an ISSUED slip the karigar may propose a different wastage % with a short
// note. The jeweller accepts (which updates the agreed %) or declines. While it
// is PENDING the karigar's confirm tap stays blocked.
export function WastageProposalBox({
  slip,
  side,
  onRefresh,
  compact = false,
}: {
  slip: SlipRow;
  side: "jeweller" | "karigar";
  onRefresh: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [pct, setPct] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const pending = slip.wastageProposalStatus === "PENDING";

  const inputCls = compact
    ? "border-[2px] border-ink-soft bg-white px-2 py-1 font-hand text-sm text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
    : "border-[2.5px] border-ink-soft bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]";

  async function run(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await post(`/api/slips/${slip.id}/wastage-proposal`, body);
      toast({ title: done, description: "Both sides see the same entry now." });
      setPct("");
      setNote("");
      onRefresh();
    } catch (e) {
      toast({ title: "Could not do that", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (side === "karigar") {
    if (pending) {
      return (
        <div className="mt-2 border-[2px] border-[var(--blue-line)] bg-[var(--blue-fill)] px-2.5 py-1.5 sketch-c">
          <p className="font-hand text-xs text-ink">
            You proposed <b>{slip.wastageProposedPct}%</b> wastage. Waiting for the jeweller to accept
            or decline — your confirm tap stays locked until then.
          </p>
          {slip.wastageProposalNote && (
            <p className="mt-0.5 font-hand text-xs text-ink-soft">“{slip.wastageProposalNote}”</p>
          )}
        </div>
      );
    }
    return (
      <div className="mt-2 border-[2.5px] border-dashed border-ink-soft/60 bg-white px-2.5 py-2 sketch-c">
        <p className="font-hand text-sm text-ink-soft">
          Wastage looks different from the agreed {slip.wastageAgreedPct}%?{" "}
          <b className="text-ink">Propose another %</b> — the jeweller accepts or declines.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 4"
            className={`w-20 ${inputCls}`}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short note (optional)"
            className={`min-w-0 flex-1 ${inputCls}`}
          />
          <SketchButton
            tone="blue"
            className="!py-1 text-sm"
            disabled={busy || !pct.trim()}
            onClick={() => run({ action: "propose", pct: parseFloat(pct), note }, "Proposal sent — the jeweller will accept or decline")}
          >
            Propose
          </SketchButton>
        </div>
        {slip.wastageProposalStatus && slip.wastageProposalStatus !== "PENDING" && (
          <p className="mt-1 font-hand text-xs text-ink-soft">
            Last proposal {slip.wastageProposalStatus.toLowerCase()}.
          </p>
        )}
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="border-[2px] border-dashed border-ink-soft/60 bg-white px-3 py-2 sketch-c">
        <p className="font-hand text-sm text-ink-soft">
          No wastage counter-proposal waiting. The karigar may propose a different % on an ISSUED
          slip.
        </p>
      </div>
    );
  }

  return (
    <SketchBox tone="blue" variant="b" className="px-3 py-2">
      <p className="font-sketch text-sm font-bold text-ink">
        Wastage counter-proposal — {slip.wastageProposedPct}% (agreed {slip.wastageAgreedPct}%)
      </p>
      {slip.wastageProposalNote && (
        <p className="mt-0.5 font-hand text-sm text-ink">“{slip.wastageProposalNote}”</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <SketchButton tone="green" className="!py-1 text-sm" disabled={busy} onClick={() => run({ action: "accept", side: "jeweller" }, "Accepted — the agreed wastage is updated")}>
          Accept
        </SketchButton>
        <SketchButton tone="salmon" className="!py-1 text-sm" disabled={busy} onClick={() => run({ action: "decline", side: "jeweller" }, "Declined — the agreed wastage stands")}>
          Decline
        </SketchButton>
      </div>
    </SketchBox>
  );
}

/* ================= Payment clock & panel (P6) ================= */

// A ticking chip that turns red once the 24h payment clock is past due.
export function PaymentClockChip({ slip, className = "" }: { slip: SlipRow; className?: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (slip.status !== "SETTLED" || !slip.payDueAt) return null;
  const status = slip.payment?.status ?? "PENDING";
  if (status === "PAID") {
    return (
      <span
        className={`stamp ${className}`}
        style={{ background: "var(--green-fill)", border: "2px solid var(--green-line)", color: "var(--green-ink)" }}
      >
        PAID
      </span>
    );
  }

  const msLeft = new Date(slip.payDueAt).getTime() - now;
  const overdue = msLeft < 0;
  const mins = Math.floor(Math.abs(msLeft) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const d = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${m}m` : `${m}m`;
  return (
    <span
      className={`stamp ${className}`}
      title={overdue ? `Payment clock: ${d} overdue` : `Payment clock: ${d} left`}
      style={{
        background: overdue ? "var(--salmon-fill)" : "var(--marker-yellow-soft)",
        border: `2px solid ${overdue ? "var(--marker-red)" : "#B99420"}`,
        color: "var(--ink)",
      }}
    >
      {overdue ? `PAY ${d} OVERDUE` : `${d} TO PAY`}
    </span>
  );
}

// The settlement panel: a real UPI deep link + QR for the jeweller, and an
// OTP-confirmed "I received it" for the karigar. Tola never moves money.
export function PaymentPanel({
  slip,
  side,
  onRefresh,
  compact = false,
}: {
  slip: SlipRow;
  side: "jeweller" | "karigar";
  onRefresh: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [qr, setQr] = React.useState<string | null>(null);
  const [upiRef, setUpiRef] = React.useState("");
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [demoCode, setDemoCode] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");

  const payment = slip.payment;
  const upiLink = payment?.upiLink ?? null;

  React.useEffect(() => {
    let cancelled = false;
    if (!upiLink) return;
    (async () => {
      try {
        const mod = await import("qrcode");
        const toDataURL =
          (mod as unknown as { toDataURL?: (t: string, o?: object) => Promise<string> }).toDataURL ??
          (mod as unknown as { default?: { toDataURL: (t: string, o?: object) => Promise<string> } })
            .default?.toDataURL;
        if (!toDataURL) return;
        const url = await toDataURL(upiLink, { margin: 1, width: 180 });
        if (!cancelled) setQr(url);
      } catch {
        if (!cancelled) setQr(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [upiLink]);

  if (!payment) {
    return (
      <p className="font-hand text-sm text-ink-soft">
        No payment record on this slip yet.
      </p>
    );
  }

  const pay = payment;
  const paid = pay.status === "PAID";

  async function recordPay() {
    setBusy(true);
    try {
      await post(`/api/payments/${pay.id}/pay`, { upiRef });
      toast({ title: "UPI reference saved", description: "Waiting for the karigar to confirm receipt." });
      setUpiRef("");
      onRefresh();
    } catch (e) {
      toast({ title: "Could not save the reference", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp() {
    setBusy(true);
    try {
      const r = await post(`/api/payments/${pay.id}/confirm`, { action: "request" });
      setChallengeId(r.challengeId);
      setDemoCode(r.demoCode ?? null);
      toast({ title: "OTP sent", description: "Check the DEMO SMS inbox on this phone." });
    } catch (e) {
      toast({ title: "Could not send the OTP", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp() {
    setBusy(true);
    try {
      await post(`/api/payments/${pay.id}/confirm`, { challengeId, code });
      toast({ title: "Payment received", description: "Marked paid and written to the ledger." });
      setCode("");
      setChallengeId(null);
      setDemoCode(null);
      onRefresh();
    } catch (e) {
      toast({ title: "Could not confirm receipt", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const inputCls = compact
    ? "border-[2px] border-ink-soft bg-white px-2 py-1 font-hand text-sm text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
    : "border-[2.5px] border-ink-soft bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <PaymentClockChip slip={slip} />
        <a
          href={`/statement/${slip.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-hand text-sm text-[var(--blue-ink)] underline"
        >
          Printable statement →
        </a>
      </div>

      {paid ? (
        <div className="border-[2px] border-[var(--green-line)] bg-[var(--green-fill)] px-2.5 py-1.5 sketch-c">
          <p className="font-hand text-sm text-ink">
            Received by UPI{payment.upiRef ? ` — ref ${payment.upiRef}` : ""}
            {payment.paidConfirmedAt ? ` · confirmed ${fmtDateTime(payment.paidConfirmedAt)}` : ""}
          </p>
        </div>
      ) : side === "jeweller" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {upiLink && (
              <a
                href={upiLink}
                className="border-[2.5px] border-ink bg-[var(--marker-yellow)] px-3 py-1.5 font-sketch text-sm font-bold text-ink sketch-c transition-transform hover:-translate-y-0.5"
              >
                Open UPI app to pay {fmtRupees(payment.amount)}
              </a>
            )}
            {qr && (
              <img src={qr} alt="UPI QR code" className="h-[90px] w-[90px] border-[2px] border-ink bg-white p-1 sketch-c" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value.replace(/\D/g, "").slice(0, 12))}
              inputMode="numeric"
              placeholder="12-digit UPI ref"
              className={`w-40 ${inputCls}`}
            />
            <SketchButton
              tone="green"
              className="!py-1 text-sm"
              disabled={busy || upiRef.length !== 12}
              onClick={recordPay}
            >
              I paid — save ref
            </SketchButton>
          </div>
          {payment.upiRef && (
            <p className="font-hand text-xs text-ink-soft">
              Ref {payment.upiRef} saved — waiting for {slip.karigarName} to confirm receipt.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {payment.upiRef ? (
            <p className="font-hand text-sm text-ink">
              Jeweller recorded UPI ref <b>{payment.upiRef}</b>. If the money has landed, confirm
              receipt.
            </p>
          ) : (
            <p className="font-hand text-sm text-ink-soft">
              Waiting for the jeweller to pay and record the UPI reference.
            </p>
          )}
          {challengeId ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit OTP"
                className={`w-28 ${inputCls}`}
              />
              <SketchButton
                tone="green"
                className="!py-1 text-sm"
                disabled={busy || code.length !== 6}
                onClick={confirmOtp}
              >
                Confirm receipt
              </SketchButton>
              {demoCode && (
                <span className="font-hand text-xs text-ink-soft">Demo OTP: {demoCode}</span>
              )}
            </div>
          ) : (
            <SketchButton
              tone="green"
              className="!py-1 text-sm"
              disabled={busy || !payment.upiRef}
              onClick={requestOtp}
            >
              I received it
            </SketchButton>
          )}
        </div>
      )}
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

      <CustomerLinkBox key={slip.id} slip={slip} onRefresh={onRefresh} />

      {slip.photos?.length ? (
        <SketchBox tone="gray" variant="c" className="px-4 py-3">
          <p className="font-sketch text-sm font-bold text-ink">Scale photo on record</p>
          {slip.photos.map((photo) => (
            <p key={photo.id} className="font-hand text-sm text-ink">
              {photo.filename} · read {photo.weightGrams.toFixed(2)} g · confidence{" "}
              {Math.round(photo.confidence * 100)}%{" "}
              <span className="font-mono text-[10px] text-ink-soft">
                sha256 {photo.sha256.slice(0, 12)}… · {photo.actor}
              </span>
            </p>
          ))}
        </SketchBox>
      ) : null}

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
              disabled={busy || slip.wastageProposalStatus === "PENDING"}
              onClick={() =>
                run(async () => {
                  await post(`/api/slips/${slip.id}/confirm`);
                }, "Both taps done — gold is now in his account")
              }
            >
              Simulate: he taps confirm on his phone
            </SketchButton>
          </div>
          {slip.wastageProposalStatus === "PENDING" && (
            <p className="mt-2 font-hand text-sm font-bold text-marker-red">
              Locked: a wastage counter-proposal is waiting for the jeweller.
            </p>
          )}
        </SketchBox>
      )}

      {slip.status === "ISSUED" && (
        <WastageProposalBox slip={slip} side="jeweller" onRefresh={onRefresh} />
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

      {slip.status === "WORKING" && (
        <DisputeBox slip={slip} side="jeweller" onRefresh={onRefresh} />
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

          <DisputeBox slip={slip} side="jeweller" onRefresh={onRefresh} />

          <SketchBox tone="salmon" variant="c" className="px-4 py-4">
            <p className="font-sketch font-bold">Step 4 · settle — both must tap</p>
            {slip.disputed && (
              <p className="mt-2 font-hand text-base font-bold text-marker-red">
                Locked: an open dispute blocks approvals and the Settler. Resolve it below first.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <TapChip
                label="Jeweller"
                checked={slip.jewellerApproved}
                who="jeweller"
                disabled={slip.disputed}
                onTap={() =>
                  run(async () => {
                    const r = await post(`/api/slips/${slip.id}/approve`, { side: "jeweller" });
                    if (r.settled) toast({ title: "Both approved — payment clock started." });
                  }, "Jeweller approved")
                }
              />
              <TapChip
                label={slip.karigarName}
                checked={slip.karigarApproved}
                who="karigar"
                disabled={slip.disputed}
                onTap={() =>
                  run(async () => {
                    const r = await post(`/api/slips/${slip.id}/approve`, { side: "karigar" });
                    if (r.settled) toast({ title: "Both approved — payment clock started." });
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
                  disabled={busy || slip.disputed}
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
        <>
          <SketchBox tone="green" variant="b" className="px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-sketch text-lg font-bold text-[var(--green-ink)]">
                Settlement — paid on the clock, not on mood
              </p>
              <PaymentClockChip slip={slip} className="ml-auto" />
            </div>
            <div className="mt-2 space-y-1 font-hand text-base text-ink">
              <p>
                Making charges: <b>{fmtRupees(slip.payment?.amount ?? slip.makingCharges ?? 0)}</b> by{" "}
                {slip.payment?.method ?? "UPI"}
              </p>
              <p>Payment clock due: {slip.payDueAt ? fmtDateTime(slip.payDueAt) : "—"}</p>
              <p>
                Wastage: {slip.wastageActualPct}% against agreed {slip.wastageAgreedPct}%
              </p>
            </div>
          </SketchBox>
          <PaymentPanel slip={slip} side="jeweller" onRefresh={onRefresh} />
        </>
      )}

      <p className="font-hand text-sm text-ink-soft">
        Every step above wrote one entry to the shared ledger. Hash-linked, so tampering shows.
        {slip.source ? ` Created via ${slip.source}.` : ""}
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
  source?: "voice" | "typed" | "photo";
  photo?: {
    sha256: string;
    filename: string;
    weightGrams: number;
    confidence: number;
  };
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
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [issuedLink, setIssuedLink] = React.useState<null | {
    token: string;
    number: number;
    name: string;
    phone: string;
  }>(null);
  const [source, setSource] = React.useState<"voice" | "typed" | "photo">("typed");
  const [photoMeta, setPhotoMeta] = React.useState<ScribeDraft["photo"] | null>(null);
  const [busy, setBusy] = React.useState(false);

  // A draft handed over from Scribe/voice is a one-shot seed for this form;
  // it is meant to fill the empty fields, not to be re-derived as state.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot draft prefill */
  React.useEffect(() => {
    if (!prefill) return;
    if (prefill.karigarId) setKarigarId(prefill.karigarId);
    if (prefill.source) setSource(prefill.source);
    if (prefill.weightGrams) setWeight(String(prefill.weightGrams));
    if (prefill.purity) setPurity(prefill.purity);
    if (prefill.job) setJob(prefill.job);
    if (prefill.isWedding !== undefined) setWedding(prefill.isWedding);
    if (prefill.wastageAgreedPct !== undefined) setWastage(String(prefill.wastageAgreedPct));
    if (prefill.dueDate) setDue(prefill.dueDate.slice(0, 10));
    if (prefill.photo) setPhotoMeta(prefill.photo);
  }, [prefill]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const makingCharges = (() => {
    const w = parseFloat(weight);
    if (!isFinite(w) || w <= 0) return null;
    return Math.round((w * 380) / 10) * 10;
  })();

  function applyVoice(draft: VoiceDraft) {
    if (draft.karigarId) setKarigarId(draft.karigarId);
    if (draft.weightGrams) setWeight(String(draft.weightGrams));
    if (draft.purity) setPurity(draft.purity);
    if (draft.job) setJob(draft.job);
    if (draft.isWedding !== undefined) setWedding(draft.isWedding);
    if (draft.wastageAgreedPct !== undefined) setWastage(String(draft.wastageAgreedPct));
    if (draft.dueDate) setDue(draft.dueDate.slice(0, 10));
    setSource(draft.source ?? "voice");
    toast({
      title: "Confirmation card accepted",
      description: "The fields are filled below — check each one, then tap to issue.",
    });
  }

  function applyPhoto(draft: ScalePhotoDraft) {
    setWeight(String(draft.weightGrams));
    setPhotoMeta({
      sha256: draft.sha256,
      filename: draft.filename,
      weightGrams: draft.weightGrams,
      confidence: draft.confidence,
    });
    setSource("photo");
    toast({
      title: "Scale photo accepted",
      description:
        "The weight is filled below. The photo's SHA-256 is saved with the slip when you issue it.",
    });
  }

  async function submit() {
    setBusy(true);
    try {
      const payload = {
        karigarId,
        weightGrams: parseFloat(weight),
        purity,
        job,
        isWedding: wedding,
        wastageAgreedPct: parseFloat(wastage),
        dueDate: new Date(due + "T09:00:00").toISOString(),
        customerName,
        customerPhone,
        source,
        photo: photoMeta
          ? {
              ...photoMeta,
              weightGrams: parseFloat(weight) || photoMeta.weightGrams,
            }
          : undefined,
      };

      // Offline or patchy signal: keep the issue action on the phone with an
      // Idempotency-Key, then sync it when the connection returns.
      const result = await submitOrQueue({
        url: "/api/slips",
        body: payload,
        label: `Issue gold — ${job}`,
      });

      if (result.queued) {
        toast({
          title: "Saved offline",
          description:
            "It will sync when signal returns. Nothing changes without both taps.",
        });
        setWeight("");
        setJob("");
        setWedding(false);
        setSource("typed");
        setPhotoMeta(null);
        return;
      }

      if (result.status >= 400) {
        const message =
          (result.body as { error?: string } | null)?.error ?? "Check the fields";
        throw new Error(message);
      }

      const r = result.body as { slip: SlipRow & { publicToken?: string | null } };
      toast({
        title: `Slip #${r.slip.number} issued`,
        description: "Jeweller tapped. Now the karigar must tap on his phone.",
      });
      setIssuedLink({
        token: String(r.slip.publicToken ?? ""),
        number: r.slip.number,
        name: customerName,
        phone: customerPhone,
      });
      setWeight("");
      setJob("");
      setWedding(false);
      setSource("typed");
      setPhotoMeta(null);
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
          The weight can come from a photo of the scale, or from speech in English, Hindi or
          Kannada. Check the confirmation card before it fills the slip.
        </p>

        <div className="mt-3 space-y-3">
          <ScalePhotoCard onUse={applyPhoto} />
          <VoiceScribeCard onUse={applyVoice} />
        </div>

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
            Customer name (optional)
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ananya Rao"
              className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </label>
          <label className="font-sketch text-sm font-bold text-ink">
            Customer phone (optional)
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
              placeholder="+91 90080 22114"
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

        {issuedLink && (
          <div className="mt-4 border-t-2 border-dashed border-ink-soft/40 pt-3">
            <p className="font-sketch font-bold text-ink">
              Customer status link for #{issuedLink.number}
            </p>
            <p className="font-hand text-sm text-ink">
              No login needed. Progress only — weights, charges and karigar details stay off the
              page.
            </p>
            <code className="mt-1 block truncate font-mono text-xs text-ink-soft">
              {customerStatusPath(issuedLink.token)}
            </code>
            {issuedLink.token && (
              <div className="mt-2">
                <CustomerShareButtons
                  token={issuedLink.token}
                  slipNumber={issuedLink.number}
                  customerName={issuedLink.name}
                  customerPhone={issuedLink.phone}
                />
              </div>
            )}
          </div>
        )}
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
