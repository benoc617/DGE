"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiInit } from "@/lib/admin-client-storage";
import { AdminNav } from "@/components/AdminNav";

interface SessionLogRow {
  id: string;
  galaxyName: string;
  createdAt: string;
  turnLogCount: number;
  gameEventCount: number;
  isActive: boolean;
}

export default function MaintenancePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrateOutput, setMigrateOutput] = useState("");
  const [migrateRunning, setMigrateRunning] = useState(false);
  const [purging, setPurging] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const checkMe = useCallback(async () => {
    const res = await fetch("/api/admin/me", { credentials: "include" });
    setAuthed(res.ok);
    return res.ok;
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/logs", adminApiInit());
      if (!res.ok) { setAuthed(false); return; }
      const data = await res.json() as { sessions: SessionLogRow[] };
      setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkMe().then((ok) => { if (ok) void loadSessions(); });
  }, [checkMe, loadSessions]);

  async function handleLogout() {
    await fetch("/api/admin/logout", adminApiInit({ method: "POST" }));
    setAuthed(false);
  }

  async function handlePurge(sessionId: string, force: boolean) {
    setPurging(sessionId);
    setMsg("");
    try {
      const res = await fetch("/api/admin/logs", adminApiInit({
        method: "DELETE",
        body: JSON.stringify({ sessionId, force }),
      }));
      const data = await res.json() as { ok?: boolean; error?: string; turnLogCount?: number; gameEventCount?: number };
      if (!res.ok) {
        setMsg(`Error: ${data.error ?? "purge failed"}`);
      } else {
        setMsg(`Purged: ${data.turnLogCount ?? 0} turn logs + ${data.gameEventCount ?? 0} game events`);
        await loadSessions();
      }
    } finally {
      setPurging(null);
    }
  }

  async function handleMigrate() {
    setMigrateRunning(true);
    setMigrateOutput("Running prisma db push…");
    try {
      const res = await fetch("/api/admin/migrate", adminApiInit({ method: "POST" }));
      const data = await res.json() as { ok?: boolean; stdout?: string; stderr?: string; error?: string };
      const out = [data.ok ? "SUCCESS" : "FAILED", data.stdout, data.stderr, data.error].filter(Boolean).join("\n").trim();
      setMigrateOutput(out || "(no output)");
    } finally {
      setMigrateRunning(false);
    }
  }

  if (authed === null) {
    return (
      <main className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <p className="text-green-700 text-sm">Loading…</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <p className="text-red-500">Not authenticated — <a href="/admin" className="underline">Sign in</a></p>
      </main>
    );
  }

  const totalLogs = sessions.reduce((s, r) => s + r.turnLogCount + r.gameEventCount, 0);

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-4">
      <AdminNav current="maintenance" onRefresh={loadSessions} onLogout={() => void handleLogout()} />

      {/* Schema sync */}
      <div className="border border-green-900 p-4 mb-6">
        <h2 className="text-yellow-600 text-xs tracking-wider mb-2">SCHEMA SYNC</h2>
        <p className="text-green-700 text-xs mb-2">
          Runs <span className="text-green-500">prisma db push --accept-data-loss</span> against the live database.
          Use after deploying schema changes without a full container rebuild.
        </p>
        <button
          type="button"
          disabled={migrateRunning}
          onClick={() => void handleMigrate()}
          className="border border-yellow-700 px-3 py-1.5 text-sm text-yellow-400 hover:bg-yellow-950/30 disabled:opacity-40"
        >
          {migrateRunning ? "RUNNING…" : "SYNC SCHEMA"}
        </button>
        {migrateOutput && (
          <pre className="mt-3 text-xs text-green-600 bg-black border border-green-900 p-2 overflow-auto max-h-48 whitespace-pre-wrap">
            {migrateOutput}
          </pre>
        )}
      </div>

      {/* Log management */}
      <div className="border border-green-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-yellow-600 text-xs tracking-wider">SESSION LOGS</h2>
          <span className="text-green-700 text-xs">{totalLogs} total rows across {sessions.length} sessions</span>
        </div>
        <p className="text-green-700 text-xs mb-3">
          Completed game logs are auto-purged from the DB after the last player finishes — they are emitted as
          <span className="text-green-500"> [srx-gamelog]</span> JSON lines to Docker stdout first. Use PURGE
          to manually clear logs for a completed session. Active sessions require Force.
        </p>
        {msg && <p className="text-yellow-400 text-xs mb-2">{msg}</p>}
        {loading ? (
          <p className="text-green-700 text-xs">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-green-800 text-xs">No sessions found.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-green-600 border-b border-green-900">
                <th className="text-left py-1 pr-3">Galaxy</th>
                <th className="text-left py-1 pr-3">Created</th>
                <th className="text-right py-1 pr-3">TurnLogs</th>
                <th className="text-right py-1 pr-3">Events</th>
                <th className="text-left py-1 pr-3">Status</th>
                <th className="text-left py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr key={row.id} className="border-b border-green-950 hover:bg-green-950/10">
                  <td className="py-1 pr-3 text-green-300">{row.galaxyName}</td>
                  <td className="py-1 pr-3 text-green-600">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="py-1 pr-3 text-right">{row.turnLogCount}</td>
                  <td className="py-1 pr-3 text-right">{row.gameEventCount}</td>
                  <td className="py-1 pr-3">
                    <span className={row.isActive ? "text-yellow-500" : "text-green-700"}>
                      {row.isActive ? "ACTIVE" : "done"}
                    </span>
                  </td>
                  <td className="py-1 flex gap-1.5">
                    {row.turnLogCount + row.gameEventCount === 0 ? (
                      <span className="text-green-800">no logs</span>
                    ) : (
                      <>
                        {!row.isActive && (
                          <button
                            type="button"
                            disabled={purging === row.id}
                            onClick={() => void handlePurge(row.id, false)}
                            className="border border-green-800 px-1.5 py-0.5 text-green-500 hover:border-green-500 disabled:opacity-40"
                          >
                            PURGE
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={purging === row.id}
                          onClick={() => void handlePurge(row.id, true)}
                          className="border border-red-900 px-1.5 py-0.5 text-red-600 hover:border-red-600 disabled:opacity-40"
                        >
                          FORCE
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
