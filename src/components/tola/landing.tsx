"use client";

import * as React from "react";
import { Mic, BellRing, Scale, Wallet, Volume2, MessageCircle, Phone, Link2 } from "lucide-react";
import {
  SketchBox,
  SketchButton,
  Highlight,
  Takeaway,
  NumDot,
  SectionTitle,
  Kicker,
  GoldBar,
  GoldCoin,
  BalanceScale,
  StickJeweller,
  StickKarigar,
  NotebookDoodle,
  WavyRule,
  FlowArrow,
  DueChip,
  SlipCard,
} from "./sketch";

type Props = {
  onOpenDashboard: () => void;
  onOpenKarigar: () => void;
};

/* ------------------------------ Nav ------------------------------ */

function Nav({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const links = [
    ["Problem", "#problem"],
    ["Who", "#who"],
    ["The flow", "#solution"],
    ["Agents", "#agents"],
    ["Pricing", "#pricing"],
    ["Sources", "#sources"],
  ] as const;
  return (
    <header className="sticky top-0 z-40 border-b-[2.5px] border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <a href="#top" className="flex items-center gap-2">
          <GoldBar label="1 TOLA" className="h-7 w-12" />
          <span className="font-sketch text-2xl font-bold text-ink">Tola</span>
        </a>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-4 lg:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="font-sketch text-sm font-bold text-ink-soft transition-colors hover:text-marker-red"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SketchButton tone="yellow" onClick={onOpenDashboard} className="!py-1.5 text-sm sm:text-base">
            Open the dashboard
          </SketchButton>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ Hero ------------------------------ */

function Hero({ onOpenDashboard, onOpenKarigar }: Props) {
  return (
    <section id="top" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 lg:grid-cols-2 lg:pt-14">
      <div>
        <div className="flex items-end gap-3">
          <h1 className="font-sketch text-6xl font-bold text-ink sm:text-7xl md:text-8xl" style={{ textShadow: "2px 2px 0 rgba(33,64,107,0.15)" }}>
            Tola
          </h1>
          <GoldBar label="1 TOLA" className="tola-float h-12 w-24 sm:h-14 sm:w-28" />
        </div>
        <WavyRule className="mt-1 w-56" />
        <p className="mt-2 font-hand text-lg text-ink-soft">(a tola is the traditional Indian unit of gold)</p>
        <p className="mt-6 font-sketch text-3xl font-bold leading-snug text-ink sm:text-4xl">
          gold accounts that
          <br />
          <Highlight className="px-2">both sides trust</Highlight>
        </p>
        <p className="mt-5 max-w-md font-hand text-lg leading-relaxed text-ink-soft">
          Gold given to karigars for job-work, written down twice — in his notebook and in your
          register. Tola keeps <b className="text-ink">one shared record</b>, signed by both, with
          four small AI agents keeping it fair.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SketchButton tone="yellow" onClick={onOpenDashboard}>
            Open the jeweller dashboard
          </SketchButton>
          <SketchButton tone="green" onClick={onOpenKarigar}>
            See the karigar&apos;s phone
          </SketchButton>
        </div>
        <div className="mt-6 inline-flex flex-col gap-1 sketch px-4 py-2 bg-[var(--marker-yellow-soft)]">
          <p className="font-sketch text-sm font-bold text-ink">Tech4Bharat 2026 | Problem 2.2</p>
          <p className="font-hand text-sm text-ink-soft">
            Jeweltech: gold given to karigars for job-work · Agentic AI
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <NotebookDoodle crossed className="w-full max-w-[190px] justify-self-end tola-wiggle" />
          <FlowArrow className="w-10 sm:w-14" />
          <SlipCard
            number={214}
            weightGrams={25.4}
            purity="22K"
            job="Necklace set"
            dueDate={new Date(2026, 10, 12)}
            isWedding
            wastageAgreedPct={3}
            jewellerApproved
            karigarApproved
            className="max-w-[260px]"
            compact
          />
        </div>
        <div className="mt-6 flex items-end justify-center gap-8">
          <BalanceScale className="h-28 w-40 sm:h-32 sm:w-44" />
          <GoldCoin label="22K" className="tola-float h-12 w-20" />
          <GoldCoin label="22K" className="tola-float h-14 w-24" style={{ animationDelay: "1.2s" } as React.CSSProperties} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Problem ------------------------------ */

function SpeechBubble({
  tone,
  children,
  className,
}: {
  tone: "salmon" | "blue";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SketchBox tone={tone} variant="c" className={`px-4 py-2 ${className ?? ""}`}>
      <p className="font-sketch text-sm font-bold sm:text-base">{children}</p>
    </SketchBox>
  );
}

function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>The problem: gold leaves the counter on trust</SectionTitle>
      <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            <div className="text-center">
              <SpeechBubble tone="salmon" className="tola-wiggle">It was 3% wastage!</SpeechBubble>
              <StickJeweller className="mx-auto mt-2 h-28 w-20" mood="worry" />
              <p className="font-sketch text-sm font-bold text-ink-soft">Jeweller</p>
            </div>
            <div className="relative">
              <GoldCoin label="25.4 g?" className="h-14 w-24" />
              <FlowArrow className="absolute -right-8 top-4 hidden w-9 sm:block" />
              <FlowArrow className="absolute -left-8 top-4 hidden w-9 rotate-180 sm:block" />
            </div>
            <div className="text-center">
              <SpeechBubble tone="blue" className="tola-wiggle" >No. We said 4%.</SpeechBubble>
              <StickKarigar className="mx-auto mt-2 h-28 w-20" mood="worry" />
              <p className="font-sketch text-sm font-bold text-ink-soft">Karigar</p>
            </div>
          </div>
          <div className="mx-auto mt-8 flex max-w-md items-center gap-4">
            <NotebookDoodle className="w-36 shrink-0" />
            <p className="font-hand text-base leading-snug text-ink-soft">
              Notebook slip, wastage agreed by word,
              <br />
              accounts squared at month end.
            </p>
          </div>
        </div>

        <ul className="space-y-4">
          {[
            <>
              Karigars hand-make about <b>55% of India&apos;s manufactured gold jewellery</b>. (World Gold Council)
            </>,
            <>
              Even larger firms track gold issued to karigars in <b>spreadsheets and vouchers</b>, and
              tax tribunals have seen these. (ITAT orders)
            </>,
            <>
              A tax officer questioned a jeweller&apos;s wastage claim because <b>no day-to-day loss
              records existed</b>. (ITAT, Sanghi Jewellers)
            </>,
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <NumDot n={i + 1} />
              <SketchBox tone="yellow" variant={i % 2 ? "b" : "a"} className="flex-1 px-4 py-3">
                <p className="font-hand text-base leading-relaxed text-ink sm:text-lg">{text}</p>
              </SketchBox>
            </li>
          ))}
        </ul>
      </div>
      <SketchBox tone="salmon" variant="c" className="mx-auto mt-10 max-w-2xl px-5 py-4">
        <p className="font-sketch text-center text-lg font-bold text-ink sm:text-xl">
          No shared record means every doubt turns into <span className="underline">a dispute.</span>
        </p>
      </SketchBox>
    </section>
  );
}

/* ------------------------------ Personas ------------------------------ */

function Personas() {
  const items = [
    {
      title: "Jeweller",
      icon: <StickJeweller className="h-24 w-16" mood="worry" />,
      body: "Juggles custom orders across many karigars.",
      fear: "Fear: gold lost with no clear reason, late orders.",
      tone: "white" as const,
    },
    {
      title: "Karigar",
      icon: <StickKarigar className="h-24 w-16" mood="worry" />,
      body: "Works for several jewellers, often from home.",
      fear: "Fear: wrong numbers, weeks waiting for pay. Least power.",
      tone: "white" as const,
    },
    {
      title: "Customer",
      icon: <DueChip day="12" month="NOV" className="my-3" />,
      body: "Has a fixed occasion date.",
      fear: "Fear: delay, and no news until the last day.",
      tone: "white" as const,
    },
    {
      title: "Refiner",
      icon: <BalanceScale className="h-20 w-28" />,
      body: "Recovers gold from workshop scrap.",
      fear: "Needs: a clear record of what scrap came from where.",
      tone: "white" as const,
    },
  ];
  return (
    <section id="who" className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>Who is in the picture</SectionTitle>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p, i) => (
          <SketchBox key={p.title} tone={p.tone} variant={(["a", "b", "c", "d"] as const)[i]} className="flex flex-col items-center px-4 pb-5 pt-4 text-center">
            <p className="font-sketch text-xl font-bold text-ink">{p.title}</p>
            <div className="flex h-28 items-center justify-center">{p.icon}</div>
            <p className="font-hand text-base leading-snug text-ink">{p.body}</p>
            <p className="mt-2 font-hand text-sm leading-snug text-marker-red">{p.fear}</p>
          </SketchBox>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-3xl text-center font-hand text-sm text-ink-soft">
        About 5 million karigars (trade estimate, Art of Jewellery, 2025). Only 15 to 20% of
        manufacturing units are organised (World Gold Council).
      </p>
      <Takeaway className="mx-auto mt-6 max-w-2xl">Tola gives all four one simple, shared record.</Takeaway>
    </section>
  );
}

/* ------------------------------ Today vs Tola ------------------------------ */

function FlowRow({
  label,
  labelColor,
  steps,
  endTone,
}: {
  label: string;
  labelColor: string;
  steps: string[];
  endTone: "salmon" | "green";
}) {
  return (
    <div>
      <p className="font-sketch text-xl font-bold" style={{ color: labelColor }}>
        {label}
      </p>
      <div className="mt-3 flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <SketchBox
              tone={i === steps.length - 1 ? endTone : "gray"}
              variant={(["a", "b", "c", "d"] as const)[i % 4]}
              className="flex-1 px-3 py-3 text-center"
            >
              <p className="font-hand text-sm leading-snug text-ink sm:text-base">{s}</p>
            </SketchBox>
            {i < steps.length - 1 && <FlowArrow className="mx-auto h-6 w-8 rotate-90 lg:rotate-0" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function TodayVsTola() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>Today versus with Tola</SectionTitle>
      <div className="mt-8 space-y-8">
        <FlowRow
          label="TODAY"
          labelColor="var(--marker-red)"
          steps={[
            "Gold noted in a notebook or on a slip",
            "Wastage agreed by word",
            "Deadlines chased by phone",
            "Accounts squared at month end",
            "Dispute, delay, sour relationship",
          ]}
          endTone="salmon"
        />
        <FlowRow
          label="WITH TOLA"
          labelColor="var(--green-line)"
          steps={[
            "Issue slip on both phones, weight from a photo of the scale",
            "Live gold balance with each karigar, seen by both",
            "Alerts before every due date, wedding dates first",
            "Piece and scrap weighed on return, wastage worked out",
            "Both approve, karigar paid by UPI",
          ]}
          endTone="green"
        />
      </div>
      <Takeaway className="mx-auto mt-10 max-w-3xl">
        Same trade, same trust. One record instead of two memories.
      </Takeaway>
    </section>
  );
}

/* ------------------------------ Solution ------------------------------ */

function Solution({ onOpenDashboard }: Props) {
  const steps = [
    { name: "ISSUE", tone: "blue" as const, body: "Weigh, snap the scale, both confirm" },
    { name: "WORK", tone: "green" as const, body: "Gold balance with the karigar visible to both" },
    { name: "RETURN", tone: "orange" as const, body: "Piece and scrap weighed, wastage worked out" },
    { name: "SETTLE", tone: "salmon" as const, body: "Both approve, UPI payout on a clock" },
  ];
  return (
    <section id="solution" className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>The solution: one slip, signed by both</SectionTitle>

      <div className="mt-10 grid items-center gap-6 lg:grid-cols-[auto_1fr_auto]">
        <div className="mx-auto text-center">
          <StickJeweller className="mx-auto h-32 w-24" mood="worry" />
          <p className="mt-1 font-sketch font-bold text-ink-soft">Jeweller</p>
        </div>
        <div className="grid place-items-center">
          <FlowArrow className="hidden w-14 lg:block" />
          <SlipCard
            number={214}
            weightGrams={25.4}
            purity="22K"
            job="Necklace set"
            dueDate={new Date(2026, 10, 12)}
            isWedding
            wastageAgreedPct={3}
            jewellerApproved
            karigarApproved
            className="w-full max-w-md"
          />
          <FlowArrow className="mt-2 hidden w-14 -scale-x-100 lg:block" />
        </div>
        <div className="mx-auto text-center">
          <StickKarigar className="mx-auto h-32 w-24" mood="worry" />
          <p className="mt-1 font-sketch font-bold text-ink-soft">Karigar</p>
        </div>
      </div>

      <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={s.name}>
            <SketchBox tone={s.tone} variant={(["a", "b", "c", "d"] as const)[i]} className="px-4 py-4 text-center">
              <p className="font-sketch text-lg font-bold tracking-wide">{s.name}</p>
              <p className="mt-1 font-hand text-sm leading-snug">{s.body}</p>
            </SketchBox>
            {i < steps.length - 1 && <FlowArrow className="mx-auto hidden h-6 w-8 lg:block" />}
          </React.Fragment>
        ))}
      </div>

      <Takeaway className="mx-auto mt-10 max-w-3xl">
        Nothing changes without both taps. That is the whole idea.
      </Takeaway>
      <div className="mt-8 text-center">
        <SketchButton tone="yellow" onClick={onOpenDashboard}>
          Try the flow in the live dashboard
        </SketchButton>
      </div>
    </section>
  );
}

/* ------------------------------ Agents ------------------------------ */

function Agents() {
  const agents = [
    {
      name: "Scribe",
      icon: <Mic className="h-10 w-10 text-ink" strokeWidth={2.2} />,
      body: "Speak, or snap the scale, in Kannada or Hindi. Reads the weight and fills the slip.",
      chips: [
        { icon: <Volume2 className="h-4 w-4" />, label: "Voice in Kannada or Hindi" },
        { icon: <MessageCircle className="h-4 w-4" />, label: "WhatsApp for karigars" },
      ],
      tone: "blue" as const,
    },
    {
      name: "Watcher",
      icon: <BellRing className="h-10 w-10 text-ink" strokeWidth={2.2} />,
      body: "Tracks every due date. Puts wedding orders first, warns early, tells the customer.",
      chips: [
        { icon: <DueChip day="12" month="NOV" className="scale-90" />, label: "Wedding dates first" },
        { icon: <Phone className="h-4 w-4" />, label: "Early warning to both" },
      ],
      tone: "yellow" as const,
    },
    {
      name: "Fair-wastage",
      icon: <Scale className="h-10 w-10 text-ink" strokeWidth={2.2} />,
      body: "Compares each job with that pair's history and the usual range. Flags odd ones in plain words. Never accuses.",
      chips: [
        { icon: <Scale className="h-4 w-4" />, label: "Pair history, usual range" },
        { icon: <Mic className="h-4 w-4" />, label: "Plain words, no blame" },
      ],
      tone: "green" as const,
    },
    {
      name: "Settler",
      icon: <Wallet className="h-10 w-10 text-ink" strokeWidth={2.2} />,
      body: "Builds both statements, starts the payment clock, sends the UPI link, waits for both approvals.",
      chips: [
        { icon: <Wallet className="h-4 w-4" />, label: "Payment clock + UPI link" },
        { icon: <Link2 className="h-4 w-4" />, label: "Statement on both phones" },
      ],
      tone: "salmon" as const,
    },
  ];
  return (
    <section id="agents" className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>Four AI agents, one job: keep it fair</SectionTitle>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((a, i) => (
          <SketchBox key={a.name} tone={a.tone} variant={(["a", "b", "c", "d"] as const)[i]} className="flex flex-col px-4 pb-4 pt-4">
            <p className="font-sketch text-xl font-bold text-ink">{a.name}</p>
            <div className="my-3">{a.icon}</div>
            <p className="font-hand text-base leading-snug text-ink">{a.body}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.chips.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5 border-2 border-ink-soft bg-white px-2 py-0.5 font-sketch text-[11px] font-bold text-ink sketch-c">
                  {c.icon}
                  {c.label}
                </span>
              ))}
            </div>
          </SketchBox>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <SketchBox tone="yellow" variant="c" className="px-5 py-4">
          <p className="font-sketch text-lg font-bold text-ink">Ground rules: AI suggests, people approve.</p>
          <p className="mt-1 font-hand text-base leading-relaxed text-ink">
            The karigar sees his full account. No settlement without both taps.
          </p>
        </SketchBox>
        <SketchBox tone="white" variant="b" className="px-5 py-4">
          <p className="font-sketch font-bold text-ink">Why fairness is built in:</p>
          <p className="mt-1 font-hand text-sm leading-relaxed text-ink-soft">
            a West Bengal GST advance ruling records wastage allowances of 40 g and 30 g at two
            levels of one job chain, naming bargaining power as a factor. Tola makes the number
            visible and comparable.
          </p>
        </SketchBox>
      </div>
    </section>
  );
}

/* ------------------------------ Six questions ------------------------------ */

function SixQuestions() {
  const rows: Array<[string, string]> = [
    ["How is gold issued and recorded today?", "Digital issue slip, photo of the scale, both confirm."],
    ["How is wastage agreed, and how often disputed?", "Agreed % is saved on the slip. Actual vs agreed shows at return."],
    ["What happens when a piece is late for a wedding?", "Wedding-date priority, early warning to both, status link for the customer."],
    ["How long does a karigar wait to be paid?", "A payment clock starts at approval. UPI link and reminders."],
    ["What if the jeweller's number differs from his?", "There is one record. Both see the same numbers."],
    ["How many karigars and orders at once?", "One dashboard: every karigar, every open order, gold balance of each."],
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>The six field questions, answered in the design</SectionTitle>
      <div className="mt-8 overflow-hidden">
        <div className="grid grid-cols-[1fr_1.2fr] gap-x-4 border-b-[2.5px] border-ink pb-2">
          <p className="font-sketch font-bold text-ink">Questions in the problem brief</p>
          <p className="font-sketch font-bold text-ink">What Tola does</p>
        </div>
        {rows.map(([q, a], i) => (
          <div key={i} className="grid grid-cols-[1fr_1.2fr] items-center gap-x-4 border-b border-dashed border-ink-soft/50 py-3">
            <p className="font-hand text-sm text-ink-soft sm:text-base">{q}</p>
            <p className="font-hand text-sm font-bold text-ink sm:text-base">{a}</p>
          </div>
        ))}
      </div>
      <SketchBox tone="green" variant="c" className="mx-auto mt-8 max-w-3xl px-5 py-3">
        <p className="text-center font-hand text-base text-ink sm:text-lg">
          Made for <b>low literacy, patchy signal and cheap phones</b>: voice and photo entry,
          offline use, sync later.
        </p>
      </SketchBox>
    </section>
  );
}

/* ------------------------------ Tech stack ------------------------------ */

function TechStack() {
  const cols = [
    {
      name: "1. CAPTURE",
      tone: "blue" as const,
      items: [
        "Phone app (PWA) that works offline and syncs later",
        "Voice in Kannada or Hindi (Whisper, Bhashini)",
        "Scale photo to weight (vision model + OCR)",
        "WhatsApp chat for karigars who prefer it",
      ],
    },
    {
      name: "2. THINK",
      tone: "yellow" as const,
      items: [
        "Lyzr agents: Scribe, Watcher, Fair-wastage, Settler",
        "LLM explains in plain language",
        "Rules + simple statistics for wastage bands",
        "Human approval gate on every settlement",
      ],
    },
    {
      name: "3. RECORD",
      tone: "green" as const,
      items: [
        "PostgreSQL, append-only entries",
        "Entries hash-linked, so tampering shows",
        "Both parties confirm with an OTP",
        "Each karigar sees only his own account",
      ],
    },
    {
      name: "4. PAY + ALERT",
      tone: "salmon" as const,
      items: [
        "UPI deep links for payouts",
        "WhatsApp Business API, SMS fallback",
        "Due-date and wedding-date reminders",
        "Customer status link, no login",
      ],
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>Tech stack: capture, think, record, pay</SectionTitle>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((c, i) => (
          <SketchBox key={c.name} tone={c.tone} variant={(["b", "c", "d", "a"] as const)[i]} className="px-4 py-4">
            <p className="font-sketch text-lg font-bold">{c.name}</p>
            <ul className="mt-2 space-y-2">
              {c.items.map((it) => (
                <li key={it} className="flex gap-2 font-hand text-sm leading-snug">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full border-2 border-ink" />
                  {it}
                </li>
              ))}
            </ul>
          </SketchBox>
        ))}
      </div>
      <p className="mt-6 text-center font-sketch text-base font-bold text-ink">
        Stack: Python, FastAPI, PostgreSQL, React PWA with an offline queue, Lyzr agents
      </p>
      <p className="mt-2 text-center font-hand text-sm text-ink-soft">
        Prototype scope: issue, return, settle for one jeweller and three karigars — the dashboard
        you can open above is exactly that prototype.
      </p>
    </section>
  );
}

/* ------------------------------ Why different ------------------------------ */

function Different() {
  const rows: Array<[string, string, string]> = [
    ["Who sees it", "Jeweller only", "Jeweller and karigar, one shared record"],
    ["Data entry", "Typed on a desktop, in English", "Voice and scale photo on a phone, Kannada or Hindi"],
    ["Cost to start", "Rs 6,000 to Rs 60,000 one-time (listed prices)", "Free for karigars. Small monthly fee for jewellers."],
    ["When numbers differ", "Your books against his memory", "Both signed every step, so there is nothing to argue"],
    ["What the karigar gets", "Nothing", "His own account and a verified work record"],
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <SectionTitle>Why Tola is different</SectionTitle>
      <div className="mt-8 grid grid-cols-[0.9fr_1.1fr_1.1fr] border-[2.5px] border-ink bg-white sketch-b paper-shadow">
        <div className="col-span-3 grid grid-cols-[0.9fr_1.1fr_1.1fr] border-b-[2.5px] border-ink bg-[var(--gray-fill)]">
          <div className="px-3 py-2 font-sketch font-bold text-ink text-sm sm:text-base"></div>
          <div className="border-l-2 border-ink px-3 py-2 font-sketch font-bold text-ink-soft text-sm sm:text-base">Jeweller software today</div>
          <div className="border-l-2 border-ink px-3 py-2 font-sketch font-bold text-marker-red text-sm sm:text-base">Tola</div>
        </div>
        {rows.map(([k, a, b], i) => (
          <React.Fragment key={k}>
            <div className={`col-span-3 grid grid-cols-[0.9fr_1.1fr_1.1fr] ${i < rows.length - 1 ? "border-b-2 border-dashed border-ink-soft/50" : ""}`}>
              <div className="px-3 py-2.5 font-sketch font-bold text-ink text-sm sm:text-base">{k}</div>
              <div className="border-l-2 border-ink-soft/40 px-3 py-2.5 font-hand text-sm text-ink-soft sm:text-base">{a}</div>
              <div className="border-l-2 border-ink-soft/40 bg-[var(--green-fill)]/40 px-3 py-2.5 font-hand font-bold text-sm text-ink sm:text-base">{b}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <Takeaway className="mx-auto mt-8 max-w-3xl">
        ERPs keep the jeweller&apos;s books. Tola keeps the record both can sign.
      </Takeaway>
    </section>
  );
}

/* ------------------------------ Impact ------------------------------ */

function Impact() {
  const groups = [
    {
      title: "Karigars",
      tone: "green" as const,
      items: ["His own account, on his own phone", "Paid on a clock, not on mood", "A verified record that travels with him"],
    },
    {
      title: "Jewellers",
      tone: "blue" as const,
      items: ["Every gram has a trail", "Orders on time, fewer disputes", "Wastage records that answer audit questions"],
    },
    {
      title: "Customer",
      tone: "yellow" as const,
      items: ["Wedding piece status in one link", "Early warning, not last-day shock"],
      chip: <DueChip day="12" month="NOV" className="scale-90" />,
    },
    {
      title: "Refiners & the trade",
      tone: "gray" as const,
      items: ["Scrap and recovery logged", "A formal trail for an informal trade"],
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>Impact and benefits</SectionTitle>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g, i) => (
          <SketchBox key={g.title} tone={g.tone} variant={(["a", "b", "c", "d"] as const)[i]} className="px-4 py-4">
            <p className="font-sketch text-lg font-bold text-ink">{g.title}</p>
            {g.chip && <div className="mt-1">{g.chip}</div>}
            <ul className="mt-2 space-y-1.5">
              {g.items.map((it) => (
                <li key={it} className="font-hand text-sm leading-snug text-ink">
                  • {it}
                </li>
              ))}
            </ul>
          </SketchBox>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <SketchBox tone="white" variant="b" className="flex items-center gap-4 px-5 py-4">
          <GoldBar label="PASSPORT" className="h-14 w-28 shrink-0 tola-float" />
          <p className="font-hand text-sm leading-relaxed text-ink-soft sm:text-base">
            <b className="text-ink">Following the money:</b> a karigar with a clean record of
            delivered work is someone a new jeweller, or a lender, can trust. With his consent, he
            shares his Tola record.
          </p>
        </SketchBox>
        <SketchBox tone="yellow" variant="c" className="flex items-center px-5 py-4">
          <p className="font-hand text-sm leading-relaxed text-ink sm:text-base">
            <b className="font-sketch">We will measure:</b> disputes per month · days taken to pay a
            karigar · orders delivered by due date
          </p>
        </SketchBox>
      </div>
    </section>
  );
}

/* ------------------------------ Pricing ------------------------------ */

function Pricing({ onOpenDashboard }: Props) {
  const roadmap = [
    { when: "NOW", body: "Issue, return, settle with voice and photo", tone: "green" as const },
    { when: "NEXT", body: "Refiner link and customer status link", tone: "yellow" as const },
    { when: "THEN", body: "Karigar Passport and partner credit", tone: "blue" as const },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
      <SectionTitle>Business model: free for karigars</SectionTitle>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SketchBox tone="green" variant="a" className="px-6 py-6">
          <div className="flex items-center justify-between">
            <p className="font-sketch text-2xl font-bold text-ink">Karigars</p>
            <p className="font-sketch text-3xl font-bold text-[var(--green-ink)]">FREE</p>
          </div>
          <p className="mt-1 font-sketch font-bold text-[var(--green-ink)]">free, always</p>
          <p className="mt-3 font-hand text-base leading-relaxed text-ink">
            Why free: a karigar works for several jewellers, so each one brings new jewellers.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 border-2 border-ink bg-white px-3 py-1 sketch-c">
            <StickKarigar className="h-8 w-6" mood="happy" />
            <span className="font-sketch text-sm font-bold text-ink">Every karigar is a doorway</span>
          </div>
        </SketchBox>
        <SketchBox tone="white" variant="b" className="px-6 py-6">
          <div className="flex items-center justify-between">
            <p className="font-sketch text-2xl font-bold text-ink">Jewellers</p>
            <p className="font-sketch text-3xl font-bold text-ink">
              ₹499<span className="text-lg"> /month</span>
            </p>
          </div>
          <p className="mt-1 font-sketch font-bold text-ink-soft">proposed · up to 10 karigars</p>
          <p className="mt-3 font-hand text-base leading-relaxed text-ink">
            Later: small UPI payout fee, partner credit for verified karigars.
          </p>
          <p className="mt-4 font-hand text-sm text-ink-soft">
            A year of Tola costs about the same as the cheapest listed jeweller software licence
            (Rs 5,999).
          </p>
        </SketchBox>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {roadmap.map((r, i) => (
          <React.Fragment key={r.when}>
            <SketchBox tone={r.tone} variant={(["a", "b", "c"] as const)[i]} className="px-4 py-4 text-center">
              <p className="font-sketch text-lg font-bold tracking-widest">{r.when}</p>
              <p className="mt-1 font-hand text-sm leading-snug">{r.body}</p>
            </SketchBox>
          </React.Fragment>
        ))}
      </div>

      <Takeaway className="mx-auto mt-10 max-w-3xl">Every gram, one record, two signatures.</Takeaway>
      <div className="mt-8 text-center">
        <SketchButton tone="yellow" onClick={onOpenDashboard}>
          Open the prototype dashboard
        </SketchButton>
      </div>
    </section>
  );
}

/* ------------------------------ Sources ------------------------------ */

function Sources() {
  const items = [
    ["World Gold Council — Jewellery market structure: India (gold.org)", "karigars hand-make about 55% of manufactured jewellery; only 15 to 20% of units are organised."],
    ["ITAT, Sanghi Jewellers (Hyderabad)", "tax officer questioned wastage claimed on estimate, with no day-to-day loss accounts."],
    ["ITAT orders — SCG Exports and Sumatichand Gouti Jewellers", "gold issued to karigars and balances lying with them tracked in spreadsheets."],
    ["West Bengal Authority for Advance Ruling — Aabhushan Jewellers", "wastage allowances of 40 g and 30 g in a job-work chain; GST on job work."],
    ["Art of Jewellery magazine, October 2025", "estimate of nearly five million karigars (trade estimate)."],
    ["IndiaMART listings (GoldBook, Softleaf) and G2 (Online Munim)", "existing jeweller software with karigar modules, listed from Rs 5,999 to Rs 59,999."],
  ];
  return (
    <section id="sources" className="mx-auto max-w-4xl px-4 py-14">
      <SectionTitle>Where the facts come from</SectionTitle>
      <ul className="mt-8 space-y-3">
        {items.map(([src, note], i) => (
          <li key={i} className="flex items-start gap-3">
            <NumDot n={i + 1} />
            <p className="font-hand text-base leading-relaxed text-ink">
              <b>{src}</b> — {note}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-6 font-hand text-sm text-ink-soft">
        Items marked &quot;proposed&quot; (price, pilot) are our design assumptions. No field survey
        is claimed.
      </p>
    </section>
  );
}

/* ------------------------------ Footer ------------------------------ */

function Footer({ onOpenDashboard, onOpenKarigar }: Props) {
  return (
    <footer className="mt-auto border-t-[2.5px] border-ink bg-[var(--paper-deep)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="flex items-center gap-2">
          <GoldBar label="1 TOLA" className="h-8 w-14" />
          <p className="font-sketch text-2xl font-bold text-ink">Tola</p>
        </div>
        <p className="font-hand text-lg text-ink">
          Every gram, one record, <Highlight>two signatures</Highlight>.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <SketchButton tone="yellow" onClick={onOpenDashboard}>
            Jeweller dashboard
          </SketchButton>
          <SketchButton tone="green" onClick={onOpenKarigar}>
            Karigar&apos;s phone
          </SketchButton>
        </div>
        <Kicker className="mt-2">Tech4Bharat 2026 | Problem 2.2: Jeweltech</Kicker>
      </div>
    </footer>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function Landing({ onOpenDashboard, onOpenKarigar }: Props) {
  return (
    <div className="paper-bg flex min-h-screen flex-col font-hand">
      <Nav onOpenDashboard={onOpenDashboard} />
      <main>
        <Hero onOpenDashboard={onOpenDashboard} onOpenKarigar={onOpenKarigar} />
        <Problem />
        <Personas />
        <TodayVsTola />
        <Solution onOpenDashboard={onOpenDashboard} />
        <Agents />
        <SixQuestions />
        <TechStack />
        <Different />
        <Impact />
        <Pricing onOpenDashboard={onOpenDashboard} />
        <Sources />
      </main>
      <Footer onOpenDashboard={onOpenDashboard} onOpenKarigar={onOpenKarigar} />
    </div>
  );
}
