"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { THEME } from "@/lib/ui";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/app/components/TopNav";

type Session = "tokyo" | "london" | "nyc";

type OfficialSessionRow = {
  id: number;
  date: string;
  session: Session;

  wins: number;
  losses: number;
  breakevens: number;

  notes: string | null;

  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIntOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0) return null;
  return i;
}

function fmtShort(ts: string | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function primaryPanel(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
    background:
      "radial-gradient(1000px 400px at 10% 10%, rgba(140,95,255,0.16), rgba(0,0,0,0)), radial-gradient(800px 300px at 90% 10%, rgba(215,177,74,0.14), rgba(0,0,0,0)), rgba(255,255,255,0.03)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
  };
}

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #333",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  background: "rgba(255,255,255,0.12)",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  opacity: 0.9,
};

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "white",
  outline: "none",
  width: "100%",
  fontSize: 16,
};

const compactNumberInputStyle: React.CSSProperties = {
  ...inputStyle,
  textAlign: "center",
  fontWeight: 900,
  fontSize: 20,
  padding: "14px 12px",
};

function sessionChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(215,177,74,0.32)" : "rgba(255,255,255,0.10)"}`,
    background: active
      ? "linear-gradient(135deg, rgba(215,177,74,0.18), rgba(255,255,255,0.06))"
      : "rgba(255,255,255,0.04)",
    color: active ? "#D7B14A" : "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: active ? "0 0 16px rgba(140,95,255,0.14)" : "none",
  };
}

export default function AdminPage() {
  // Auth / debug
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(todayISO());
  const [session, setSession] = useState<Session>("nyc");

  const [wins, setWins] = useState<string>("0");
  const [losses, setLosses] = useState<string>("0");
  const [breakevens, setBreakevens] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [publishingSession, setPublishingSession] = useState(false);
  const [publishingDaily, setPublishingDaily] = useState(false);
  const [publishingWeekly, setPublishingWeekly] = useState(false);
  const [loadedEntry, setLoadedEntry] = useState<OfficialSessionRow | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<OfficialSessionRow[]>([]);

  const [lookupDate, setLookupDate] = useState<string>(todayISO());
  const [lookupSession, setLookupSession] = useState<Session>("nyc");
  const [lookupLoading, setLookupLoading] = useState(false);

  const winsN = useMemo(() => parseIntOrNull(wins), [wins]);
  const lossesN = useMemo(() => parseIntOrNull(losses), [losses]);
  const breakevensN = useMemo(() => parseIntOrNull(breakevens), [breakevens]);

  const winsRef = useRef<HTMLInputElement | null>(null);
  const lossesRef = useRef<HTMLInputElement | null>(null);
  const beRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLInputElement | null>(null);

  // -------------------------
  // Auth bootstrap
  // -------------------------

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSignedIn(!!sess);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
  async function checkAdmin() {
    setCheckingAdmin(true);

    if (!signedIn) {
      setUserId(null);
      setIsAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      setUserId(null);
      setIsAdmin(false);
      setCheckingAdmin(false);
      return;
    }

    setUserId(data.user.id);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileErr) {
      console.error(profileErr);
      setIsAdmin(false);
    } else {
      setIsAdmin(profile?.is_admin === true);
    }

    setCheckingAdmin(false);
  }

  checkAdmin();
}, [signedIn]);

 
  useEffect(() => {
  if (editingId !== null) {
    const t = window.setTimeout(() => {
      winsRef.current?.focus();
      winsRef.current?.select();
    }, 0);

    return () => window.clearTimeout(t);
  }
}, [editingId]);

  async function signIn() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  async function signOut() {
    setError(null);
    await supabase.auth.signOut();
  }

  // -------------------------
  // Data load
  // -------------------------
  async function loadRecent() {
    const { data, error } = await supabase
      .from("official_sessions_admin_view")
      .select("*")
      .order("date", { ascending: false })
      .order("session", { ascending: true })
      .limit(40);

    if (error) {
      setError(error.message);
      return;
    }
    setRecent((data ?? []) as OfficialSessionRow[]);
  }

  useEffect(() => {
  if (!signedIn) return;
  if (!isAdmin) return;
  loadRecent();
}, [signedIn, isAdmin]);

  // -------------------------
  // Helpers
  // -------------------------
  function resetForm() {
    setLoadedEntry(null);
    setEditingId(null);
    setDate(todayISO());
    setSession("nyc");
    setWins("0");
    setLosses("0");
    setBreakevens("0");
    setNotes("");
    setStatus(null);
    setError(null);
  }

  function startEdit(row: OfficialSessionRow) {
    setLoadedEntry(row);
    setEditingId(row.id);
    setDate(row.date);
    setSession(row.session);
    setWins(String(row.wins ?? 0));
    setLosses(String(row.losses ?? 0));
    setBreakevens(String(row.breakevens ?? 0));
    setNotes(row.notes ?? "");
    setStatus(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusLosses() {
  lossesRef.current?.focus();
  lossesRef.current?.select();
}

function focusBreakEvens() {
  beRef.current?.focus();
  beRef.current?.select();
}

function focusNotes() {
  notesRef.current?.focus();
}

function onNumberFieldKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  next: () => void
) {
  if (e.key === "Enter") {
    e.preventDefault();
    next();
  }
}

  async function loadExistingAndEdit(dateISO: string, sess: Session) {
    const { data, error } = await supabase
      .from("official_sessions_admin_view")
      .select("*")
      .eq("date", dateISO)
      .eq("session", sess)
      .maybeSingle();

    if (error) {
      setError(error.message);
      return;
    }
    if (!data) {
      setError("Entry exists but could not load it.");
      return;
    }

    startEdit(data as OfficialSessionRow);
    setStatus("Session already exists — switched to Edit mode ✅");
  }

  async function findEntryByDateAndSession() {
  setStatus(null);
  setError(null);
  setLookupLoading(true);

  try {
    const { data, error } = await supabase
      .from("official_sessions_admin_view")
      .select("*")
      .eq("date", lookupDate)
      .eq("session", lookupSession)
      .maybeSingle();

    if (error) {
      setError(error.message);
      return;
    }

    if (!data) {
      setError(`No official session found for ${lookupDate} (${lookupSession.toUpperCase()}).`);
      return;
    }

    startEdit(data as OfficialSessionRow);
    setStatus(`Loaded ${lookupDate} • ${lookupSession.toUpperCase()} for editing ✅`);
  } finally {
    setLookupLoading(false);
  }
}

  // -------------------------
  // Save / delete
  // -------------------------
  async function save() {
  setStatus(null);
  setError(null);

  if (!date) return setError("Date is required.");
  if (winsN === null) return setError("Wins must be a non-negative whole number.");
  if (lossesN === null) return setError("Losses must be a non-negative whole number.");
  if (breakevensN === null) return setError("Break-evens must be a non-negative whole number.");

  setLoading(true);
  try {
    const payload = {
      date,
      session,
      wins: winsN,
      losses: lossesN,
      breakevens: breakevensN,
      notes: notes.trim() ? notes.trim() : null,
    };

    // Upsert on (date, session) so “Add Session” works for both new and existing
    const { data, error } = await supabase
      .from("official_sessions")
      .upsert(payload, { onConflict: "date,session" })
      .select()
      .maybeSingle();

    if (error) return setError(error.message);
    if (!data) return setError("Upsert failed (unexpected).");

    // Optionally lock into edit mode by keeping the id
    setEditingId(data.id);
    setStatus("Saved ✅");
    await loadRecent();
  } finally {
    setLoading(false);
  }
}

  async function publishSessionToDiscord() {
    setStatus(null);
    setError(null);

    if (!date) return setError("Date is required.");
    if (winsN === null) return setError("Wins must be a non-negative whole number.");
    if (lossesN === null) return setError("Losses must be a non-negative whole number.");
    if (breakevensN === null) return setError("Break-evens must be a non-negative whole number.");

    const ok = window.confirm(
      `Publish ${session.toUpperCase()} session result for ${date} to Discord?`
    );
    if (!ok) return;

    setPublishingSession(true);
    try {
      const { error: discordError } = await supabase.functions.invoke(
        "post-session-result",
        {
          body: {
            date,
            session,
            wins: winsN,
            losses: lossesN,
            breakevens: breakevensN,
            notes: notes.trim() || null,
          },
        }
      );

      if (discordError) {
        setError(`Discord publish failed: ${discordError.message}`);
        return;
      }

      setStatus("Published session to Discord ✅");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discord publish failed.");
    } finally {
      setPublishingSession(false);
    }
  }

  async function publishDailySummaryToDiscord() {
    setStatus(null);
    setError(null);

    if (!date) return setError("Date is required.");

    const ok = window.confirm(`Publish Daily Summary for ${date} to Discord?`);
    if (!ok) return;

    setPublishingDaily(true);
    try {
      const { error: discordError } = await supabase.functions.invoke(
        "post-daily-summary",
        {
          body: { date },
        }
      );

      if (discordError) {
        setError(`Daily summary publish failed: ${discordError.message}`);
        return;
      }

      setStatus("Published daily summary to Discord ✅");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Daily summary publish failed.");
    } finally {
      setPublishingDaily(false);
    }
  }

  async function publishWeeklySummaryToDiscord() {
  setStatus(null);
  setError(null);

  if (!date) return setError("Date is required.");

  const ok = window.confirm(
    `Publish the Weekly Recap for the week containing ${date} to Discord?`
  );

  if (!ok) return;

  setPublishingWeekly(true);

  try {
    const { data, error: discordError } =
      await supabase.functions.invoke("post-weekly-summary", {
        body: {
          date,
        },
      });

    if (discordError) {
      setError(
        `Weekly recap publish failed: ${discordError.message}`
      );
      return;
    }

    console.info("post-weekly-summary:", data);
    setStatus("Published weekly recap to Discord ✅");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Weekly recap publish failed."
    );
  } finally {
    setPublishingWeekly(false);
  }
}

  async function remove(id: number) {
    const ok = window.confirm("Delete this row? This cannot be undone (for now).");
    if (!ok) return;

    setStatus(null);
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.from("official_sessions").delete().eq("id", id).select();

      if (error) return setError(error.message);
      if (!data || data.length === 0) return setError("Delete blocked (RLS).");

      setStatus("Deleted ✅");
      if (editingId === id) resetForm();
      await loadRecent();
    } finally {
      setLoading(false);
    }
  }

  // -------------------------
  // UI
  // -------------------------
if (checkingAdmin) {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1180, margin: "0 auto", color: "white" }}>
      <h1 style={{ color: THEME.gold }}>The Kingdm</h1>
      <p>Checking admin access…</p>
    </main>
  );
}

if (!signedIn) {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1180, margin: "0 auto", color: "white" }}>
      <h1 style={{ color: THEME.gold }}>The Kingdm</h1>
      <h2>Admin Dashboard</h2>
      <p>You must sign in to access this page.</p>

      <button onClick={signIn} style={primaryBtnStyle}>
        Sign in with Discord
      </button>
    </main>
  );
}

if (!isAdmin) {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1180, margin: "0 auto", color: "white" }}>
      <h1 style={{ color: THEME.gold }}>The Kingdm</h1>
      <h2>Access denied</h2>
      <p>You do not have Staff/Admin access.</p>

      <button onClick={signOut} style={smallBtnStyle}>
        Sign out
      </button>
    </main>
  );
}

return (
  <main
    style={{
      padding: 24,
      fontFamily: "system-ui",
      maxWidth: 1180,
      margin: "0 auto",
      color: "white",
    }}
  >      
      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      flexWrap: "wrap",
    }}
  >
    <div>
      <h1 style={{ fontSize: 30, marginBottom: 6, lineHeight: "34px" }}>
        <span style={{ color: "#D7B14A", fontWeight: 900 }}>The Kingdm</span>
        <div style={{ marginTop: 6, opacity: 0.96, fontWeight: 900 }}>
          Admin Dashboard
        </div>
      </h1>

      <p style={{ opacity: 0.75, margin: 0 }}>
        Official sessions editor (admins only)
      </p>
    </div>

    <TopNav currentPath="/admin" />
  </div>

  <div
    style={{
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    {signedIn ? (
      <button onClick={signOut} style={smallBtnStyle}>
        Sign out
      </button>
    ) : (
      <button onClick={signIn} style={primaryBtnStyle}>
        Sign in with Discord
      </button>
    )}

    <button onClick={loadRecent} style={smallBtnStyle} disabled={loading}>
      Refresh
    </button>

    <div style={{ fontSize: 12, opacity: 0.7 }}>
      Auth UID: <code>{userId ?? "not signed in"}</code>
    </div>
  </div>
</div>

<div
  style={{
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
  }}
>
  <div style={{ fontSize: 18, fontWeight: 900, color: "#D7B14A", marginBottom: 6 }}>
    Find Existing Entry
  </div>

  <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 14 }}>
    Load any official session by date and session type.
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "240px auto auto",
      gap: 14,
      alignItems: "end",
      justifyContent: "start",
    }}
  >
    <label style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Date</span>
      <input
        type="date"
        value={lookupDate}
        onChange={(e) => setLookupDate(e.target.value)}
        style={inputStyle}
      />
    </label>

    <div style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Session</span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(["tokyo", "london", "nyc"] as Session[]).map((s) => {
          const active = lookupSession === s;
          const label = s === "nyc" ? "NYC" : s[0].toUpperCase() + s.slice(1);

          return (
            <button
              key={s}
              type="button"
              onClick={() => setLookupSession(s)}
              style={sessionChipStyle(active)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>

    <button
      type="button"
      onClick={findEntryByDateAndSession}
      disabled={lookupLoading}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.10)",
        background: lookupLoading
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, rgba(215,177,74,0.18), rgba(255,255,255,0.08))",
        color: "white",
        cursor: lookupLoading ? "not-allowed" : "pointer",
        fontWeight: 900,
        height: 48,
      }}
    >
      {lookupLoading ? "Loading..." : "Load Entry"}
    </button>
  </div>
</div>
<div style={{ height: 8 }} />

  {loadedEntry && (
  <div
    style={{
      border: "1px solid rgba(215,177,74,0.22)",
      borderRadius: 18,
      padding: 16,
      marginBottom: 18,
      background:
  "linear-gradient(135deg, rgba(215,177,74,0.08), rgba(255,255,255,0.02))",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 14,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 950,
            color: THEME.gold,
            marginBottom: 4,
            
          }}
        >
          Loaded Entry
        </div>

        <div
          style={{
            fontSize: 13,
            opacity: 0.78,
            fontWeight: 800,
          }}
        >
          {loadedEntry.date} • {loadedEntry.session.toUpperCase()} • ID {loadedEntry.id}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={resetForm}
          style={smallBtnStyle}
        >
          Clear Loaded Entry
        </button>

        <button
          type="button"
          onClick={() => remove(loadedEntry.id)}
          style={{
            ...smallBtnStyle,
            border: "1px solid rgba(255,92,92,0.28)",
            background: "rgba(255,92,92,0.12)",
            color: "#fff",
          }}
        >
          Delete Entry
        </button>
      </div>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 12,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>Wins</div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950, color: "#55FF8A", lineHeight: 1 }}>
          {loadedEntry.wins}
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 12,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>Losses</div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950, color: "#ff5c5c", lineHeight: 1 }}>
          {loadedEntry.losses}
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 12,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>Break-evens</div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950, color: THEME.gold, lineHeight: 1 }}>
          {loadedEntry.breakevens}
        </div>
      </div>

      <div
        style={{
          
          borderRadius: 14,
          padding: 12,
          background:
  "linear-gradient(135deg, rgba(215,177,74,0.06), rgba(255,255,255,0.015))",
border: "1px solid rgba(215,177,74,0.18)",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>Last Updated</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 900,
            color: "white",
            lineHeight: 1.25,
          }}
        >
          {fmtShort(loadedEntry.updated_at ?? loadedEntry.created_at) || "—"}
        </div>
      </div>
    </div>

    {loadedEntry.notes && (
      <div
        style={{
          marginTop: 12,
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: 12,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 800, marginBottom: 6 }}>
          Notes
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.92 }}>
          {loadedEntry.notes}
        </div>
      </div>
    )}
  </div>
)}

<div style={{ height: 8 }} />

      <div style={primaryPanel()}>
  <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  }}
>

  <div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 1000,
        color: THEME.gold,
        letterSpacing: 0.5,
      }}
    >
      Add Official Session Results
    </div>

    <div
      style={{
        fontSize: 12,
        opacity: 0.7,
        marginTop: 2,
      }}
    >
      Record the official outcome for each trading session
    </div>

    {editingId !== null && (
  <div
    style={{
      marginTop: 8,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(215,177,74,0.24)",
      background: "rgba(215,177,74,0.10)",
      color: THEME.gold,
      fontSize: 12,
      fontWeight: 950,
      letterSpacing: 0.2,
    }}
  >
    Edit Mode • ID {editingId}
  </div>
)}


  </div>

        <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
  <div
  style={{
    display: "grid",
    gridTemplateColumns: "260px auto",
    gap: 18,
    justifyContent: "center",
    alignItems: "end",
  }}
>
    <label style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Date</span>
      <input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  style={inputStyle}
  onFocus={(e) => {
    e.currentTarget.style.borderColor = "rgba(215,177,74,0.36)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(215,177,74,0.10), 0 0 18px rgba(140,95,255,0.16)";
  }}
  onBlur={(e) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
    e.currentTarget.style.boxShadow = "none";
  }}
/>
    </label>

    <div style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Session</span>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {(["tokyo", "london", "nyc"] as Session[]).map((s) => {
          const active = session === s;
          const label = s === "nyc" ? "NYC" : s[0].toUpperCase() + s.slice(1);

          return (
            <button
              key={s}
              type="button"
              onClick={() => setSession(s)}
              style={sessionChipStyle(active)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  </div>

  <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 160px)",
    gap: 14,
    justifyContent: "center",
    alignItems: "end",
  }}
>
    <label style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Wins</span>
      <input
        ref={winsRef}
        value={wins}
        onChange={(e) => setWins(e.target.value)}
        onKeyDown={(e) => onNumberFieldKeyDown(e, focusLosses)}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        style={compactNumberInputStyle}
        onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(215,177,74,0.36)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(215,177,74,0.10), 0 0 18px rgba(140,95,255,0.16)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
        onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
      />
    </label>

    <label style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Losses</span>
      <input
        ref={lossesRef}
        value={losses}
        onChange={(e) => setLosses(e.target.value)}
        onKeyDown={(e) => onNumberFieldKeyDown(e, focusBreakEvens)}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        style={compactNumberInputStyle}
        onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(215,177,74,0.36)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(215,177,74,0.10), 0 0 18px rgba(140,95,255,0.16)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
        onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
        />
    </label>

    <label style={{ display: "grid", gap: 8 }}>
      <span style={fieldLabelStyle}>Break-evens</span>
      <input
        ref={beRef}
        value={breakevens}
        onChange={(e) => setBreakevens(e.target.value)}
        onKeyDown={(e) => onNumberFieldKeyDown(e, focusNotes)}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        style={compactNumberInputStyle}
        onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(215,177,74,0.36)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(215,177,74,0.10), 0 0 18px rgba(140,95,255,0.16)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
        onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
        />
    </label>
  </div>

  <label style={{ display: "grid", gap: 8 }}>
    <span style={fieldLabelStyle}>Notes (optional)</span>
    <input
        ref={notesRef}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
                void save();
              }
            }}
        placeholder="Optional context for this session"
        style={inputStyle}
        onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(215,177,74,0.36)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(215,177,74,0.10), 0 0 18px rgba(140,95,255,0.16)";
            }}
        onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              e.currentTarget.style.boxShadow = "none";
            }}
      />
  </label>

  <div
  style={{
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  }}
>
  {/* Primary actions for the selected session */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    }}
  >
    <button
      type="button"
      onClick={save}
      disabled={loading}
      style={{
        padding: "11px 16px",
        borderRadius: 12,
        border: "1px solid rgba(215,177,74,0.28)",
        background: loading
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, rgba(215,177,74,0.22), rgba(255,255,255,0.08))",
        color: "white",
        cursor: loading ? "not-allowed" : "pointer",
        fontWeight: 900,
        boxShadow: loading
          ? "none"
          : "0 0 18px rgba(215,177,74,0.10)",
      }}
    >
      {loading
        ? "Saving..."
        : editingId === null
        ? "Add Session"
        : "Save Changes"}
    </button>

    <button
      type="button"
      onClick={publishSessionToDiscord}
      disabled={
        loading ||
        publishingSession ||
        winsN === null ||
        lossesN === null ||
        breakevensN === null
      }
      style={{
        padding: "11px 16px",
        borderRadius: 12,
        border: "1px solid rgba(85,255,138,0.26)",
        background: publishingSession
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, rgba(85,255,138,0.17), rgba(255,255,255,0.05))",
        color: "white",
        cursor:
          loading ||
          publishingSession ||
          winsN === null ||
          lossesN === null ||
          breakevensN === null
            ? "not-allowed"
            : "pointer",
        fontWeight: 900,
      }}
    >
      {publishingSession
        ? "Publishing..."
        : "Publish to Discord"}
    </button>

    {editingId !== null && (
      <button
        type="button"
        onClick={resetForm}
        disabled={loading}
        style={{
          padding: "10px 13px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.035)",
          color: "rgba(255,255,255,0.72)",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 800,
        }}
      >
        Cancel Editing
      </button>
    )}
  </div>

  {/* Summary publishing group */}
  <div
    style={{
      paddingTop: 15,
      borderTop: "1px solid rgba(255,255,255,0.09)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <div
      style={{
        color: THEME.gold,
        fontSize: 13,
        fontWeight: 950,
        letterSpacing: 0.35,
      }}
    >
      Publish Summaries to Discord
    </div>

    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={publishDailySummaryToDiscord}
        disabled={loading || publishingDaily}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(215,177,74,0.25)",
          background: publishingDaily
            ? "rgba(255,255,255,0.06)"
            : "rgba(215,177,74,0.09)",
          color: "white",
          cursor:
            loading || publishingDaily
              ? "not-allowed"
              : "pointer",
          fontWeight: 900,
        }}
      >
        {publishingDaily
          ? "Publishing..."
          : "Daily Summary"}
      </button>

      <button
        type="button"
        onClick={publishWeeklySummaryToDiscord}
        disabled={loading || publishingWeekly}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(170,110,255,0.28)",
          background: publishingWeekly
            ? "rgba(255,255,255,0.06)"
            : "rgba(170,110,255,0.11)",
          color: "white",
          cursor:
            loading || publishingWeekly
              ? "not-allowed"
              : "pointer",
          fontWeight: 900,
        }}
      >
        {publishingWeekly
          ? "Publishing..."
          : "Weekly Summary"}
      </button>

      <button
        type="button"
        disabled
        title="Monthly Summary will be added next."
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(255,255,255,0.025)",
          color: "rgba(255,255,255,0.34)",
          cursor: "not-allowed",
          fontWeight: 900,
        }}
      >
        Monthly Summary
      </button>
    </div>
  </div>

  {error && (
    <div
      style={{
        alignSelf: "flex-start",
        color: "#ff8a8a",
        fontWeight: 900,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,92,92,0.10)",
        border: "1px solid rgba(255,92,92,0.20)",
        boxShadow: "0 0 16px rgba(255,92,92,0.08)",
      }}
    >
      {error}
    </div>
  )}
</div>

  <div style={{ fontSize: 12, opacity: 0.72 }}>
    Note: One row per <b>date + session</b>. Multiple trades are stored using counts (
    <b>wins/losses/breakevens</b>).
  </div>
</div>
      </div>
      </div>
      
      <style jsx global>{`
  @keyframes adminSuccessFlash {
    0% {
      transform: translateY(4px);
      opacity: 0;
      filter: brightness(1.15);
    }
    100% {
      transform: translateY(0);
      opacity: 1;
      filter: brightness(1);
    }
  }
`}</style>

    </main>
  );
}