"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/app/components/TopNav";
import CountryHeatMap from "@/app/components/CountryHeatMap";
import USStateHeatMap from "@/app/components/USStateHeatMap";
import LiveActivityToast from "@/app/components/LiveActivityToast";

type Timeframe = "today" | "week" | "month" | "year" | "all";
type SessionFilter = "all" | "tokyo" | "london" | "nyc";
type MapRegion = "world" | "north_america" | "united_states";
type TierFilter = "all" | "Elite Knight" | "Knight";
type SortKey = "pnl" | "wins" | "win_rate" | "net_wins";
type TopN = 10 | 25 | 50 | 100;

type LeaderboardRow = {
  user_id: string;
  session?: string;
  display_name: string;
  avatar_url?: string | null;
  member_tier: string;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  net_wins: number;
  win_rate: number | string;
  pnl: number | string;
};

type CountryHeatRow = {
  country: string;
  session?: string;
  traders: number;
  total_pnl: number;
  avg_pnl_per_trader?: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  avg_win_rate: number;
};

type CountryPresenceRow = {
  country: string;
  subscribers: number;
  visible_leaderboard_subscribers: number;
};

type GeoTraderCardRow = {
  user_id: string;
  display_name: string;
  member_tier: string;
  country: string;
  city: string;
  pnl: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  net_wins: number;
  win_rate: number;
};

type GeoCountryCardRow = {
  country: string;
  traders: number;
  pnl: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  net_wins: number;
  win_rate: number;
};

type GeoCityCardRow = {
  country: string;
  city: string;
  traders: number;
  pnl: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  net_wins: number;
  win_rate: number;
};

type LiveActivityRow = {
  id: number;
  user_id: string;
  display_name: string;
  member_tier: string;
  country: string;
  city: string;
  date: string;
  session: string;
  pnl: number;
  outcome: string;
  wins: number;
  losses: number;
  breakevens: number;
};

type USStatePresenceMapRow = {
  state_code: string;
  subscribers: number;
  visible_leaderboard_subscribers: number;
};

type USStateActivityMapRow = {
  state_code: string;
  session?: string;
  traders: number;
  total_pnl: number;
  avg_pnl_per_trader?: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  avg_win_rate: number;
};

const THEME = {
  panel: "rgba(255,255,255,0.03)",
  panel2: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  gold: "#D7B14A",
  goldSoft: "rgba(215,177,74,0.20)",
  purpleSoft: "rgba(140,95,255,0.18)",
  green: "#55FF8A",
  red: "#ff5c5c",
  silver: "#C7CDD8",
  bronze: "#B98154",
};

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function fmtPct(n: number) {
  return `${Number(n).toFixed(1)}%`;
}

function timeframeLabel(tf: Timeframe) {
  if (tf === "today") return "Today";
  if (tf === "week") return "Week";
  if (tf === "month") return "Month";
  if (tf === "year") return "Year";
  return "All-Time";
}

function sessionLabel(session: SessionFilter) {
  if (session === "all") return "All Sessions";
  if (session === "tokyo") return "Tokyo";
  if (session === "london") return "London";
  return "NYC";
}

function minTradesFor(tf: Timeframe) {
  if (tf === "today") return 0;
  if (tf === "week") return 2;
  if (tf === "month") return 1;
  if (tf === "year") return 7;
  return 10;
}

function tierAccent(tier: string) {
  if (tier === "Elite Knight") return THEME.gold;
  if (tier === "Knight") return THEME.silver;
  return "rgba(255,255,255,0.75)";
}

function sortLabel(sortKey: SortKey) {
  if (sortKey === "pnl") return "PnL";
  if (sortKey === "wins") return "Wins";
  if (sortKey === "win_rate") return "Win Rate";
  return "Net Wins";
}

function leaderboardViewForTimeframe(tf: Timeframe) {
  if (tf === "today") return "v_leaderboard_today";
  if (tf === "week") return "v_leaderboard_week";
  if (tf === "month") return "v_leaderboard_month";
  if (tf === "year") return "v_leaderboard_year";
  return "v_leaderboard_all_time";
}

function countryActivityViewForTimeframe(tf: Timeframe) {
  if (tf === "today") return "v_country_activity_today";
  if (tf === "week") return "v_country_activity_week";
  if (tf === "month") return "v_country_activity_month";
  if (tf === "year") return "v_country_activity_year";
  return "v_country_activity_all_time";
}

function geoSnapshotSuffixForTimeframe(tf: Timeframe) {
  if (tf === "today") return "today";
  if (tf === "week") return "week";
  if (tf === "month") return "month";
  if (tf === "year") return "year";
  return "all_time";
}

function mapRegionLabel(region: MapRegion) {
  if (region === "north_america") return "North America";
  if (region === "united_states") return "United States";
  return "World";
}

function activeAreaLabel(region: MapRegion) {
  return region === "united_states" ? "Active States" : "Active Countries";
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const duration = 600;
    const startTime = performance.now();

    function animate(time: number) {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(start + (value - start) * eased);

      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [value]);

  return (
  <span
    style={{
      display: "inline-block",
      animation: "pnlPulse 0.6s ease-out",
    }}
  >
    {fmtMoney(display)}
  </span>
);
}


function representedAreaLabel(region: MapRegion) {
  return region === "united_states" ? "States represented" : "Countries represented";
}

  const NORTH_AMERICA_COUNTRIES = new Set([
  "united states",
  "united states of america",
  "canada",
  "mexico",
  "greenland",
  "bermuda",
  "saint pierre and miquelon",
  "guatemala",
  "belize",
  "el salvador",
  "honduras",
  "nicaragua",
  "costa rica",
  "panama",
  "bahamas",
  "cuba",
  "jamaica",
  "haiti",
  "dominican republic",
  "puerto rico",
  "trinidad and tobago",
  "barbados",
  "antigua and barbuda",
  "dominica",
  "saint kitts and nevis",
  "saint lucia",
  "saint vincent and the grenadines",
  "grenada"
]);

function isNorthAmericaCountry(country: string) {
  return NORTH_AMERICA_COUNTRIES.has(String(country || "").trim().toLowerCase());
}

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const [mapSession, setMapSession] = useState<SessionFilter>("all");
  const [mapRegion, setMapRegion] = useState<MapRegion>("world");

  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [isSnapshotHovered, setIsSnapshotHovered] = useState(false);

  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<number | null>(null);
  const [isDraggingSnapshot, setIsDraggingSnapshot] = useState(false);

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [topN, setTopN] = useState<TopN>(25);

  const [countryHeatRows, setCountryHeatRows] = useState<CountryHeatRow[]>([]);
  const [countryPresenceRows, setCountryPresenceRows] = useState<CountryPresenceRow[]>([]);
  const [countryHeatLoading, setCountryHeatLoading] = useState(false);

  const [usStatePresence, setUsStatePresence] = useState<USStatePresenceMapRow[]>([]);
  const [usStateActivity, setUsStateActivity] = useState<USStateActivityMapRow[]>([]);

  const [topTodayRows, setTopTodayRows] = useState<GeoTraderCardRow[]>([]);
  
  const [topCountryRows, setTopCountryRows] = useState<GeoCountryCardRow[]>([]);
  const [topCityRows, setTopCityRows] = useState<GeoCityCardRow[]>([]);
  const [liveActivityRows, setLiveActivityRows] = useState<LiveActivityRow[]>([]);

  useEffect(() => {
  async function syncDiscordAvatar() {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;

    const metadata = user.user_metadata ?? {};

    const avatarUrl =
      metadata.avatar_url ||
      metadata.picture ||
      null;

    if (!avatarUrl) return;

    await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);
  }

  syncDiscordAvatar();
}, []);

  useEffect(() => {
  async function loadActivity() {
  let query = supabase
    .from("v_public_live_activity_recent")
    .select("*");

  if (mapSession !== "all") {
    query = query.eq("session", mapSession);
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data } = await query
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  setLiveActivityRows(data ?? []);
}

  loadActivity();

  const interval = setInterval(loadActivity, 10000); // refresh every 10s

  return () => clearInterval(interval);
}, [mapSession]);

  const [activityLoading, setActivityLoading] = useState(false);

  const [showSnapshots, setShowSnapshots] = useState(true);
  const [showSummary, setShowSummary] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [showRankings, setShowRankings] = useState(true);
  const [showSmallerSamples, setShowSmallerSamples] = useState(true);

  const minTrades = useMemo(() => minTradesFor(timeframe), [timeframe]);

  const snapshotDragOffset = useMemo(() => {
  if (!isDraggingSnapshot || dragStartX == null || dragCurrentX == null) return 0;
  return dragCurrentX - dragStartX;
}, [isDraggingSnapshot, dragStartX, dragCurrentX]);

const filteredCountryHeatRows = useMemo(() => {
  let source =
    mapSession === "all"
      ? [...countryHeatRows]
      : countryHeatRows.filter(
          (row) => String(row.session ?? "").toLowerCase() === mapSession
        );

  if (mapRegion === "north_america") {
    source = source.filter((row) => isNorthAmericaCountry(row.country));
  }

  const grouped = new Map<string, CountryHeatRow>();

  source.forEach((row) => {
    const key = String(row.country ?? "").trim();
    if (!key) return;

    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...row,
        country: key,
        session: mapSession,
        traders: Number(row.traders ?? 0),
        total_pnl: Number(row.total_pnl ?? 0),
        avg_pnl_per_trader: Number(row.avg_pnl_per_trader ?? 0),
        wins: Number(row.wins ?? 0),
        losses: Number(row.losses ?? 0),
        breakevens: Number(row.breakevens ?? 0),
        total_trades: Number(row.total_trades ?? 0),
        avg_win_rate: Number(row.avg_win_rate ?? 0),
      });
      return;
    }

    const wins = Number(existing.wins ?? 0) + Number(row.wins ?? 0);
    const losses = Number(existing.losses ?? 0) + Number(row.losses ?? 0);
    const breakevens =
      Number(existing.breakevens ?? 0) + Number(row.breakevens ?? 0);
    const totalTrades =
      Number(existing.total_trades ?? 0) + Number(row.total_trades ?? 0);
    const pnl = Number(existing.total_pnl ?? 0) + Number(row.total_pnl ?? 0);
    const traders = Math.max(Number(existing.traders ?? 0), Number(row.traders ?? 0));

    grouped.set(key, {
      ...existing,
      traders,
      total_pnl: pnl,
      avg_pnl_per_trader: traders > 0 ? pnl / traders : 0,
      wins,
      losses,
      breakevens,
      total_trades: totalTrades,
      avg_win_rate:
        wins + losses > 0 ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : 0,
    });
  });

  return Array.from(grouped.values());
}, [countryHeatRows, mapSession, mapRegion]);

const filteredCountryPresenceRows = useMemo(() => {
  if (mapRegion === "world") return countryPresenceRows;
  return countryPresenceRows.filter((row) => isNorthAmericaCountry(row.country));
}, [countryPresenceRows, mapRegion]);

const filteredUsStateActivity = useMemo(() => {
  const source =
    mapSession === "all"
      ? usStateActivity
      : usStateActivity.filter(
          (row) =>
            String(row.session ?? "").toLowerCase() === mapSession
        );

  const grouped = new Map<string, USStateActivityMapRow>();

  source.forEach((row) => {
    const key = String(row.state_code ?? "").toUpperCase();
    if (!key) return;

    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...row,
        state_code: key,
        session: mapSession,
        traders: Number(row.traders ?? 0),
        total_pnl: Number(row.total_pnl ?? 0),
        avg_pnl_per_trader: Number(row.avg_pnl_per_trader ?? 0),
        wins: Number(row.wins ?? 0),
        losses: Number(row.losses ?? 0),
        breakevens: Number(row.breakevens ?? 0),
        total_trades: Number(row.total_trades ?? 0),
        avg_win_rate: Number(row.avg_win_rate ?? 0),
      });
      return;
    }

    const wins = Number(existing.wins ?? 0) + Number(row.wins ?? 0);
    const losses = Number(existing.losses ?? 0) + Number(row.losses ?? 0);
    const breakevens =
      Number(existing.breakevens ?? 0) + Number(row.breakevens ?? 0);
    const totalTrades =
      Number(existing.total_trades ?? 0) + Number(row.total_trades ?? 0);
    const pnl = Number(existing.total_pnl ?? 0) + Number(row.total_pnl ?? 0);
    const traders = Math.max(Number(existing.traders ?? 0), Number(row.traders ?? 0));

    grouped.set(key, {
      ...existing,
      traders,
      total_pnl: pnl,
      avg_pnl_per_trader: traders > 0 ? pnl / traders : 0,
      wins,
      losses,
      breakevens,
      total_trades: totalTrades,
      avg_win_rate:
        wins + losses > 0 ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : 0,
    });
  });

  return Array.from(grouped.values());
}, [usStateActivity, mapSession]);

  const mapStats = useMemo(() => {
  if (mapRegion === "united_states") {
    const activeStates = filteredUsStateActivity.filter(
      (row) => Number(row.total_trades ?? 0) > 0
    ).length;

    const activeEntries = filteredUsStateActivity.reduce(
      (sum, row) => sum + Number(row.total_trades ?? 0),
      0
    );

    const netGlobalPnl = filteredUsStateActivity.reduce(
      (sum, row) => sum + Number(row.total_pnl ?? 0),
      0
    );

    const statesRepresented = usStatePresence.length;

    return {
      activeCountries: activeStates,
      activeEntries,
      netGlobalPnl,
      countriesRepresented: statesRepresented,
    };
  }

  const activeCountries = filteredCountryHeatRows.filter(
    (row) => Number(row.total_trades ?? 0) > 0
  ).length;

  const activeEntries = filteredCountryHeatRows.reduce(
    (sum, row) => sum + Number(row.total_trades ?? 0),
    0
  );

  const netGlobalPnl = filteredCountryHeatRows.reduce(
    (sum, row) => sum + Number(row.total_pnl ?? 0),
    0
  );

  const countriesRepresented = filteredCountryPresenceRows.length;

  return {
    activeCountries,
    activeEntries,
    netGlobalPnl,
    countriesRepresented,
  };
}, [mapRegion, filteredCountryHeatRows, filteredCountryPresenceRows, filteredUsStateActivity, usStatePresence]);

  const loadActivityCards = useCallback(async () => {
  setActivityLoading(true);

  const suffix = geoSnapshotSuffixForTimeframe(timeframe);

  const tradersView = `v_public_geo_top_traders_${suffix}`;
  const countriesView = `v_public_geo_top_countries_${suffix}`;
  const citiesView = `v_public_geo_top_cities_${suffix}`;

  const [tradersRes, countriesRes, citiesRes] = await Promise.all([
  supabase.from(tradersView).select("*").order("pnl", { ascending: false }).limit(5),
  supabase.from(countriesView).select("*").order("pnl", { ascending: false }).limit(5),
  supabase.from(citiesView).select("*").order("pnl", { ascending: false }).limit(5),
]);

  if (tradersRes.error) console.error(tradersRes.error);
  if (countriesRes.error) console.error(countriesRes.error);
  if (citiesRes.error) console.error(citiesRes.error);
  
  const normalizedTraders = ((tradersRes.data ?? []) as GeoTraderCardRow[]).map((r) => ({
    ...r,
    pnl: Number(r.pnl ?? 0),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    breakevens: Number(r.breakevens ?? 0),
    total_trades: Number(r.total_trades ?? 0),
    net_wins: Number(r.net_wins ?? 0),
    win_rate: Number(r.win_rate ?? 0),
  }));

  setTopTodayRows(normalizedTraders);
  
  setTopCountryRows(
    ((countriesRes.data ?? []) as GeoCountryCardRow[]).map((r) => ({
      ...r,
      pnl: Number(r.pnl ?? 0),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      breakevens: Number(r.breakevens ?? 0),
      total_trades: Number(r.total_trades ?? 0),
      traders: Number(r.traders ?? 0),
      net_wins: Number(r.net_wins ?? 0),
      win_rate: Number(r.win_rate ?? 0),
    }))
  );

  setTopCityRows(
    ((citiesRes.data ?? []) as GeoCityCardRow[]).map((r) => ({
      ...r,
      pnl: Number(r.pnl ?? 0),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      breakevens: Number(r.breakevens ?? 0),
      total_trades: Number(r.total_trades ?? 0),
      traders: Number(r.traders ?? 0),
      net_wins: Number(r.net_wins ?? 0),
      win_rate: Number(r.win_rate ?? 0),
    }))
  );

  setActivityLoading(false);
}, [timeframe]);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const viewName = leaderboardViewForTimeframe(timeframe);

    const { data, error } = await supabase.from(viewName).select("*");

    if (error) {
      console.error(error);
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as LeaderboardRow[]).map((r) => ({
      ...r,
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      breakevens: Number(r.breakevens ?? 0),
      total_trades: Number(r.total_trades ?? 0),
      net_wins: Number(r.net_wins ?? 0),
      win_rate: Number(r.win_rate ?? 0),
      pnl: Number(r.pnl ?? 0),
    }));

    setRows(normalized);
    setLoading(false);
  }, [timeframe]);

  const loadCountryHeatMap = useCallback(async () => {
    setCountryHeatLoading(true);

    const activityView = countryActivityViewForTimeframe(timeframe);
    let usActivityView = "v_us_state_activity_all_time";

if (timeframe === "today") usActivityView = "v_us_state_activity_today";
if (timeframe === "week") usActivityView = "v_us_state_activity_week";
if (timeframe === "month") usActivityView = "v_us_state_activity_month";
if (timeframe === "year") usActivityView = "v_us_state_activity_year";

    const [performanceRes, presenceRes, usPresenceRes, usActivityRes] = await Promise.all([
  supabase.from(activityView).select("*"),
  supabase.from("v_country_presence").select("*"),
  supabase.from("v_us_state_presence").select("*"),
  supabase.from(usActivityView).select("*"),
]);

    if (performanceRes.error) {
      console.error(performanceRes.error);
      setCountryHeatRows([]);
    } else {
      const normalizedPerformance = ((performanceRes.data ?? []) as CountryHeatRow[]).map((r) => ({
        country: String(r.country ?? ""),
        session: String(r.session ?? "all").toLowerCase(),
        traders: Number(r.traders ?? 0),
        total_pnl: Number(r.total_pnl ?? 0),
        avg_pnl_per_trader: Number(r.avg_pnl_per_trader ?? 0),
        wins: Number(r.wins ?? 0),
        losses: Number(r.losses ?? 0),
        breakevens: Number(r.breakevens ?? 0),
        total_trades: Number(r.total_trades ?? 0),
        avg_win_rate: Number(r.avg_win_rate ?? 0),
      }));
      setCountryHeatRows(normalizedPerformance);
    }

    if (presenceRes.error) {
      console.error(presenceRes.error);
      setCountryPresenceRows([]);
    } else {
      const normalizedPresence = ((presenceRes.data ?? []) as CountryPresenceRow[]).map((r) => ({
        country: String(r.country ?? ""),
        subscribers: Number(r.subscribers ?? 0),
        visible_leaderboard_subscribers: Number(
          r.visible_leaderboard_subscribers ?? 0
        ),
      }));
      setCountryPresenceRows(normalizedPresence);
    }

    if (usPresenceRes.error) {
  console.error(usPresenceRes.error);
  setUsStatePresence([]);
} else {
  setUsStatePresence(
    ((usPresenceRes.data ?? []) as USStatePresenceMapRow[]).map((r) => ({
      state_code: String(r.state_code ?? ""),
      subscribers: Number(r.subscribers ?? 0),
      visible_leaderboard_subscribers: Number(r.visible_leaderboard_subscribers ?? 0),
    }))
  );
}

if (usActivityRes.error) {
  console.error(usActivityRes.error);
  setUsStateActivity([]);
} else {
  setUsStateActivity(
    ((usActivityRes.data ?? []) as USStateActivityMapRow[]).map((r) => ({
  state_code: String(r.state_code ?? ""),
  session: String(r.session ?? "all").toLowerCase(),
  traders: Number(r.traders ?? 0),
  total_pnl: Number(r.total_pnl ?? 0),
  avg_pnl_per_trader: Number(r.avg_pnl_per_trader ?? 0),
  wins: Number(r.wins ?? 0),
  losses: Number(r.losses ?? 0),
  breakevens: Number(r.breakevens ?? 0),
  total_trades: Number(r.total_trades ?? 0),
  avg_win_rate: Number(r.avg_win_rate ?? 0),
}))
  );
}

    setCountryHeatLoading(false);
  }, [timeframe]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
  loadLeaderboard();
  loadCountryHeatMap();
  loadActivityCards();
}, [loadLeaderboard, loadCountryHeatMap, loadActivityCards]);

  const visibleRows = useMemo(() => {
    let filtered = [...rows];

  if (tierFilter !== "all") {
    filtered = filtered.filter((r) => r.member_tier === tierFilter);
  }

  filtered.sort((a, b) => {
    if (sortKey === "pnl") {
      if (Number(b.pnl) !== Number(a.pnl)) return Number(b.pnl) - Number(a.pnl);
      if (b.net_wins !== a.net_wins) return b.net_wins - a.net_wins;
      if (Number(b.win_rate) !== Number(a.win_rate)) {
        return Number(b.win_rate) - Number(a.win_rate);
      }
      if (b.total_trades !== a.total_trades) return b.total_trades - a.total_trades;
      return a.display_name.localeCompare(b.display_name);
    }

    if (sortKey === "wins") {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (Number(b.pnl) !== Number(a.pnl)) return Number(b.pnl) - Number(a.pnl);
      if (Number(b.win_rate) !== Number(a.win_rate)) {
        return Number(b.win_rate) - Number(a.win_rate);
      }
      return a.display_name.localeCompare(b.display_name);
    }

    if (sortKey === "win_rate") {
      if (Number(b.win_rate) !== Number(a.win_rate)) {
        return Number(b.win_rate) - Number(a.win_rate);
      }
      if (Number(b.pnl) !== Number(a.pnl)) return Number(b.pnl) - Number(a.pnl);
      if (b.total_trades !== a.total_trades) return b.total_trades - a.total_trades;
      return a.display_name.localeCompare(b.display_name);
    }

    if (b.net_wins !== a.net_wins) return b.net_wins - a.net_wins;
    if (Number(b.pnl) !== Number(a.pnl)) return Number(b.pnl) - Number(a.pnl);
    if (Number(b.win_rate) !== Number(a.win_rate)) {
      return Number(b.win_rate) - Number(a.win_rate);
    }
    return a.display_name.localeCompare(b.display_name);
  });

  return filtered;
}, [rows, mapSession, tierFilter, sortKey]);

  const rankedRows = useMemo(
    () => visibleRows.filter((r) => Number(r.total_trades) >= minTrades).slice(0, topN),
    [visibleRows, minTrades, topN]
  );

  const smallerSampleRows = useMemo(
    () => visibleRows.filter((r) => Number(r.total_trades) < minTrades).slice(0, topN),
    [visibleRows, minTrades, topN]
  );

  const podium = useMemo(() => rankedRows.slice(0, 3), [rankedRows]);

  const snapshotCards = useMemo(
    () => [
      {
        key: "traders",
        title: `Top 5 Traders • ${timeframeLabel(timeframe)}`,
        subtitle: `${timeframeLabel(timeframe)} top performers`,
        rows: rankedRows.slice(0, 5).map((r) => ({
        primary: r.display_name,
        secondary: r.member_tier || "Member",
        avatar_url: r.avatar_url,
        meta: r.member_tier || "Member",
        value: fmtMoney(Number(r.pnl)),
        positive: Number(r.pnl) >= 0,
        wins: r.wins,
        losses: r.losses,
        breakevens: r.breakevens,
        total_trades: r.total_trades,
        win_rate: Number(r.win_rate),
        pnl: Number(r.pnl),
      })),
        empty: `No trader activity for ${timeframeLabel(timeframe).toLowerCase()}.`,
      },
      {
        key: "countries",
        title: `Top 5 Countries • ${timeframeLabel(timeframe)}`,
        subtitle: `${timeframeLabel(timeframe)} country performance`,
        rows: topCountryRows.map((r) => ({
          primary: r.country,
          secondary: "",
          meta: `${r.total_trades} submissions`,
          value: fmtMoney(r.pnl),
          positive: r.pnl >= 0,
          wins: r.wins,
          losses: r.losses,
          breakevens: r.breakevens,
          total_trades: r.total_trades,
          win_rate: r.win_rate,
          pnl: r.pnl,
        })),
        empty: `No country activity for ${timeframeLabel(timeframe).toLowerCase()}.`,
      },
      {
        key: "cities",
        title: `Top 5 Cities • ${timeframeLabel(timeframe)}`,
        subtitle: `${timeframeLabel(timeframe)} city performance`,
        rows: topCityRows.map((r) => ({
          primary: r.city,
          secondary: r.country,
          meta: `${r.traders} active member${r.traders === 1 ? "" : "s"}`,
          value: fmtMoney(r.pnl),
          positive: r.pnl >= 0,
          wins: r.wins,
          losses: r.losses,
          breakevens: r.breakevens,
          total_trades: r.total_trades,
          win_rate: r.win_rate,
          pnl: r.pnl,
        })),
        empty: `No city activity for ${timeframeLabel(timeframe).toLowerCase()}.`,
      },
    ],
    [timeframe, rankedRows, topCountryRows, topCityRows]
  );

const SNAPSHOT_VISIBLE_CARDS = 1;
const maxSnapshotIndex = Math.max(0, snapshotCards.length - SNAPSHOT_VISIBLE_CARDS);

function goSnapshotPrev() {
  setSnapshotIndex((prev) => Math.max(0, prev - 1));
}

function goSnapshotNext() {
  setSnapshotIndex((prev) => Math.min(maxSnapshotIndex, prev + 1));
}

function startSnapshotDrag(clientX: number) {
  setIsDraggingSnapshot(true);
  setDragStartX(clientX);
  setDragCurrentX(clientX);
}

function moveSnapshotDrag(clientX: number) {
  if (!isDraggingSnapshot) return;
  setDragCurrentX(clientX);
}

function endSnapshotDrag() {
  if (!isDraggingSnapshot || dragStartX == null || dragCurrentX == null) {
    setIsDraggingSnapshot(false);
    setDragStartX(null);
    setDragCurrentX(null);
    return;
  }

  const deltaX = dragCurrentX - dragStartX;
  const swipeThreshold = 60;

  if (deltaX <= -swipeThreshold) {
    setSnapshotIndex((prev) => Math.min(maxSnapshotIndex, prev + 1));
  } else if (deltaX >= swipeThreshold) {
    setSnapshotIndex((prev) => Math.max(0, prev - 1));
  }

  setIsDraggingSnapshot(false);
  setDragStartX(null);
  setDragCurrentX(null);
}

  useEffect(() => {
  if (isSnapshotHovered) return;

  const interval = setInterval(() => {
    setSnapshotIndex((prev) => {
      if (prev >= maxSnapshotIndex) {
  return 0; // later we can animate reverse if you want
}
      return prev + 1;
    });
  }, 4000);

  return () => clearInterval(interval);
}, [isSnapshotHovered, maxSnapshotIndex]);

  const snapshotsAreEmpty =
    topTodayRows.length === 0 &&
    topCountryRows.length === 0 &&
    topCityRows.length === 0;

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 1180,
        margin: "0 auto",
        color: "white",
        overflowX: "hidden",
      }}
    >
      <style jsx global>{`
  @keyframes pnlPulse {
    0% {
      transform: scale(1);
      filter: brightness(1);
    }
    40% {
      transform: scale(1.08);
      filter: brightness(1.6);
    }
    100% {
      transform: scale(1);
      filter: brightness(1);
    }
  }
`}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 6, lineHeight: "36px" }}>
            <span style={{ color: THEME.gold, fontWeight: 900 }}>The Kingdm</span>
            <div style={{ marginTop: 6, opacity: 0.96, fontWeight: 900 }}>
              Leaderboard
            </div>
          </h1>
          <p style={{ opacity: 0.75, marginBottom: 0 }}>
            Ranked performance across the community.
          </p>
        </div>

        <TopNav currentPath="/leaderboard" />
      </div>

      <div style={{ height: 18 }} />

      <div style={panel()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(["today", "week", "month", "year", "all"] as Timeframe[]).map((tf) => {
              const active = tf === timeframe;
              return (
                <button
                  key={tf}
                  onClick={() => {
                    setTimeframe(tf);
                    setSnapshotIndex(0);
                  }}
                  style={tabBtn(active)}
                >
                  {timeframeLabel(tf)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(180px, 220px))",
            gap: 12,
          }}
        >
          <CustomSelect<TierFilter>
            label="Tier"
            value={tierFilter}
            onChange={setTierFilter}
            options={[
              { value: "all", label: "All" },
              { value: "Elite Knight", label: "Elite Knight" },
              { value: "Knight", label: "Knight" },
            ]}
          />

          <CustomSelect<SortKey>
            label="Sort By"
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: "pnl", label: "PnL" },
              { value: "wins", label: "Wins" },
              { value: "win_rate", label: "Positive Rate" },
              { value: "net_wins", label: "Net Wins" },
            ]}
          />

          <CustomSelect<TopN>
            label="Show"
            value={topN}
            onChange={setTopN}
            options={[
              { value: 10, label: "Top 10" },
              { value: 25, label: "Top 25" },
              { value: 50, label: "Top 50" },
              { value: 100, label: "Top 100" },
            ]}
          />
        </div>
      </div>

      <div style={{ height: 16 }} />

      {error && (
        <>
          <div style={{ ...panel(), color: THEME.red }}>
            Failed to load leaderboard: {error}
          </div>
          <div style={{ height: 16 }} />
        </>
      )}

      <SectionPanel
        title="Snapshot Cards"
        subtitle="Quick community highlights"
        isOpen={showSnapshots}
        onToggle={() => setShowSnapshots((v) => !v)}
      >
        {snapshotsAreEmpty ? (
          <div style={emptySectionStyle()}>
            No community performance recorded yet — your trade could be the first to lead.
          </div>
        ) : (
          <div>
            
  <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginBottom: 0,
  }}
>
  <button
  type="button"
  onClick={goSnapshotPrev}
  disabled={snapshotIndex === 0}
  style={iconBtn(snapshotIndex === 0)}
  onMouseEnter={(e) => {
    if (snapshotIndex !== 0) {
      e.currentTarget.style.background = "rgba(255,255,255,0.10)";
    }
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background =
      snapshotIndex === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)";
  }}
>
    ←
  </button>

  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 90,
    justifyContent: "center",
  }}
>
  {Array.from({ length: maxSnapshotIndex + 1 }).map((_, idx) => {
    const active = idx === snapshotIndex;
    return (
      <button
        key={idx}
        type="button"
        onClick={() => setSnapshotIndex(idx)}
        aria-label={`Go to snapshot page ${idx + 1}`}
        style={{
          width: active ? 18 : 8,
          height: 8,
          borderRadius: 999,
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: active ? THEME.gold : "rgba(255,255,255,0.22)",
          transition: "all 200ms ease",
          boxShadow: active ? `0 0 12px ${THEME.goldSoft}` : "none",
          transform: active ? "scale(1.1)" : "scale(1)",
        }}
      />
    );
  })}
  <span
  style={{
    fontSize: 11,
    opacity: 0.58,
    color: THEME.gold,
    fontWeight: 700,
    letterSpacing: "0.02em",
  }}
>
  Auto
</span>
</div>

  <button
  type="button"
  onClick={goSnapshotNext}
  disabled={snapshotIndex === maxSnapshotIndex}
  style={iconBtn(snapshotIndex === maxSnapshotIndex)}
  onMouseEnter={(e) => {
    if (snapshotIndex !== maxSnapshotIndex) {
      e.currentTarget.style.background = "rgba(255,255,255,0.10)";
    }
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background =
      snapshotIndex === maxSnapshotIndex
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.06)";
  }}
>
  →
</button>
</div>

  <div
  style={{
    overflow: "hidden",
    padding: "0px 4px 0px 4px",
    cursor: isDraggingSnapshot ? "grabbing" : "grab",
    userSelect: "none",
  }}
  onMouseEnter={() => setIsSnapshotHovered(true)}
  onMouseLeave={() => {
    setIsSnapshotHovered(false);
    if (isDraggingSnapshot) endSnapshotDrag();
  }}
  onMouseDown={(e) => startSnapshotDrag(e.clientX)}
  onMouseMove={(e) => moveSnapshotDrag(e.clientX)}
  onMouseUp={endSnapshotDrag}
  onTouchStart={(e) => startSnapshotDrag(e.touches[0].clientX)}
  onTouchMove={(e) => moveSnapshotDrag(e.touches[0].clientX)}
  onTouchEnd={endSnapshotDrag}
>
    <div
      style={{
        display: "flex",
        gap: 16,
        transform: `translateX(calc(${snapshotIndex} * -74% - ${snapshotIndex * 16}px + ${snapshotDragOffset}px))`,
        transition: isDraggingSnapshot
          ? "none"
          : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
        touchAction: "pan-y",
      }}
    >
      {snapshotCards.map((card, idx) => (
  <div
    key={card.key}
    style={{
      minWidth: "74%",
      flex: "0 0 74%",
      maxWidth: 1000,
      margin: "0",
      opacity: idx === snapshotIndex ? 1 : 0.88,
      zIndex: idx === snapshotIndex ? 2 : 1,
      filter: idx === snapshotIndex ? "none" : "brightness(0.9)",
      transform: idx === snapshotIndex ? "scale(1)" : "scale(0.985)",
      transition: "opacity 220ms ease, transform 220ms ease",
    }}
  >
    
          <MiniLeaderboardCard
            title={card.title}
            subtitle={card.subtitle}
            rows={card.rows}
            loading={activityLoading}
            empty={card.empty}
          />
          
        </div>
      ))}
    </div>
  </div>
          </div>
        )}
      </SectionPanel>

      <div style={{ height: 16 }} />

      <SectionPanel
        title="Summary"
        subtitle="Current map and timeframe metrics"
        isOpen={showSummary}
        onToggle={() => setShowSummary((v) => !v)}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <StatSummaryCard
            label={activeAreaLabel(mapRegion)}
            value={mapStats.activeCountries}
            subtitle={`${timeframeLabel(timeframe)} • ${sessionLabel(mapSession)} • ${mapRegionLabel(mapRegion)}`}
          />

          <StatSummaryCard
            label="Active Submissions"
            value={mapStats.activeEntries}
            subtitle={`${timeframeLabel(timeframe)} • ${sessionLabel(mapSession)} • ${mapRegionLabel(mapRegion)}`}
          />

          <MoneySummaryCard
            label="Net Global PnL"
            value={mapStats.netGlobalPnl}
            subtitle={`${timeframeLabel(timeframe)} • ${sessionLabel(mapSession)} • ${mapRegionLabel(mapRegion)}`}
          />

          <InfoSummaryCard
            label="Opt-In Data"
            subtitle="All data shown is voluntarily submitted by participating Kingdm members and does not represent total community performance."
          />
        </div>
      </SectionPanel>

      <div style={{ height: 16 }} />

    <div id="global-activity-section">
      <SectionPanel
        title="Kingdm Global Activity"
        subtitle="Opt-in member presence plus timeframe performance across the community"
        rightContent={
         <div style={{ fontSize: 12, opacity: 0.75 }}>
          {representedAreaLabel(mapRegion)}: {mapStats.countriesRepresented}
          </div>
        }
        isOpen={showMap}
        onToggle={() => setShowMap((v) => !v)}
      >
        <div
  style={{
    marginBottom: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  }}
>
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    {(["world", "united_states"] as MapRegion[]).map((region) => {
      const active = region === mapRegion;
      return (
        <button
          key={region}
          type="button"
          onClick={() => setMapRegion(region)}
          style={tabBtn(active)}
        >
          {mapRegionLabel(region)}
        </button>
      );
    })}
  </div>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    {(["all", "tokyo", "london", "nyc"] as SessionFilter[]).map((session) => {
      const active = session === mapSession;
      return (
        <button
          key={session}
          type="button"
          onClick={() => setMapSession(session)}
          style={tabBtn(active)}
        >
          {sessionLabel(session)}
        </button>
      );
    })}
  </div>
</div>

        {countryHeatLoading ? (
  <div style={{ opacity: 0.75 }}>
  Loading {mapRegion === "united_states" ? "US state" : mapRegion === "north_america" ? "North America" : "world"} activity…
</div>
) : mapRegion === "united_states" ? (
  <USStateHeatMap
    presenceRows={usStatePresence}
    performanceRows={filteredUsStateActivity}
  />
) : (
  <CountryHeatMap
    rows={filteredCountryHeatRows}
    presenceRows={filteredCountryPresenceRows}
    region={mapRegion}
  />
)}
      </SectionPanel>
    </div>
      <div style={{ height: 16 }} />

    <div id="rankings-section">
      <SectionPanel
        title={`${timeframeLabel(timeframe)} Rankings`}
        subtitle={`Showing ${rankedRows.length} of up to ${topN} • Sorted by ${sortLabel(sortKey)}`}
        isOpen={showRankings}
        onToggle={() => setShowRankings((v) => !v)}
      >
        {loading ? (
          <div style={emptySectionStyle()}>Loading leaderboard…</div>
        ) : (
          <>
            {podium.length > 0 && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: podium.length === 1 ? "1fr" : "repeat(3, 1fr)",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {podium.map((row, idx) => (
                    <PodiumCard key={`podium-${row.user_id}-${idx}`} row={row} place={idx + 1} />
                  ))}
                </div>
              </>
            )}

            {rankedRows.length === 0 ? (
              <div style={emptySectionStyle()}>
                No entries logged for this timeframe yet — be the first to make the leaderboard.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    borderCollapse: "separate",
borderSpacing: "0 6px",
                    width: "100%",
                    minWidth: 980,
                    tableLayout: "fixed",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ ...th(), width: 60 }}>#</th>
                      <th style={{ ...th(), width: 220 }}>Trader</th>
                      <th style={{ ...th(), width: 130 }}>Role</th>
                      <th style={{ ...th(), width: 130 }}>PnL</th>
                      <th style={{ ...th(), width: 70 }}>W</th>
                      <th style={{ ...th(), width: 70 }}>L</th>
                      <th style={{ ...th(), width: 70 }}>BE</th>
                      <th style={{ ...th(), width: 90 }}>Entries</th>
                      <th style={{ ...th(), width: 110 }}>Win Rate</th>
                      <th style={{ ...th(), width: 90 }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRows.map((row, idx) => {
                      const pnl = Number(row.pnl);
                      return (
                        <tr
                          key={`ranked-${row.user_id}-${idx}`}
                            style={leaderboardRowStyle(idx + 1)}
                              onMouseEnter={(e) => {
                                Object.assign(e.currentTarget.style, leaderboardRowHoverStyle(idx + 1));
                                }}
                              onMouseLeave={(e) => {
                                Object.assign(e.currentTarget.style, leaderboardRowStyle(idx + 1));
                                }}
                          >
                          <td style={tdRank(idx + 1)}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 48,
                                height: 36,
                                gap: 6,
                                fontVariantNumeric: "tabular-nums",
                                padding: "0 9px",
                                borderRadius: 999,
                                border: `1px solid ${idx < 3 ? "rgba(215,177,74,0.30)" : THEME.border}`,
                                background:
                                  idx === 0
                                    ? "rgba(215,177,74,0.16)"
                                  : idx === 1
                                    ? "rgba(199,205,216,0.10)"
                                  : idx === 2
                                    ? "rgba(185,129,84,0.12)"
                                  : "rgba(255,255,255,0.035)",
                                color:
                                  idx === 0
                                    ? THEME.gold
                                  : idx === 1
                                    ? THEME.silver
                                  : idx === 2
                                    ? THEME.bronze
                                  : "rgba(255,255,255,0.76)",
                                fontSize: 12,
                                fontWeight: 950,
                                lineHeight: 1,
                                textShadow:
                                  idx === 0
                                    ? "0 0 10px rgba(215,177,74,0.24)"
                                  : idx === 1
                                    ? "0 0 8px rgba(199,205,216,0.16)"
                                  : idx === 2
                                    ? "0 0 8px rgba(185,129,84,0.16)"
                                  : "none",
                                  }}
                            >
                              {rankBadge(idx + 1)}
                              {idx + 1}
                            </span>
                          </td>
                          <td style={td()}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <AvatarBadge
                                name={row.display_name}
                                avatarUrl={row.avatar_url}
                                size={36}
                            />

                            <div>
                              <div style={{ fontWeight: 950 }}>{row.display_name}</div>
                                <div style={{ fontSize: 11, opacity: 0.6 }}>
                                  {row.member_tier}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={td()}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "4px 8px",
                                borderRadius: 999,
                                border: `1px solid ${THEME.border}`,
                                background: "rgba(255,255,255,0.04)",
                                color: tierAccent(row.member_tier),
                                fontSize: 12,
                                fontWeight: 700,
                                opacity: 0.75,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.member_tier}
                            </span>
                          </td>
                          <td
                            style={{
                              ...td(),
                              color: pnl > 0 ? THEME.green : pnl < 0 ? THEME.red : "inherit",
                              fontWeight: 900,
                            }}
                          >
                            {fmtMoney(pnl)}
                          </td>
                          <td style={td()}>{row.wins}</td>
                          <td style={td()}>{row.losses}</td>
                          <td style={td()}>{row.breakevens}</td>
                          <td style={td()}>{row.total_trades}</td>
                          <td style={td()}>{fmtPct(Number(row.win_rate))}</td>
                          <td style={td()}>{row.net_wins}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </SectionPanel>
      </div>

      {smallerSampleRows.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <SectionPanel
            title="Smaller Sample Sizes"
            subtitle="These members are visible, but comparisons are less meaningful with fewer submitted entries in this timeframe."
            isOpen={showSmallerSamples}
            onToggle={() => setShowSmallerSamples((v) => !v)}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  minWidth: 760,
                  tableLayout: "fixed",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ ...th(), width: 220 }}>Trader</th>
                    <th style={{ ...th(), width: 130 }}>Role</th>
                    <th style={{ ...th(), width: 130 }}>PnL</th>
                    <th style={{ ...th(), width: 90 }}>Entries</th>
                    <th style={{ ...th(), width: 110 }}>Win Rate</th>
                    <th style={{ ...th(), width: 90 }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {smallerSampleRows.map((row, idx) => {
                    const pnl = Number(row.pnl);
                    return (
                      <tr
                        key={`sample-${row.user_id}-${idx}`}
                          style={leaderboardRowStyle(idx + 1)}
                            onMouseEnter={(e) => {
                              Object.assign(e.currentTarget.style, leaderboardRowHoverStyle(idx + 1));
                              }}
                            onMouseLeave={(e) => {
                              Object.assign(e.currentTarget.style, leaderboardRowStyle(idx + 1));
                              }}
                      >
                        <td style={td()}>{row.display_name}</td>
                        <td style={td()}>{row.member_tier}</td>
                        <td
                          style={{
                            ...td(),
                            color: pnl > 0 ? THEME.green : pnl < 0 ? THEME.red : "inherit",
                            fontWeight: 900,
                          }}
                        >
                          {fmtMoney(pnl)}
                        </td>
                        <td style={td()}>{row.total_trades}</td>
                        <td style={td()}>{fmtPct(Number(row.win_rate))}</td>
                        <td style={td()}>{row.net_wins}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>
        </>
      )}
      {liveActivityRows.length > 0 ? (
      <LiveActivityToast rows={liveActivityRows} />
) : null}
    </main>
  );
}

function SectionPanel({
  title,
  subtitle,
  isOpen,
  onToggle,
  rightContent,
  children,
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
  <div
    style={{
      ...panel(),
      padding: title === "Snapshot Cards" ? 12 : 16,
    }}
  >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: title === "Snapshot Cards" && isOpen ? 6 : isOpen ? 12 : 0,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 13, opacity: 0.72, marginTop: 4 }}>{subtitle}</div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {rightContent}
          <button type="button" onClick={onToggle} style={sectionToggleBtn()}>
            {isOpen ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {isOpen ? children : null}
    </div>
  );
}

function PodiumCard({
  row,
  place,
}: {
  row: LeaderboardRow;
  place: number;
}) {
  const pnl = Number(row.pnl);
  const accent = place === 1 ? THEME.gold : place === 2 ? THEME.silver : THEME.bronze;
  const medal = place === 1 ? "🏆" : place === 2 ? "🥈" : "🥉";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${accent}55`,
        borderRadius: 22,
        padding: 16,
        background: `
          radial-gradient(520px 220px at 18% 0%, ${accent}22, rgba(0,0,0,0)),
          radial-gradient(520px 220px at 90% 0%, rgba(140,95,255,0.14), rgba(0,0,0,0)),
          linear-gradient(155deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)),
          rgba(10,10,14,0.92)
        `,
        boxShadow:
          place === 1
            ? "0 0 34px rgba(215,177,74,0.18), inset 0 0 0 1px rgba(255,255,255,0.03)"
            : "0 18px 38px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.025)",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          place === 1
            ? "0 22px 55px rgba(0,0,0,0.42), 0 0 34px rgba(215,177,74,0.26), inset 0 0 0 1px rgba(255,255,255,0.035)"
            : `0 22px 55px rgba(0,0,0,0.40), 0 0 24px ${accent}22, inset 0 0 0 1px rgba(255,255,255,0.03)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow =
          place === 1
            ? "0 0 34px rgba(215,177,74,0.18), inset 0 0 0 1px rgba(255,255,255,0.03)"
            : "0 18px 38px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.025)";
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -28,
          top: -34,
          width: 118,
          height: 118,
          borderRadius: 999,
          background: `radial-gradient(circle, ${accent}24, rgba(0,0,0,0) 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "82px minmax(0, 1fr)",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 9, justifyItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: `1px solid ${accent}66`,
              borderRadius: 999,
              padding: "5px 12px",
              background: `${accent}18`,
              color: accent,
              fontSize: 12,
              fontWeight: 950,
              boxShadow: `0 0 16px ${accent}22`,
              whiteSpace: "nowrap",
            }}
          >
            {medal} #{place}
          </div>

          <AvatarBadge
            name={row.display_name}
            avatarUrl={row.avatar_url}
            size={place === 1 ? 68 : 62}
            crown={place === 1}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 21,
              fontWeight: 980,
              letterSpacing: "-0.25px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.display_name}
          </div>

          <div
            style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 9px",
              borderRadius: 999,
              border: `1px solid ${THEME.border}`,
              background: "rgba(255,255,255,0.04)",
              color: tierAccent(row.member_tier),
              fontSize: 12,
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            {row.member_tier}
          </div>

          <div
            style={{
              marginTop: 13,
              fontSize: 31,
              fontWeight: 980,
              letterSpacing: "-0.8px",
              lineHeight: 1,
              color: pnl > 0 ? THEME.green : pnl < 0 ? THEME.red : "white",
              textShadow:
                pnl > 0
                  ? "0 0 20px rgba(85,255,138,0.26)"
                  : pnl < 0
                  ? "0 0 16px rgba(255,92,92,0.20)"
                  : "none",
            }}
          >
            <AnimatedNumber value={pnl} />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        <StatPill label="W" value={row.wins} />
        <StatPill label="L" value={row.losses} />
        <StatPill label="Entries" value={row.total_trades} />
        <StatPill label="Win Rate" value={fmtPct(Number(row.win_rate))} />
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: 12,
        padding: "10px 12px",
        background: THEME.panel2,
      }}
    >
      <div style={{ fontSize: 10, opacity: 0.72, fontWeight: 900, color: THEME.gold }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function summaryToneFor(label: string) {
  const key = label.toLowerCase();

  if (key.includes("countries") || key.includes("states")) {
    return {
      color: "rgba(168,85,247,1)",
      bg: "rgba(168,85,247,0.16)",
      glow: "rgba(168,85,247,0.22)",
    };
  }

  if (key.includes("submissions")) {
    return {
      color: "rgba(59,130,246,1)",
      bg: "rgba(59,130,246,0.15)",
      glow: "rgba(59,130,246,0.20)",
    };
  }

  if (key.includes("pnl")) {
    return {
      color: THEME.green,
      bg: "rgba(85,255,138,0.14)",
      glow: "rgba(85,255,138,0.22)",
    };
  }

  return {
    color: THEME.gold,
    bg: "rgba(215,177,74,0.16)",
    glow: "rgba(215,177,74,0.22)",
  };
}

function summaryCardShell(label: string): React.CSSProperties {
  const tone = summaryToneFor(label);

  return {
    border: `1px solid rgba(255,255,255,0.11)`,
    borderRadius: 16,
    padding: "14px 16px",
    background: `
      linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)),
      radial-gradient(420px 220px at 18% 0%, ${tone.glow}, rgba(0,0,0,0)),
      rgba(10,10,15,0.88)
    `,
    boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.025), 0 14px 30px rgba(0,0,0,0.28)`,
    transition: "transform 180ms ease, box-shadow 180ms ease",
  };
}

function SummaryIcon({ label }: { label: string }) {
  const tone = summaryToneFor(label);
  const key = label.toLowerCase();

  const iconStyle: React.CSSProperties = {
    width: 26,
    height: 26,
    display: "block",
  };

  let icon = (
    <svg viewBox="0 0 24 24" style={iconStyle} fill="none" stroke="currentColor" strokeWidth="2.4">
  <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7z" />
</svg>
  );

  if (key.includes("countries") || key.includes("states")) {
    icon = (
      <svg viewBox="0 0 24 24" style={iconStyle} fill="none" stroke="currentColor" strokeWidth="2.4">
  <circle cx="12" cy="12" r="9" />
  <path d="M3 12h18" />
  <path d="M12 3c4 4 4 14 0 18" />
  <path d="M12 3c-4 4-4 14 0 18" />
</svg>
    );
  }

  if (key.includes("submissions")) {
    icon = (
      <svg viewBox="0 0 24 24" style={iconStyle} fill="none" stroke="currentColor" strokeWidth="2.4">
  <path d="M7 3h7l3 3v15H7z" />
  <path d="M14 3v4h4" />
  <path d="M9 10h6" />
  <path d="M9 14h6" />
</svg>
    );
  }

  if (key.includes("pnl")) {
    icon = (
      <svg viewBox="0 0 24 24" style={iconStyle} fill="none" stroke="currentColor" strokeWidth="2.6">
  <path d="M4 18V6" />
  <path d="M4 18h16" />
  <path d="M7 14l4-4 3 3 5-6" />
  <circle cx="19" cy="7" r="1.5" fill="currentColor" stroke="none" />
</svg>
    );
  }

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.color}`,
        boxShadow: `0 0 18px ${tone.glow}`,
        flex: "0 0 48px",
      }}
    >
      {icon}
    </div>
  );
}

function StatSummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div style={summaryCardShell(label)}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <SummaryIcon label={label} />

        <div>
          <div style={{ fontSize: 12, fontWeight: 950, color: THEME.gold }}>
            {label}
          </div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950, letterSpacing: "-0.5px", }}>
            {value}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function MoneySummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div style={summaryCardShell(label)}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <SummaryIcon label={label} />

        <div>
          <div style={{ fontSize: 12, fontWeight: 950, color: THEME.green }}>
            {label}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 30,
              fontWeight: 950,
              color: value > 0 ? THEME.green : value < 0 ? THEME.red : "white",
              textShadow:
                value > 0
                  ? "0 0 16px rgba(85,255,138,0.22)"
                  : value < 0
                  ? "0 0 14px rgba(255,92,92,0.18)"
                  : "none",
            }}
          >
            {fmtMoney(value)}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoSummaryCard({
  label,
  subtitle,
}: {
  label: string;
  subtitle: string;
}) {
  return (
    <div style={summaryCardShell(label)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <SummaryIcon label={label} />

        <div>
          <div style={{ fontSize: 12, fontWeight: 950, color: THEME.gold }}>
            {label}
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 12,
              lineHeight: "17px",
              opacity: 0.82,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function panel(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 16,
    background: `radial-gradient(1200px 600px at 10% 10%, ${THEME.purpleSoft}, rgba(0,0,0,0)),
                 radial-gradient(1000px 500px at 90% 10%, ${THEME.goldSoft}, rgba(0,0,0,0)),
                 ${THEME.panel}`,
  };
}

function btn(primary = false): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${primary ? "rgba(215,177,74,0.28)" : THEME.border}`,
    background: primary
      ? `linear-gradient(135deg, rgba(215,177,74,0.18), rgba(255,255,255,0.06))`
      : "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function iconBtn(disabled = false): React.CSSProperties {
  return {
    ...btn(),
    width: 40,
    minWidth: 40,
    height: 40,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.25 : 1,
    transform: disabled ? "scale(0.9)" : "scale(1)",
    transition: "all 160ms ease",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
  };
}

function linkBtn(): React.CSSProperties {
  return {
    ...btn(true),
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function sectionToggleBtn(): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: "rgba(255,255,255,0.05)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(215,177,74,0.30)" : THEME.border}`,
    background: active
      ? `linear-gradient(135deg, rgba(215,177,74,0.18), rgba(255,255,255,0.06))`
      : "rgba(255,255,255,0.05)",
    color: active ? THEME.gold : "inherit",
    boxShadow: active ? `0 0 18px ${THEME.purpleSoft}` : "none",
    cursor: "pointer",
    fontWeight: 900,
  };
}

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    borderBottom: `1px solid ${THEME.border}`,
    padding: 10,
    fontSize: 12,
    opacity: 0.9,
    fontWeight: 900,
    color: THEME.gold,
  };
}

function td(): React.CSSProperties {
  return {
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    padding: 10,
    verticalAlign: "middle",
  };
}

function tdRank(rank: number): React.CSSProperties {
  let color = "inherit";
  if (rank === 1) color = THEME.gold;
  else if (rank === 2) color = THEME.silver;
  else if (rank === 3) color = THEME.bronze;

  return {
    ...td(),
    fontWeight: 950,
    color,
  };
}

function leaderboardRowStyle(rank: number): React.CSSProperties {
  const isTop = rank <= 3;

  return {
    transition: "transform 160ms ease, background 160ms ease, box-shadow 160ms ease",
    background: isTop
      ? "linear-gradient(90deg, rgba(215,177,74,0.075), rgba(255,255,255,0.015))"
      : "rgba(255,255,255,0.008)",
    boxShadow: rank === 1 ? "inset 0 0 0 1px rgba(215,177,74,0.28)" : "none",
  };
}

function leaderboardRowHoverStyle(rank: number): React.CSSProperties {
  return {
    transform: "translateY(-1px)",
    background:
      rank <= 3
        ? "linear-gradient(90deg, rgba(215,177,74,0.13), rgba(255,255,255,0.035))"
        : "rgba(255,255,255,0.035)",
    boxShadow:
      rank <= 3
        ? "0 8px 22px rgba(215,177,74,0.10)"
        : "0 8px 22px rgba(0,0,0,0.20)",
  };
}

function rankBadge(rank: number) {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function emptySectionStyle(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
    opacity: 0.82,
    fontSize: 13,
  };
}

function CustomSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  width = 220,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  width?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  const active = options.find((o) => o.value === value);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "grid",
        gap: 6,
        width,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: THEME.gold,
          opacity: 0.9,
        }}
      >
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "8px 12px",
          borderRadius: 12,
          border: `1px solid ${open ? THEME.borderStrong : THEME.border}`,
          background: "rgba(255,255,255,0.05)",
          color: "white",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          boxShadow: open ? `0 0 18px ${THEME.purpleSoft}` : "none",
        }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {active?.label ?? String(value)}
        </span>
        <span style={{ opacity: 0.8 }}>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            borderRadius: 14,
            border: `1px solid ${THEME.borderStrong}`,
            background: "rgba(10,10,10,0.96)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 12px",
                  border: 0,
                  borderBottom: `1px solid ${THEME.border}`,
                  background: selected ? "rgba(215,177,74,0.12)" : "transparent",
                  color: selected ? THEME.gold : "white",
                  cursor: "pointer",
                  fontWeight: selected ? 900 : 700,
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selected
                    ? "rgba(215,177,74,0.12)"
                    : "transparent";
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type MiniLeaderboardRow = {
  primary: string;
  secondary: string;
  avatar_url?: string | null;
  meta?: string;
  value: string;
  positive: boolean;
  wins?: number;
  losses?: number;
  breakevens?: number;
  total_trades?: number;
  win_rate?: number;
  pnl?: number;
};

function MiniLeaderboardCard({
  title,
  subtitle,
  rows,
  loading,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: MiniLeaderboardRow[];
  loading: boolean;
  empty: string;
}) {
  const isCountryCard = title.toLowerCase().includes("countries");
  const isTraderCard = title.toLowerCase().includes("traders");
  const isCityCard = title.toLowerCase().includes("cities");
  const top = rows[0];
  const rest = rows.slice(1);

  return (
    <div
  style={{
  ...snapshotCardShell(),
  minHeight: isTraderCard ? 285 : isCountryCard ? 190 : isCityCard ? 220 : 235,
}}
  onMouseEnter={(e) => {
  e.currentTarget.style.transform = "translateY(-4px) scale(1.01)";
  e.currentTarget.style.boxShadow =
    "inset 0 0 0 1px rgba(255,255,255,0.025), 0 32px 70px rgba(0,0,0,0.38)";
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform = "translateY(0px) scale(1)";
  e.currentTarget.style.boxShadow =
    "inset 0 0 0 1px rgba(255,255,255,0.018), 0 18px 40px rgba(0,0,0,0.22)";
}}
>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 950, color: "rgba(255,255,255,0.94)", letterSpacing: 0.1 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, opacity: 0.68, marginTop: 4, fontWeight: 750 }}>{subtitle}</div>
        </div>
      </div>

      {loading ? (
        <div style={emptySectionStyle()}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={emptySectionStyle()}>{empty}</div>
) : isCountryCard ? (
  <CountryBarsPanel rows={rows} />
) : isTraderCard && top ? (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1.2fr",
      gap: 14,
      alignItems: "stretch",
    }}
  >
    <TopTraderHero row={top} />

    <div
      style={{
        display: "grid",
        gridTemplateRows: "repeat(4, 1fr)",
        gap: 6,
      }}
    >
      {rest.slice(0, 4).map((row, idx) => (
        <CompactRankRow key={`${row.primary}-${idx}`} row={row} rank={idx + 2} />
      ))}
    </div>
  </div>
) : isCityCard ? (
  <div
    style={{
      display: "grid",
      gap: 6,
    }}
  >
    {rows.map((row, idx) => (
      <CityRankRow key={`${row.primary}-${idx}`} row={row} rank={idx + 1} />
    ))}
  </div>
) : (
  <div style={{ display: "grid", gap: 8 }}>
    {rows.map((row, idx) => (
      <CompactRankRow key={`${row.primary}-${idx}`} row={row} rank={idx + 1} />
    ))}
  </div>
)}

      <button
          type="button"
          onClick={() => {
          const targetId = isCountryCard ? "global-activity-section" : "rankings-section";
            document.getElementById(targetId)?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
          style={{
            marginTop: 6,
            width: "100%",
            border: 0,
            background: "transparent",
            textAlign: "center",
            color: THEME.gold,
            fontSize: 12,
            fontWeight: 950,
            opacity: 0.95,
            cursor: "pointer",
            }}
          >
  {isCountryCard ? "View all countries →" : isTraderCard ? "View full leaderboard →" : "View all cities →"}
</button>
    </div>
  );
}

function TopTraderHero({ row }: { row: MiniLeaderboardRow }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        background:
          "linear-gradient(155deg, rgba(215,177,74,0.16), rgba(215,177,74,0.045) 48%, rgba(255,255,255,0.025))",
        border: "1px solid rgba(215,177,74,0.36)",
        boxShadow:
          "0 0 24px rgba(215,177,74,0.14), inset 0 0 0 1px rgba(255,255,255,0.025)",
        alignSelf: "stretch",
        minHeight: 180,
        display: "grid",
        alignContent: "space-evenly",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "88px minmax(0, 1fr)",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: "1px solid rgba(215,177,74,0.32)",
              borderRadius: 999,
              padding: "5px 11px",
              background: "rgba(215,177,74,0.10)",
              color: THEME.gold,
              fontSize: 13,
              fontWeight: 950,
            }}
          >
            👑 1
          </div>

          <AvatarBadge
            name={row.primary}
            avatarUrl={row.avatar_url}
            size={72}
            crown
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 950,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.primary}
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              opacity: 0.74,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.secondary}
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 30,
              letterSpacing: "0.5px",
              fontWeight: 980,
              color: row.positive ? THEME.green : THEME.red,
              textShadow: row.positive
                ? "0 0 18px rgba(85,255,138,0.28)"
                : "0 0 14px rgba(255,92,92,0.20)",
              lineHeight: 1,
            }}
          >
            {row.value}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 12,
          padding: "5px 8px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.24)",
          border: `1px solid ${THEME.border}`,
          fontSize: 11,
          fontWeight: 900,
          color: "rgba(255,255,255,0.84)",
          whiteSpace: "nowrap",
        }}
      >
        <span><span style={{ color: THEME.gold }}>W</span> {row.wins ?? 0}</span>
        <span><span style={{ color: THEME.gold }}>L</span> {row.losses ?? 0}</span>
        <span><span style={{ color: THEME.gold }}>BE</span> {row.breakevens ?? 0}</span>
        <span><span style={{ color: THEME.gold }}>Win Rate</span> {fmtPct(Number(row.win_rate ?? 0))}</span>
      </div>
    </div>
  );
}

function countryCode(country: string) {
  const key = String(country || "").trim().toLowerCase();

  const map: Record<string, string> = {
    "united states": "us",
    "united states of america": "us",
    japan: "jp",
    "united kingdom": "gb",
    canada: "ca",
    germany: "de",
    australia: "au",
    mexico: "mx",
    brazil: "br",
    france: "fr",
    italy: "it",
    spain: "es",
    india: "in",
    "south africa": "za",
  };

  return map[key] ?? "";
}

function CompactRankRow({ row, rank }: { row: MiniLeaderboardRow; rank: number }) {
  const rankColor =
    rank === 1
      ? THEME.gold
      : rank === 2
      ? "#e5e7eb"
      : rank === 3
      ? "#d4a574"
      : "rgba(255,255,255,0.46)";

  const rowBackground =
    rank <= 3 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.018)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "30px minmax(0, 1fr) auto",
        gap: 6,
        alignItems: "center",
        borderRadius: 12,
        border:
          rank <= 3
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(255,255,255,0.055)",
        background: rowBackground,
        boxShadow:
          rank === 1
            ? "0 0 12px rgba(215,177,74,0.22)"
          : rank === 2
            ? "0 0 10px rgba(200,200,220,0.15)"
          : rank === 3
            ? "0 0 10px rgba(212,165,116,0.15)"
          : "none",
        padding: "6px 10px",
        transition: "transform 160ms ease, background 160ms ease, border-color 160ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.background = "rgba(255,255,255,0.055)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.background = rowBackground;
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 950,
          color: rankColor,
          background:
            rank <= 3 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
          border:
            rank <= 3
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {rank}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 950,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: rank <= 3 ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.68)",
          }}
        >
          {countryCode(row.primary) ? (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
    <img
      src={`https://flagcdn.com/24x18/${countryCode(row.primary)}.png`}
      alt={`${row.primary} flag`}
      style={{
        width: 20,
        height: 14,
        borderRadius: 3,
        objectFit: "cover",
        flex: "0 0 auto",
        boxShadow: "0 0 6px rgba(255,255,255,0.08)",
      }}
    />
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {row.primary}
    </span>
  </span>
) : (
  row.primary
)}
        </div>
      </div>

      <div
        style={{
          fontWeight: 950,
          color: row.positive ? THEME.green : THEME.red,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textShadow: row.positive
            ? "0 0 14px rgba(85,255,138,0.28)"
            : "0 0 10px rgba(255,92,92,0.16)",
        }}
      >
        {row.value}
      </div>
    </div>
  );
}

function CityRankRow({ row, rank }: { row: MiniLeaderboardRow; rank: number }) {
  const rankColor =
    rank === 1
      ? THEME.gold
      : rank === 2
      ? "#e5e7eb"
      : rank === 3
      ? "#d4a574"
      : "rgba(255,255,255,0.46)";

  const rowBackground =
    rank <= 3 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.018)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "30px minmax(0, 1fr) auto",
        gap: 8,
        alignItems: "center",
        borderRadius: 12,
        border:
          rank <= 3
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(255,255,255,0.055)",
        background: rowBackground,
        boxShadow:
          rank === 1
            ? "0 0 12px rgba(215,177,74,0.18)"
            : rank === 2
            ? "0 0 10px rgba(200,200,220,0.12)"
            : rank === 3
            ? "0 0 10px rgba(212,165,116,0.12)"
            : "none",
        padding: "7px 12px",
        transition: "transform 160ms ease, background 160ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.background = "rgba(255,255,255,0.055)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.background = rowBackground;
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 950,
          color: rankColor,
          background:
            rank <= 3 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
          border:
            rank <= 3
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {rank}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 950,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: rank <= 3 ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.68)",
          }}
        >
          {countryCode(row.secondary) ? (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
    <img
      src={`https://flagcdn.com/24x18/${countryCode(row.secondary)}.png`}
      alt={`${row.secondary} flag`}
      style={{
        width: 18,
        height: 13,
        borderRadius: 3,
        objectFit: "cover",
        flex: "0 0 auto",
      }}
    />
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {row.primary}
    </span>
  </span>
) : (
  row.primary
)}
        </div>

      </div>

      <div
        style={{
          fontWeight: 950,
          color: row.positive ? THEME.green : THEME.red,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textShadow: row.positive
            ? "0 0 14px rgba(85,255,138,0.28)"
            : "0 0 10px rgba(255,92,92,0.16)",
        }}
      >
        {row.value}
      </div>
    </div>
  );
}

function SnapshotStat({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: 10,
        background: "rgba(0,0,0,0.24)",
        padding: "7px 7px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10, opacity: 0.62, fontWeight: 950, color: THEME.gold, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          fontWeight: 950,
          color,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniWorldPanel({ rows }: { rows: MiniLeaderboardRow[] }) {
  const topRows = rows.slice(0, 6);

  const positions = [
    ["25%", "45%"], // North America
    ["47%", "57%"], // South America
    ["55%", "40%"], // Europe
    ["63%", "50%"], // Africa
    ["76%", "44%"], // Asia
    ["84%", "66%"], // Australia
  ];

  return (
    <div
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: 16,
        minHeight: 200,
        height: 200,
        background:
          "radial-gradient(circle at 30% 32%, rgba(215,177,74,0.22), rgba(0,0,0,0) 20%), radial-gradient(circle at 65% 38%, rgba(85,255,138,0.18), rgba(0,0,0,0) 18%), rgba(5,5,8,0.88)",
        position: "relative",
        overflow: "hidden",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.025), 0 18px 40px rgba(0,0,0,0.30)",
      }}
    >
      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.34,
          filter: "drop-shadow(0 0 10px rgba(255,255,255,0.08))",
        }}
      >
        <path
          d="M145 175 C105 150 80 185 95 220 C120 260 180 250 205 215 C225 185 185 170 145 175Z"
          fill="rgba(255,255,255,0.32)"
        />
        <path
          d="M255 285 C220 300 225 365 270 400 C315 370 330 315 300 285 C287 270 270 272 255 285Z"
          fill="rgba(255,255,255,0.26)"
        />
        <path
          d="M470 170 C430 150 395 170 405 205 C425 235 485 230 505 195 C520 170 500 158 470 170Z"
          fill="rgba(255,255,255,0.32)"
        />
        <path
          d="M525 245 C490 270 500 350 545 392 C590 350 595 280 560 245 C548 232 535 235 525 245Z"
          fill="rgba(255,255,255,0.25)"
        />
        <path
          d="M650 165 C610 140 575 175 600 220 C645 250 735 245 785 205 C760 160 700 150 650 165Z"
          fill="rgba(255,255,255,0.30)"
        />
        <path
          d="M780 335 C750 345 748 385 790 405 C835 395 850 360 825 340 C812 330 795 330 780 335Z"
          fill="rgba(255,255,255,0.25)"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.24,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.75) 0.8px, transparent 0.8px)",
          backgroundSize: "8px 8px",
          maskImage:
            "radial-gradient(ellipse at center, black 0%, black 58%, transparent 82%)",
        }}
      />

      {topRows.map((row, idx) => {
        const pnl = Number(row.pnl ?? 0);
        const size = Math.max(11, Math.min(26, 10 + Number(row.total_trades ?? 0) / 2));
        const [left, top] = positions[idx] ?? ["50%", "50%"];

        return (
          <div
            key={`${row.primary}-${idx}`}
            title={`${row.primary}: ${row.value}`}
            style={{
              position: "absolute",
              left,
              top,
              width: size,
              height: size,
              borderRadius: 999,
              background:
                pnl > 0
                  ? "rgba(85,255,138,0.78)"
                  : pnl < 0
                  ? "rgba(255,92,92,0.74)"
                  : "rgba(215,177,74,0.72)",
              boxShadow:
                pnl > 0
                  ? `0 0 ${size * 2.2}px rgba(85,255,138,0.62)`
                  : pnl < 0
                  ? `0 0 ${size * 2.2}px rgba(255,92,92,0.52)`
                  : `0 0 ${size * 2.2}px rgba(215,177,74,0.52)`,
              transform: "translate(-50%, -50%)",
              border: "1px solid rgba(255,255,255,0.42)",
              transition: "transform 180ms ease",
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 14,
          bottom: 12,
          fontSize: 11,
          fontWeight: 900,
          color: "rgba(255,255,255,0.68)",
        }}
      >
        Global Activity Heatmap
      </div>
    </div>
  );
}

function CountryBarsPanel({ rows }: { rows: MiniLeaderboardRow[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(Number(r.pnl ?? 0))), 1);

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {rows.slice(0, 5).map((row, idx) => {
        const pnl = Number(row.pnl ?? 0);
        const width = Math.max(8, (Math.abs(pnl) / max) * 85 + 10);
        const code = countryCode(row.primary);

        return (
          <div
            key={`${row.primary}-${idx}`}
            style={{
              border: `1px solid ${idx === 0 ? "rgba(215,177,74,0.28)" : THEME.border}`,
              borderRadius: 12,
              padding: "4px 8px 5px",
              background:
                idx === 0
                  ? "linear-gradient(135deg, rgba(215,177,74,0.10), rgba(255,255,255,0.02))"
                  : "rgba(255,255,255,0.02)",
              boxShadow: idx === 0 ? "0 0 14px rgba(215,177,74,0.10)" : "none",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "24px minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 7,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 950,
                  color:
                    idx === 0
                      ? THEME.gold
                      : idx === 1
                      ? THEME.silver
                      : idx === 2
                      ? THEME.bronze
                      : "rgba(255,255,255,0.58)",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${THEME.border}`,
                }}
              >
                {idx + 1}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  minWidth: 0,
                  fontWeight: 950,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {code ? (
                  <img
                    src={`https://flagcdn.com/24x18/${code}.png`}
                    alt={`${row.primary} flag`}
                    style={{
                      width: 20,
                      height: 14,
                      borderRadius: 3,
                      objectFit: "cover",
                      flex: "0 0 auto",
                    }}
                  />
                ) : null}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.primary}
                </span>
              </div>

              <div
                style={{
                  fontWeight: 950,
                  fontSize: 13,
                  color: pnl >= 0 ? THEME.green : THEME.red,
                  textShadow:
                    pnl >= 0
                      ? "0 0 10px rgba(85,255,138,0.22)"
                      : "0 0 10px rgba(255,92,92,0.18)",
                  whiteSpace: "nowrap",
                }}
              >
                {row.value}
              </div>
            </div>

            <div
              style={{
                marginTop: 3,
                height: 3,
                borderRadius: 999,
                background: "rgba(255,255,255,0.055)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  borderRadius: 999,
                  background:
                    pnl >= 0
                      ? "linear-gradient(90deg, rgba(85,255,138,0.60), rgba(85,255,138,1))"
                      : "linear-gradient(90deg, rgba(255,92,92,0.60), rgba(255,92,92,1))",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AvatarBadge({
  name,
  avatarUrl,
  size = 38,
  crown = false,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  crown?: boolean;
}) {
  const initials =
    String(name || "?")
      .split(/[\s_\-.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        flex: `0 0 ${size}px`,
        color: crown ? THEME.gold : "white",
        fontWeight: 950,
        fontSize: Math.max(12, size * 0.3),
        border: crown
          ? "2px solid rgba(215,177,74,0.76)"
          : `1px solid ${THEME.border}`,
        background: crown
          ? "radial-gradient(circle at 35% 25%, rgba(215,177,74,0.38), rgba(0,0,0,0.22) 58%), rgba(215,177,74,0.10)"
          : "rgba(255,255,255,0.05)",
        boxShadow: crown ? "0 0 18px rgba(215,177,74,0.22)" : "none",
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

function snapshotCardShell(): React.CSSProperties {
  return {
    height: "auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    border: `1px solid rgba(255,255,255,0.11)`,
    borderRadius: 18,
    padding: "12px 16px",
    minHeight: 235,
    
    transition: "transform 200ms ease, box-shadow 200ms ease",
    background: `
      linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.006)),
      radial-gradient(800px 280px at 18% 0%, rgba(140,95,255,0.16), rgba(0,0,0,0)),
      radial-gradient(700px 280px at 92% 0%, rgba(215,177,74,0.12), rgba(0,0,0,0)),
      rgba(10,10,14,0.90)
    `,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.018), 0 18px 40px rgba(0,0,0,0.22)",
  };
}
