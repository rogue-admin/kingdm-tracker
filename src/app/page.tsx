"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type OfficialSession = {
  id: number;
  date: string;
  session: "tokyo" | "london" | "nyc";
  result: "win" | "loss" | "breakeven";
  tps: number;
  notes: string | null;
};

export default function Home() {
  const [rows, setRows] = useState<OfficialSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("official_sessions")
        .select("*")
        .order("date", { ascending: false })
        .order("session", { ascending: true })
        .limit(20);

      if (error) {
        setError(error.message);
        return;
      }
      setRows((data ?? []) as OfficialSession[]);
    })();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Kingdom Tracker (Test)</h1>

      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Supabase read test (latest 20 official sessions)
      </p>

      {error && (
        <div style={{ padding: 12, border: "1px solid #f00", marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {rows.length === 0 && !error && (
        <div style={{ opacity: 0.7 }}>
          No rows yet. Add one in Supabase (Table Editor → official_sessions → Insert row)
          and refresh.
        </div>
      )}

      {rows.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: 8 }}>
                Date
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: 8 }}>
                Session
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: 8 }}>
                Result
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: 8 }}>
                TPs
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: 8 }}>
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: "1px solid #222", padding: 8 }}>{r.date}</td>
                <td style={{ borderBottom: "1px solid #222", padding: 8 }}>{r.session}</td>
                <td style={{ borderBottom: "1px solid #222", padding: 8 }}>{r.result}</td>
                <td style={{ borderBottom: "1px solid #222", padding: 8 }}>{r.tps}</td>
                <td style={{ borderBottom: "1px solid #222", padding: 8 }}>{r.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
