"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* =========================================================
   Tola sketch kit — hand-drawn notebook look
   ========================================================= */

type Tone = "white" | "blue" | "green" | "salmon" | "yellow" | "gold" | "gray" | "orange" | "paper";

const TONES: Record<Tone, { bg: string; line: string; ink: string }> = {
  white: { bg: "#FFFFFF", line: "#21406B", ink: "#21406B" },
  paper: { bg: "#FFFDF6", line: "#21406B", ink: "#21406B" },
  blue: { bg: "var(--blue-fill)", line: "var(--blue-line)", ink: "var(--blue-ink)" },
  green: { bg: "var(--green-fill)", line: "var(--green-line)", ink: "var(--green-ink)" },
  salmon: { bg: "var(--salmon-fill)", line: "var(--salmon-line)", ink: "var(--salmon-ink)" },
  yellow: { bg: "var(--marker-yellow)", line: "#B99420", ink: "#21406B" },
  gold: { bg: "var(--gold)", line: "var(--gold-deep)", ink: "#6B4A08" },
  gray: { bg: "var(--gray-fill)", line: "var(--gray-line)", ink: "#21406B" },
  orange: { bg: "var(--orange-fill)", line: "var(--orange-line)", ink: "#9C5716" },
};

export function SketchBox({
  tone = "white",
  variant = "a",
  className,
  children,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone; variant?: "a" | "b" | "c" | "d" }) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "border-[2.5px] paper-shadow",
        variant === "a" && "sketch",
        variant === "b" && "sketch-b",
        variant === "c" && "sketch-c",
        variant === "d" && "sketch-d",
        className
      )}
      style={{ background: t.bg, borderColor: t.line, color: t.ink, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Highlight({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("marker-hl", className)}>{children}</span>;
}

/** Yellow takeaway strip, like the deck's big yellow boxes. */
export function Takeaway({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <SketchBox tone="yellow" variant="c" className={cn("px-5 py-3 text-center", className)}>
      <p className="font-sketch text-base sm:text-lg md:text-xl font-bold text-ink">{children}</p>
    </SketchBox>
  );
}

export function SketchButton({
  tone = "blue",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  const t = TONES[tone];
  return (
    <button
      className={cn("sketch-btn px-4 py-2 text-sm sm:text-base", className)}
      style={{ background: t.bg, borderColor: t.line, color: t.ink }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function NumDot({ n }: { n: number }) {
  return <span className="num-dot text-sm">{n}</span>;
}

/** Hand-drawn section title with a red marker underline. */
export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "font-sketch text-2xl sm:text-3xl md:text-4xl font-bold text-ink red-underline inline-block",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-sketch text-xs sm:text-sm font-bold tracking-widest uppercase text-ink-soft", className)}>
      {children}
    </p>
  );
}

/** Status stamp chip. */
export function Stamp({
  status,
  className,
}: {
  status: "ISSUED" | "WORKING" | "RETURNED" | "SETTLED";
  className?: string;
}) {
  const map = {
    ISSUED: { bg: "var(--blue-fill)", line: "var(--blue-line)", ink: "var(--blue-ink)", label: "ISSUED" },
    WORKING: { bg: "var(--marker-yellow-soft)", line: "#B99420", ink: "#8a6d10", label: "GOLD WITH KARIGAR" },
    RETURNED: { bg: "var(--orange-fill)", line: "var(--orange-line)", ink: "#9C5716", label: "RETURNED" },
    SETTLED: { bg: "var(--green-fill)", line: "var(--green-line)", ink: "var(--green-ink)", label: "SETTLED" },
  }[status];
  return (
    <span
      className={cn("stamp", className)}
      style={{ background: map.bg, border: `2px solid ${map.line}`, color: map.ink }}
    >
      {map.label}
    </span>
  );
}

/** Green ✓ tap chip — jeweller / karigar approvals. */
export function TapChip({
  label,
  checked,
  onTap,
  disabled,
  who,
}: {
  label: string;
  checked: boolean;
  onTap?: () => void;
  disabled?: boolean;
  who: "jeweller" | "karigar";
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled || checked}
      aria-pressed={checked}
      className={cn(
        "flex items-center gap-2 border-[2.5px] px-3 py-1.5 font-sketch font-bold text-sm transition-all",
        "sketch-c",
        checked ? "tola-pop" : "",
        !checked && !disabled ? "hover:-translate-y-0.5 cursor-pointer" : "",
        disabled && !checked ? "opacity-50 cursor-not-allowed" : ""
      )}
      style={{
        background: checked ? "var(--green-fill)" : "#FFFFFF",
        borderColor: checked ? "var(--green-line)" : "var(--ink-soft)",
        color: checked ? "var(--green-ink)" : "var(--ink-soft)",
      }}
      title={checked ? `${label} tapped ✓` : `Waiting for ${who}'s tap`}
    >
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] border-2 text-[10px] leading-none"
        style={{
          borderColor: checked ? "var(--green-line)" : "var(--ink-soft)",
          background: checked ? "var(--green-line)" : "transparent",
          color: "#fff",
        }}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

/* ---------------- Doodles (SVG) ---------------- */

export function GoldBar({ label = "1 TOLA", className, style }: { label?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 62" className={className} style={style} role="img" aria-label={`gold bar ${label}`}>
      <path d="M22 22 L98 22 L112 52 L8 52 Z" fill="#F2B93B" stroke="#B8860B" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 22 L98 22 L94 12 L26 12 Z" fill="#F8CE63" stroke="#B8860B" strokeWidth="3" strokeLinejoin="round" />
      <text x="60" y="44" textAnchor="middle" fontSize="15" fontWeight="700" fill="#7A5608" fontFamily="var(--font-sketch), cursive">
        {label}
      </text>
    </svg>
  );
}

export function GoldCoin({ label = "22K", className, style }: { label?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 80 50" className={className} style={style} role="img" aria-label={`gold coin ${label}`}>
      <ellipse cx="40" cy="28" rx="34" ry="18" fill="#F2B93B" stroke="#B8860B" strokeWidth="3" />
      <ellipse cx="40" cy="22" rx="34" ry="18" fill="#F8CE63" stroke="#B8860B" strokeWidth="3" />
      <text x="40" y="27" textAnchor="middle" fontSize="14" fontWeight="700" fill="#7A5608" fontFamily="var(--font-sketch), cursive">
        {label}
      </text>
    </svg>
  );
}

export function BalanceScale({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 130" className={className} role="img" aria-label="balance scale">
      <g stroke="#21406B" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <line x1="90" y1="18" x2="90" y2="112" />
        <line x1="52" y1="112" x2="128" y2="112" />
        <line x1="62" y1="112" x2="90" y2="100" />
        <line x1="118" y1="112" x2="90" y2="100" />
        <circle cx="90" cy="14" r="4" fill="#F2B93B" />
        <line x1="24" y1="30" x2="156" y2="30" />
        <line x1="24" y1="30" x2="10" y2="62" />
        <line x1="24" y1="30" x2="38" y2="62" />
        <path d="M4 62 Q24 80 44 62" fill="var(--blue-fill)" />
        <line x1="156" y1="30" x2="142" y2="62" />
        <line x1="156" y1="30" x2="170" y2="62" />
        <path d="M136 62 Q156 80 176 62" fill="var(--blue-fill)" />
      </g>
    </svg>
  );
}

/** Worried jeweller with glasses. */
export function StickJeweller({ className, mood = "worry" }: { className?: string; mood?: "worry" | "happy" }) {
  return (
    <svg viewBox="0 0 100 140" className={className} role="img" aria-label="jeweller">
      <g stroke="#21406B" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <circle cx="50" cy="26" r="14" />
        <circle cx="43" cy="24" r="5.5" />
        <circle cx="58" cy="24" r="5.5" />
        <line x1="48.5" y1="24" x2="52.5" y2="24" />
        {mood === "worry" ? (
          <path d="M44 34 Q50 31 57 34" />
        ) : (
          <path d="M43 33 Q50 38 58 33" />
        )}
        <line x1="50" y1="40" x2="50" y2="82" />
        <line x1="50" y1="52" x2="26" y2="70" />
        <line x1="50" y1="52" x2="74" y2="70" />
        <line x1="50" y1="82" x2="34" y2="118" />
        <line x1="50" y1="82" x2="66" y2="118" />
        <line x1="34" y1="118" x2="30" y2="132" />
        <line x1="34" y1="118" x2="42" y2="130" />
        <line x1="66" y1="118" x2="70" y2="132" />
        <line x1="66" y1="118" x2="58" y2="130" />
      </g>
    </svg>
  );
}

/** Karigar with turban and hammer. */
export function StickKarigar({ className, mood = "worry" }: { className?: string; mood?: "worry" | "happy" }) {
  return (
    <svg viewBox="0 0 100 140" className={className} role="img" aria-label="karigar">
      <g stroke="#21406B" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <circle cx="48" cy="28" r="13" />
        <path d="M34 22 Q48 6 62 22" fill="var(--salmon-fill)" />
        <path d="M34 22 Q48 12 62 22" />
        <circle cx="44" cy="28" r="1.6" fill="#21406B" />
        <circle cx="53" cy="28" r="1.6" fill="#21406B" />
        {mood === "worry" ? (
          <path d="M43 36 Q48 33 54 36" />
        ) : (
          <path d="M42 34 Q48 39 55 34" />
        )}
        <line x1="48" y1="41" x2="48" y2="84" />
        <line x1="48" y1="54" x2="24" y2="66" />
        <line x1="48" y1="54" x2="74" y2="44" />
        {/* hammer */}
        <line x1="74" y1="44" x2="88" y2="30" strokeWidth="3" />
        <rect x="82" y="18" width="16" height="10" rx="2" transform="rotate(38 90 23)" fill="var(--gray-fill)" />
        <line x1="48" y1="84" x2="34" y2="120" />
        <line x1="48" y1="84" x2="62" y2="120" />
        <line x1="34" y1="120" x2="30" y2="134" />
        <line x1="34" y1="120" x2="42" y2="132" />
        <line x1="62" y1="120" x2="66" y2="134" />
        <line x1="62" y1="120" x2="54" y2="132" />
      </g>
    </svg>
  );
}

/** Notebook page with squiggles and a red question — "notebook slip" doodle. */
export function NotebookDoodle({ className, crossed = false }: { className?: string; crossed?: boolean }) {
  return (
    <svg viewBox="0 0 150 110" className={className} role="img" aria-label="notebook slip">
      <g transform="rotate(-6 75 55)">
        <rect x="18" y="8" width="114" height="92" fill="#FFFFFF" stroke="#21406B" strokeWidth="3" />
        {[30, 46, 62, 78].map((y) => (
          <path
            key={y}
            d={`M30 ${y} q8 -5 16 0 t16 0 t16 0 t16 0 t16 0`}
            fill="none"
            stroke="#9AA8BC"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}
        <circle cx="26" cy="22" r="2.2" fill="#fff" stroke="#21406B" strokeWidth="2" />
        <circle cx="26" cy="54" r="2.2" fill="#fff" stroke="#21406B" strokeWidth="2" />
        <circle cx="26" cy="86" r="2.2" fill="#fff" stroke="#21406B" strokeWidth="2" />
        {crossed && (
          <>
            <line x1="30" y1="20" x2="122" y2="88" stroke="var(--marker-red)" strokeWidth="6" strokeLinecap="round" />
            <line x1="122" y1="20" x2="30" y2="88" stroke="var(--marker-red)" strokeWidth="6" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Small wavy red divider. */
export function WavyRule({ className, color = "var(--marker-red)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 220 12" className={className} aria-hidden="true">
      <path
        d="M4 8 q13 -8 26 0 t26 0 t26 0 t26 0 t26 0 t26 0 t26 0 t26 0"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FlowArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 20" className={className} aria-hidden="true">
      <g stroke="var(--ink-soft)" strokeWidth="3" fill="none" strokeLinecap="round">
        <line x1="4" y1="10" x2="34" y2="10" />
        <path d="M30 4 L38 10 L30 16" />
      </g>
    </svg>
  );
}

/** A "NOV 12" calendar chip, like the deck's due-date tags. */
export function DueChip({ day, month, className }: { day: string; month: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex flex-col items-center border-[2.5px] border-ink bg-white px-2.5 py-1 leading-none sketch-c", className)}
    >
      <span className="font-sketch text-[10px] font-bold tracking-widest text-marker-red">{month}</span>
      <span className="font-sketch text-lg font-bold text-ink">{day}</span>
    </span>
  );
}

/** The signature gold slip card. */
export function SlipCard({
  number,
  weightGrams,
  purity,
  job,
  dueDate,
  isWedding,
  wastageAgreedPct,
  jewellerApproved,
  karigarApproved,
  onJewellerTap,
  onKarigarTap,
  jewellerLabel = "Jeweller",
  karigarLabel = "Karigar",
  className,
  compact = false,
}: {
  number: number | string;
  weightGrams: number;
  purity: string;
  job: string;
  dueDate: string | Date;
  isWedding?: boolean;
  wastageAgreedPct: number;
  jewellerApproved?: boolean;
  karigarApproved?: boolean;
  onJewellerTap?: () => void;
  onKarigarTap?: () => void;
  jewellerLabel?: string;
  karigarLabel?: string;
  className?: string;
  compact?: boolean;
}) {
  const due = new Date(dueDate);
  const day = due.toLocaleDateString("en-IN", { day: "numeric" });
  const month = due.toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
  return (
    <div className={cn("bg-white border-[3px] border-ink paper-shadow sketch-b overflow-hidden", className)}>
      <div className="bg-[var(--blue-fill)] border-b-[3px] border-ink px-4 py-2 flex items-center justify-between">
        <p className="font-sketch font-bold text-base sm:text-lg" style={{ color: "var(--blue-ink)" }}>
          GOLD SLIP #{number}
        </p>
        {isWedding && (
          <span className="stamp" style={{ background: "var(--salmon-fill)", border: "2px solid var(--salmon-line)", color: "var(--ink)" }}>
            WEDDING ORDER
          </span>
        )}
      </div>
      <div className={cn("px-4 py-3 font-hand text-ink", compact ? "text-base leading-snug" : "text-lg leading-relaxed")}>
        <p>
          Gold: <b>{weightGrams.toFixed(2)} g</b>, {purity}
        </p>
        <p>Job: {job}</p>
        <p className="flex items-center gap-2 flex-wrap">
          Due: <b>{due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</b>
          {isWedding && <span className="text-marker-red">(wedding order)</span>}
          <DueChip day={day} month={month} />
        </p>
        <p>
          Agreed wastage: <b>{wastageAgreedPct}%</b>
        </p>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <TapChip label={jewellerLabel} checked={!!jewellerApproved} onTap={onJewellerTap} who="jeweller" />
          <TapChip label={karigarLabel} checked={!!karigarApproved} onTap={onKarigarTap} who="karigar" />
        </div>
      </div>
    </div>
  );
}
