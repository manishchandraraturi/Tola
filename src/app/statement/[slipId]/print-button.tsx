"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border-[2.5px] border-ink bg-[var(--marker-yellow)] px-4 py-2 font-sketch text-sm font-bold text-ink sketch-c print:hidden"
    >
      Print / save as PDF
    </button>
  );
}
