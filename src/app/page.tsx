"use client";

import * as React from "react";
import Login from "@/components/tola/login";
import Dashboard from "@/components/tola/dashboard";
import KarigarView from "@/components/tola/karigar-view";
import Landing from "@/components/tola/landing";
import type { StateResponse } from "@/components/tola/types";

type Actor = { role: "jeweller" | "karigar"; karigarId?: string; name: string };
type KarigarOption = { id: string; name: string };

export default function Home() {
  const [actor, setActor] = React.useState<Actor | null>(null);
  const [karigars, setKarigars] = React.useState<KarigarOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showKarigar, setShowKarigar] = React.useState(false);
  const [showLanding, setShowLanding] = React.useState(false);

  // Who am I? The session cookie is the only source of truth.
  const loadMe = React.useCallback(async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await res.json();
    setActor(data.actor ?? null);
    setKarigars(data.karigars ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial session load on mount
    void loadMe();
  }, [loadMe]);

  const logout = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setShowKarigar(false);
    setActor(null);
  }, []);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [actor, showKarigar]);

  if (loading) {
    return (
      <div className="paper-bg flex min-h-screen items-center justify-center font-hand">
        <p className="font-sketch text-xl font-bold text-ink">Opening Tola…</p>
      </div>
    );
  }

  if (!actor) {
    if (showLanding) {
      return <Landing onBack={() => setShowLanding(false)} />;
    }
    return (
      <Login
        karigars={karigars}
        onLoggedIn={loadMe}
        onShowLanding={() => setShowLanding(true)}
      />
    );
  }

  if (actor.role === "jeweller") {
    if (showKarigar) {
      return <KarigarViewWrapper onBack={() => setShowKarigar(false)} onLogout={logout} />;
    }
    return (
      <Dashboard
        onExit={logout}
        onOpenKarigar={() => setShowKarigar(true)}
        onLogout={logout}
      />
    );
  }

  return <KarigarViewWrapper onBack={logout} onLogout={logout} />;
}

/** Karigar view keeps its own lightweight state refresher. */
function KarigarViewWrapper({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const [state, setState] = React.useState<StateResponse | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      onLogout();
      return;
    }
    setState(await res.json());
  }, [onLogout]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial account load on mount
    refresh();
  }, [refresh]);

  if (!state) {
    return (
      <div className="paper-bg flex min-h-screen items-center justify-center font-hand">
        <p className="font-sketch text-xl font-bold text-ink">Opening his account…</p>
      </div>
    );
  }
  return (
    <KarigarView
      state={state}
      onRefresh={refresh}
      onBack={onBack}
      onLogout={onLogout}
    />
  );
}