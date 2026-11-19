# Slide Traceability — Tola (Slides 2–12)

This document maps every claim in the pitch deck to what actually exists in this repository, and
says plainly where the prototype differs from the production design. Slide titles are the deck's
narrative sections as reflected in `src/components/tola/landing.tsx`; if the deck wording changes,
only this table needs updating.

**Status legend**

| Status | Meaning |
| --- | --- |
| `[Built]` | Real code path in this repo, exercised by the app and/or tests. |
| `[Demo Adapter]` | Simulated or rule-based stand-in, visibly labelled DEMO in the UI. Not the production integration. |
| `[Roadmap]` | Not built. Described as future work only. |

| Slide # | Promise / Feature | Implementation File(s) / Route | Status | Honesty Note |
| --- | --- | --- | --- | --- |
| 2 | Gold leaves the counter on trust: no shared record of weight, wastage or returns | `src/components/tola/landing.tsx` (Problem), `prisma/schema.prisma` (`Slip`, `LedgerEntry`), `src/lib/tola.ts` (`computeWastage`) | `[Built]` | This is problem framing, not a measured survey. The only hard numbers are the trade/ITAT sources on Slide 12. |
| 3 | Four parties in the picture: jeweller, karigar, customer, family/refiner | `landing.tsx` (Personas), `Karigar`, `Slip.customerName` / `Slip.publicToken`, `src/app/status/[token]/page.tsx` | `[Built]` | The customer status link is real and tokenised. "Family" is narrative only; there is no separate family role or login. |
| 4 | Today versus Tola: books against memory, versus one shared signed record | `landing.tsx` (TodayVsTola), dashboard tabs, append-only ledger | `[Built]` | Competitor price ranges (Rs 6,000–60,000) are listed prices from the Slide 12 sources, not quotes obtained for this project. |
| 5 | One slip, signed by both sides at every step | `/api/slips/[id]/confirm`, `/approve`, `/return`, `/wastage-proposal`, `/api/otp/request`, `/api/payments/[id]/pay`, `/api/payments/[id]/confirm`; `dashboard.tsx`, `slips.tsx`, `karigar-view.tsx` | `[Built]` | Every tap writes a hash-linked ledger entry with actor and timestamp. OTP challenges are real; the SMS carrying the code is a demo message log. |
| 6 | Four AI agents: Scribe, Watcher, Fair-wastage, Settler | `/api/agents/scribe`, `/api/agents/watcher`, `/api/agents/watcher/run`, `/api/agents/fairwastage`, `/api/agents/settler`; parsing/verdict logic in `src/lib/tola.ts` | `[Demo Adapter]` | Agents run locally as deterministic parsers and rules. There are no Lyzr-hosted agents and no external LLM calls required in this build; agent panels are labelled DEMO. |
| 7 | Append-only, hash-linked ledger; tampering shows; both parties confirm with OTP | `src/lib/tola.ts` (`appendLedger`, `hashChain`, `verifyLedgerChain`), `LedgerEntry`, `/api/ledger/verify`, `/audit/export`, `tests/ledger-chain.test.ts` | `[Built]` | The chain detects edits, deletions and reordering (6 integration tests). It is tamper-evident, not tamper-proof: whoever owns the database can rewrite the whole chain consistently. |
| 8 | Tech stack: capture, think, record, pay | This repo: Next.js 16, TypeScript, Prisma + SQLite, Vitest. Production design: Python/FastAPI, PostgreSQL, Lyzr agents. | `[Demo Adapter]` | The landing page now states explicitly that the running prototype is Next.js/Prisma/SQLite and that FastAPI/PostgreSQL/Lyzr is the production design. None of that production stack exists in this repository. |
| 9 | Business model: free for karigars, Rs 499/month per jeweller (up to 10 karigars) | `landing.tsx` (Pricing), `PROPOSED_PLAN_RUPEES` / `KARIGAR_PLAN_CAP` in `src/lib/tola.ts`, `/api/state` (`plan`), `/api/karigars` | `[Demo Adapter]` | Rs 499 and the 10-karigar cap are **proposed assumptions**, labelled "proposed" in the UI. There is no billing, subscription or payment collection; the cap only returns a 409 from the add-karigar route. |
| 10 | Impact measured live: disputes per month, days from approval to paid, on-time delivery, gold with karigars | `src/lib/tola.ts` (`disputeTrend`, `approvalToPaid`, `onTimeDelivery`, `disputeMetrics`), `/api/state` stats, dashboard Impact & Audit panel, `/audit/export`, `tests/impact-audit.test.ts` | `[Built]` | Metrics are computed live from the demo/seed ledger, not from field data. Average pay uses the corrected latest-approval → confirmed-receipt clock; on-time % only counts returns that carry a date. |
| 11 | Impact and benefits: karigar work record, refiner trail, customer wedding-piece status | `landing.tsx` (Impact), `/status/[token]` page + `/api/status/[token]`, scrap fields on `Slip`, `/statement/[slipId]`, `/statement/karigar/[karigarId]`, `/audit/export` | `[Built]` | Customer status, scrap logging and printable statements are real. The "Tola passport" sharing and the refiner link are roadmap items, not implemented. |
| 12 | Sources and honesty line | `landing.tsx` (Sources) | `[Built]` | The required line is present: "Items marked \"proposed\" (price, pilot) are our design assumptions. No field survey is claimed." |
| P14 | Refiner link and Karigar Passport (partner credit) | None | `[Roadmap]` | Listed as NEXT/THEN in the landing Pricing roadmap. No route, model or UI exists. |

## Honesty boundaries that apply across slides

- **Money**: no payment is executed. UPI links are generated (`buildUpiLink`) but never dispatched; payments are marked PAID only after an OTP.
- **Messaging**: WhatsApp chat is an in-app demo endpoint; SMS/WhatsApp notifications are written to `NotificationLog` with `channel = DEMO_SMS`.
- **Voice/photo**: transcription and scale-photo readings are simulated inputs parsed locally; the photo's SHA-256 is stored, the image is not.
- **AI**: the four "agents" are deterministic code paths, not hosted LLM agents.
- **Scale**: one jeweller, three karigars of seed data, one SQLite file. No multi-tenant production hardening.

## Proof

```bash
npx tsc --noEmit     # 0
npm run lint         # 0 errors
npx vitest run       # 14 files / 180 tests
```
