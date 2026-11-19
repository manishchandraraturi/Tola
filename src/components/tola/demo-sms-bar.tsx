"use client";

import { useEffect, useState } from "react";
import { SketchBox, Kicker, WavyRule } from "./sketch";

export function DemoSmsBar() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    channel: string;
    recipient: string;
    actor: string;
    text: string;
    createdAt: Date;
  } | null>>(Array(10).fill(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch(`/api/notifications`, {
          credentials: "include",
        });
        const data = await res.json();
        if (data.ok && data.entries) {
          setNotifications(data.entries.map((e: any) => ({
            id: e.id,
            channel: e.channel,
            recipient: e.recipient,
            actor: e.actor,
            text: e.text,
            createdAt: e.createdAt,
          })));
        }
      } catch (e) {
        console.error("Failed to fetch notifications", e);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-ink-soft">Loading DEMO SMS inbox...</p>;

  return (
    <SketchBox tone="paper" variant="b" style={{ marginBottom: "1rem", padding: "0.75rem" }}>
      <Kicker>DEMO SMS INBOX (simulated — no real SMS sent)</Kicker>
      <WavyRule />
      {notifications
        .filter((n): n is NonNullable<typeof n> => n !== null)
        .reverse()
        .map((n) => (
          <div
            key={n.id}
            style={{
              marginBottom: "0.5rem",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "0.875rem", color: "var(--ink-soft)" }}>
              {n.text}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                marginTop: "0.25rem",
                color: "var(--marker-red)",
              }}
            >
              {new Date(n.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      {notifications.length === 0 && (
        <p className="text-ink-soft small">No OTP messages yet. Open the OTP dialog to receive one.</p>
      )}
    </SketchBox>
  );
}