"use client";

export function PrintButton({
  label = "Print / save as PDF",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`min-h-12 border-[2.5px] border-ink bg-[var(--marker-yellow)] px-4 py-2 font-sketch text-sm font-bold text-ink sketch-c print:hidden ${className}`}
    >
      {label}
    </button>
  );
}
