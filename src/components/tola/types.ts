export type SlipStatus = "ISSUED" | "WORKING" | "RETURNED" | "SETTLED";

export type KarigarRow = {
  id: string;
  name: string;
  phone: string;
  speciality: string;
  city: string;
  upiId: string | null;
  goldBalance: number;
  openSlips: number;
};

export type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  upiRef: string | null;
  paidConfirmedAt: string | null;
  upiLink?: string;
  createdAt: string;
};

export type SlipPhotoRow = {
  id: string;
  sha256: string;
  filename: string;
  weightGrams: number;
  confidence: number;
  actor: string;
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
  source: string;
  pieceWeightGrams: number | null;
  scrapWeightGrams: number | null;
  wastageActualPct: number | null;
  fairFlag: string | null;
  disputed: boolean;
  disputeNote: string | null;
  disputeOpenedBy: string | null;
  wastageProposedPct: number | null;
  wastageProposalStatus: string | null;
  wastageProposalNote: string | null;
  jewellerApproved: boolean;
  karigarApproved: boolean;
  makingCharges: number | null;
  paidAt: string | null;
  payDueAt: string | null;
  jewellerApprovedAt: string | null;
  karigarApprovedAt: string | null;
  settledAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  publicToken: string | null;
  karigarId: string;
  karigarName: string;
  karigarPhone: string;
  payment: PaymentRow | null;
  photos: SlipPhotoRow[];
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

export type NotificationRow = {
  id: string;
  channel: string;
  recipient: string;
  actor: string;
  text: string;
  isDemo: boolean;
  createdAt: string;
};

export type StateResponse = {
  jeweller: { name: string; city: string; rate: number };
  plan: { cap: number; proposedRupees: number; label: string };
  benchmarks: Array<{ keyword: string; minPct: number; maxPct: number; avgPct: number; source: string }>;
  karigars: KarigarRow[];
  slips: SlipRow[];
  ledger: LedgerRow[];
  stats: {
    goldOut: number;
    openSlips: number;
    dueSoon: number;
    avgPayDays: number;
    paidTotal: number;
    pendingPayments: number;
    overduePayments: number;
    disputes: number;
    disputesThisMonth: number;
    avgDisputeDays: number;
    disputeHistory: Array<{ month: string; opened: number; closed: number }>;
    disputeTrend: Array<{ month: string; opened: number; closed: number }>;
    onTimeDeliveryPct: number;
    onTimeCount: number;
    returnedCount: number;
    paidSample: number;
    settledCount: number;
  };
  alerts: WatcherAlert[];
  notifications: NotificationRow[];
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
