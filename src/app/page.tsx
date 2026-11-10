"use client";

import * as React from "react";
import Landing from "@/components/tola/landing";
import Dashboard from "@/components/tola/dashboard";
import KarigarView from "@/components/tola/karigar-view";

type View = "landing" | "dashboard" | "karigar";

export default function Home() {
  const [view, setView] = React.useState<View>("landing");

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  if (view === "dashboard") {
    return <Dashboard onExit={() => setView("landing")} onOpenKarigar={() => setView("karigar")} />;
  }
  if (view === "karigar") {
    return <KarigarViewWrapper onBack={() => setView("dashboard")} />;
  }
  return <Landing onOpenDashboard={() => setView("dashboard")} onOpenKarigar={() => setView("karigar")} />;
}

/** Karigar view keeps its own lightweight state refresher. */
function KarigarViewWrapper({ onBack }: { onBack: () => void }) {
  const [state, setState] = React.useState<import("@/components/tola/types").StateResponse | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    setState(await res.json());
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  if (!state) {
    return (
      <div className="paper-bg flex min-h-screen items-center justify-center font-hand">
        <p className="font-sketch text-xl font-bold text-ink">Opening his account…</p>
      </div>
    );
  }
  return <KarigarView state={state} onRefresh={refresh} onBack={onBack} />;
}
