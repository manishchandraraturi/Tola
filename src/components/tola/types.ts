export type SlipStatus = "ISSUED" | "WORKING" | "RETURNED" | "SETTLED";

export type KarigarRow = {
  id: string;
  name: string;
  phone: string;
  speciality: string;
  city: string;
  goldBalance: number;
  openSlips: number;
};

export type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
};

export type SlipRow = {
  id: string;
  number: number;
  weightGrams: number;
  purity: string;
  job: string;
  isWedding: boolean;
  dueDate: string;
  wastageAgreedPct: number;
  status: SlipStatus;
  pieceWeightGrams: number | null;
  scrapWeightGrams: number | null;
  wastageActualPct: number | null;
  fairFlag: string | null;
  disputed: boolean;
  disputeNote: string | null;
  jewellerApproved: boolean;
  karigarApproved: boolean;
  makingCharges: number | null;
  paidAt: string | null;
  createdAt: string;
  karigarId: string;
  karigarName: string;
  karigarPhone: string;
  payment: PaymentRow | null;
};

export type LedgerRow = {
  id: string;
  kind: string;
  text: string;
  hash: string;
  createdAt: string;
  slip?: { number: number } | null;
};

export type WatcherAlert = {
  slipNumber: number;
  job: string;
  karigarName: string;
  dueDate: string;
  daysLeft: number;
  level: "wedding-soon" | "urgent" | "overdue" | "info";
  message: string;
};

export type StateResponse = {
  jeweller: { name: string; city: string; rate: number };
  karigars: KarigarRow[];
  slips: SlipRow[];
  ledger: LedgerRow[];
  stats: {
    goldOut: number;
    openSlips: number;
    dueSoon: number;
    avgPayDays: number;
    paidTotal: number;
    disputes: number;
    settledCount: number;
  };
  alerts: WatcherAlert[];
};

export const STATUS_LABEL: Record<SlipStatus, string> = {
  ISSUED: "ISSUED",
  WORKING: "GOLD WITH KARIGAR",
  RETURNED: "RETURNED",
  SETTLED: "SETTLED",
};

export function fmtDate(iso: string | Date, withMonth = true) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    ...(withMonth ? { month: "short" } : {}),
  });
}

export function fmtDateTime(iso: string | Date) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fmtRupees(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
