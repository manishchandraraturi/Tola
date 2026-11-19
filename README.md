<div align="center">

<img src="assets/hero.png" alt="Tola: gold accounts that both sides trust" width="100%"/>

# 🪙 Tola

### Gold accounts that both sides trust.
**Every gram. One record. Two signatures.**

A dual-signed digital ledger for gold job-work between **jewellers** and **karigars** (craftsmen).  
No more paper slips. No more *"I said 3%!" / "No, we said 4%!"*

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/tests-182_passing-2ea44f?style=for-the-badge&logo=vitest&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline--first-F5A623?style=for-the-badge)
![i18n](https://img.shields.io/badge/EN_·_हिन्दी_·_ಕನ್ನಡ-8B5CF6?style=for-the-badge)

[**✨ Features**](#-features) · [**🚀 Quick start**](#-quick-start) · [**🛡️ Security**](#️-security--trust) · [**🧱 Stack**](#-tech-stack) · [**🗺️ Roadmap**](#️-roadmap)

</div>

---

## 😤 Why Tola exists

In India's gold trade, jewellers hand raw gold to karigars for job-work. Today that runs on **notebook slips, verbal wastage deals, phone-call deadlines and month-end squaring**. With no shared record, every doubt becomes a dispute. Karigars (the least powerful side) wait weeks for pay, and jewellers lose gold with no trail.

<img src="assets/problem.png" alt="The problem: gold leaves the counter on trust" width="100%"/>

> 🔨 Karigars hand-make about **55%** of India's manufactured gold jewellery, and only 15–20% of manufacturing units are organised *(World Gold Council)*. There are roughly **5 million** karigars *(trade estimate, Art of Jewellery, 2025)*.

<img src="assets/people.png" alt="Jeweller, karigar, customer, refiner" width="100%"/>

**Tola gives all four one simple, shared record.**

---

## ✨ Features

### 📝 One slip, signed by both

<img src="assets/solution.png" alt="Gold slip signed by jeweller and karigar" width="100%"/>

### 🔐 The one rule: *"Nothing changes without both taps."*

```mermaid
flowchart LR
    A["📝 ISSUE<br/>weigh, snap the scale,<br/>both confirm"] --> B["⚒️ WORK<br/>live gold balance,<br/>visible to both"]
    B --> C["📦 RETURN<br/>piece + scrap weighed,<br/>wastage worked out"]
    C --> D["💸 SETTLE<br/>both approve,<br/>UPI payout on a clock"]
```

<img src="assets/today-vs-tola.png" alt="Today versus with Tola" width="100%"/>

### 🤖 Four AI agents, one job: keep it fair

> **AI suggests. People approve. The AI never changes a number on its own.**

<img src="assets/agents.png" alt="Scribe, Watcher, Fair-wastage, Settler" width="100%"/>

| Agent | What it does |
|---|---|
| 🎙️ **Scribe** | Speak in Kannada / Hindi / English or snap the scale. Reads the weight and fills the slip. |
| 👁️ **Watcher** | Tracks due dates, puts wedding orders first, warns early, shares a customer status link. |
| ⚖️ **Fair-Wastage** | Compares each job with the pair's history and trade benchmarks using statistical anomaly detection. Flags outliers gently ("higher than usual"), **never accusingly**. |
| 💰 **Settler** | Builds both statements, starts the payment clock, generates the UPI deep link, waits for both approvals. |

### 🤝 Disputes, without the drama

- **Wastage counter-proposals.** Karigar disagrees? Counter-propose; the jeweller accepts or declines.
- **Dispute flag.** Either side can raise one. **Settlement is blocked** until resolved, and the accused party can't resolve it alone.
- **Payment clock.** Jeweller pays via UPI link/QR and enters the reference; the karigar confirms receipt with an OTP. *Paid on a clock, not on mood.*

### 🌐 Public links: no login, no leaks

| Link | For | Shows |
|---|---|---|
| `/status/[token]` 💍 | **Customer** | Order progress and ETA only. Strict whitelist: no weights, wastage or financials. |
| `/refiner/[token]` 🔥 | **Refiner** | Log recovered scrap gold (`ScrapLot`) with a clear trail of where it came from. |
| `/passport/[token]` 🪪 | **Karigar** (opt-in) | **Karigar Passport**: delivered jobs, on-time %, average wastage. Zero PII. A portable trust record. |

### 📱 Built for the real workshop

Low literacy, patchy signal, cheap phones, so:

- 🎤 Voice and photo entry instead of typing
- 📴 **Offline-first PWA**: actions queue in IndexedDB and sync when signal returns
- 🌏 Full **English / हिन्दी / ಕನ್ನಡ** (Noto Sans)
- ✏️ A hand-drawn **Sketch Notebook** design system that feels like the paper slip it replaces

<img src="assets/different.png" alt="Why Tola is different" width="100%"/>

---

## 🛡️ Security & trust

| | |
|---|---|
| ⛓️ **Tamper-evident ledger** | Append-only, SHA-256 hash-linked entries (`seq`, `prevHash`, `actor`, `proof`). Edit, reorder or delete a record and the chain breaks and is flagged instantly. |
| 🔑 **OTP signatures** | Issue, return approval and settlement need a 6-digit OTP: hash-only storage, 5-minute expiry, 3 attempts. |
| 🙈 **Strict data isolation** | PIN-based auth for jeweller and karigars. A karigar sees **only** their own slips, balances and ledger entries. |
| ✅ **Server-side validation** | Every API route validates strictly on the server. |

---

## 💡 Who wins

<img src="assets/impact.png" alt="Impact for karigars, jewellers, customers, refiners" width="100%"/>

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, custom Sketch Notebook design system |
| Database | Prisma ORM + SQLite (switch to PostgreSQL for production) |
| Testing | Vitest: **182 passing tests** |
| Architecture | Full-stack Next.js, server-side API routes, offline-first PWA |

---

## 🚀 Quick start

**Requirements:** Node.js 20+ and npm.

```bash
# 1. Clone
git clone https://github.com/manishchandraraturi/tola.git
cd tola

# 2. Install (also runs `prisma generate`)
npm install

# 3. Configure the database
echo 'DATABASE_URL="file:./dev.db"' > .env

# 4. Create the SQLite database
npm run db:push

# 5. Run
npm run dev
```

Open **http://localhost:3000** 🎉

### 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build with strict type checking |
| `npm start` | Serve the production build |
| `npm test` | Run all 182 Vitest tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | ESLint |
| `npm run check:routes` | Route sanity check |
| `npm run db:push` · `db:generate` · `db:migrate` · `db:reset` | Prisma database tasks |

Deploying to Vercel or Render, or moving to PostgreSQL? See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## ✅ Quality

- 🧪 **182 tests**: ledger integrity (tampering, reordering, deletion), auth privacy, OTP expiry/reuse, payment flows, fair-wastage bands
- 🧹 **0 lint errors · 0 TypeScript errors**
- 📦 **Production build verified**, Prisma client generated via `postinstall`

---

## 🗂️ Project structure

```
src/
├─ app/api/            # auth, slips, ledger, agents, otp, payments
├─ lib/                # tola.ts (ledger + math), auth.ts, otp.ts, i18n.ts
└─ components/tola/    # dashboard, karigar-view, sketch UI
prisma/schema.prisma   # data models
tests/                 # Vitest suites
assets/                # README images
```

---

## 🧭 Honest scope

Tola is a working prototype, and it says so, both here and in the UI.

- 🧠 **Deterministic AI agents.** The four agents run as rule-based, local algorithms: zero hallucinations, zero API cost, fully offline. The architecture is ready to plug in LLMs (OpenAI, Anthropic, Lyzr) via environment variables.
- 🎭 **Demo adapters.** WhatsApp/SMS, UPI payouts and voice/photo AI are real interfaces running as **DEMO** adapters, visibly labelled in the UI.

---

## 🗺️ Roadmap

<img src="assets/business.png" alt="Business model and roadmap" width="100%"/>

| NOW | NEXT | THEN |
|---|---|---|
| Issue, return, settle with voice and photo | Refiner link and customer status link | Karigar Passport and partner credit |

---

<div align="center">

### Same trade. Same trust. **One record instead of two memories.**

🪙 **Every gram, one record, two signatures.** 🪙

Built by [@manishchandraraturi](https://github.com/manishchandraraturi)  
⭐ Star the repo if Tola made you smile.

</div>
