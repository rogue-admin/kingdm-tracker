"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  role: string | null;
  contributor: boolean | null;
};

const THEME = {
  border: "rgba(255,255,255,0.08)",
  gold: "#D7B14A",
};

function navLinkStyle(active = false): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(215,177,74,0.28)" : THEME.border}`,
    background: active
      ? "linear-gradient(135deg, rgba(215,177,74,0.18), rgba(255,255,255,0.06))"
      : "rgba(255,255,255,0.06)",
    color: active ? THEME.gold : "white",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

export default function TopNav({ currentPath }: { currentPath: string }) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role, contributor")
        .eq("id", user.id)
        .maybeSingle();

      setProfile({
        role: data?.role ?? null,
        contributor: data?.contributor ?? false,
      });

      setLoading(false);
    }

    loadProfile();
  }, []);

  const role = String(profile?.role ?? "");
  const isAdmin = role.toLowerCase() === "admin";
  const isVerifiedMember =
    profile?.contributor === true &&
    (role === "Knight" || role === "Elite Knight" || isAdmin);

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <a href="/leaderboard" style={navLinkStyle(currentPath === "/leaderboard")}>
        Leaderboard
      </a>

      <a href="/public" style={navLinkStyle(currentPath === "/public")}>
        Trade Tracker
      </a>

      {!loading && isVerifiedMember && (
        <a href="/dashboard" style={navLinkStyle(currentPath === "/dashboard")}>
          Dashboard
        </a>
      )}

      {!loading && isAdmin && (
        <a href="/admin" style={navLinkStyle(currentPath === "/admin")}>
          Admin
        </a>
      )}
    </div>
  );
}