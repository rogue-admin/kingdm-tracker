"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CountryHeatMap from "@/app/components/CountryHeatMap";
import USStateHeatMap from "@/app/components/USStateHeatMap";
import TopNav from "@/app/components/TopNav";

type Session = "tokyo" | "london" | "nyc";

type GeoLeaderboardRow = {
  user_id: string;
  display_name: string;
  member_tier: string;
  city: string | null;
  state_code: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  net_wins: number;
  win_rate: number;
  pnl: number;
};

// -------------------------
// Theme (The Kingdm)
// -------------------------
const THEME = {
  bg: "rgba(8,8,10,1)",
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

function NearbyLeadersCard({
  title,
  subtitle,
  rows = [],
}: {
  title: string;
  subtitle: string;
  rows?: GeoLeaderboardRow[];
}) {
  return (
    <div
      style={{
        border: `1px solid ${THEME.border}`,
        borderRadius: 16,
        padding: 14,
        background: THEME.panel2,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, color: THEME.gold }}>
        {title}
      </div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>{subtitle}</div>

      <div style={{ height: 12 }} />

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.7 }}>No leaders yet for this area.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row, idx) => (
            <NearbyLeaderRow key={row.user_id} row={row} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function NearbyLeaderRow({
  row,
  rank,
}: {
  row: GeoLeaderboardRow;
  rank: number;
}) {
  const pnlColor = row.pnl > 0 ? THEME.green : row.pnl < 0 ? THEME.red : "inherit";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 10,
        alignItems: "center",
        border: `1px solid ${THEME.border}`,
        borderRadius: 12,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          fontWeight: 950,
          color:
            rank === 1
              ? THEME.gold
              : rank === 2
              ? THEME.silver
              : rank === 3
              ? THEME.bronze
              : "rgba(255,255,255,0.75)",
        }}
      >
        #{rank}
      </div>

      <div>
        <div style={{ fontWeight: 900 }}>{row.display_name}</div>
        <div style={{ marginTop: 3, fontSize: 12, opacity: 0.72 }}>
          {row.member_tier} • {fmtPct(row.win_rate)} • {row.total_trades} trades
        </div>
      </div>

      <div style={{ fontWeight: 900, color: pnlColor }}>{fmtMoney(row.pnl)}</div>
    </div>
  );
}

// -------------------------
// Helpers
// -------------------------
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mmdd(iso: string) {
  // iso = YYYY-MM-DD
  return iso.slice(5);
}

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

function fmtMoneyCompact(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function localCityMessage(count: number | null, cityLabel: string) {
  if (count == null) return "Set your city to see nearby subscribers";
  if (count === 0) return "You’re the first Knight here 👑";
  if (count === 1) return `You’re trading alongside 1 other Knight in ${cityLabel}`;
  return `You’re trading alongside ${count} other Knights in ${cityLabel}`;
}

function localCountryMessage(count: number | null) {
  if (count == null) return "Set your country to see totals";
  if (count === 0) return "You’re the first Knight in your country 👑";
  if (count === 1) return "1 other Knight in your country";
  return `${count} other Knights in your country`;
}

function clusterBadge(count: number | null) {
  if (count == null) return null;
  if (count === 0) return "👑 Frontier";
  if (count <= 2) return "⚔️ Small cluster";
  if (count <= 9) return "🔥 Growing hub";
  return "🏰 Active stronghold";
}

// Calendar grid starts on Sunday
function startOfCalendarGrid(monthDate: Date) {
  const s = startOfMonth(monthDate);
  const dow = s.getDay(); // 0=Sun
  return addDays(s, -dow);
}

function endOfCalendarGrid(monthDate: Date) {
  const e = endOfMonth(monthDate);
  const dow = e.getDay(); // 0=Sun
  return addDays(e, 6 - dow); // push to Saturday
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function parseAmountOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null; // blank = "no entry"
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Turn P/L magnitude into a 0..1 intensity for heatmap/glow
 * Tune maxAbs to match your community
 */
function pnlIntensity(total: number, maxAbs = 200_000) {
  const a = Math.abs(total);
  return clamp(a / maxAbs, 0, 1);
}

function pnlTextColor(total: number) {
  if (total > 0) return THEME.green;
  if (total < 0) return THEME.red;
  return "rgba(255,255,255,0.80)";
}

function pnlHeatBg(total: number) {
  const t = pnlIntensity(total);
  if (total === 0) return "rgba(255,255,255,0.03)";
  if (total > 0) return `rgba(85,255,138,${0.06 + t * 0.14})`;
  return `rgba(255,92,92,${0.06 + t * 0.14})`;
}

function pnlGlow(total: number) {
  const t = pnlIntensity(total);
  if (total === 0) return "none";
  const glow = 6 + t * 18;
  const alpha = 0.18 + t * 0.22;
  if (total > 0) return `0 0 ${glow}px rgba(85,255,138,${alpha})`;
  return `0 0 ${glow}px rgba(255,92,92,${alpha})`;
}


// -------------------------
// US Federal Holidays (Observed-ish)
// -------------------------
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, nth: number) {
  const first = new Date(year, month0, 1);
  const firstDow = first.getDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return new Date(year, month0, day);
}
function lastWeekdayOfMonth(year: number, month0: number, weekday: number) {
  const last = new Date(year, month0 + 1, 0);
  const dow = last.getDay();
  const offset = (dow - weekday + 7) % 7;
  return new Date(year, month0, last.getDate() - offset);
}
function usFederalHolidayMap(year: number) {
  const dates = new Map<string, string>();
  const push = (d: Date, name: string) => {
  const observed = new Date(d);

  // Saturday -> Friday
  if (observed.getDay() === 6) {
    observed.setDate(observed.getDate() - 1);
  }

  // Sunday -> Monday
  if (observed.getDay() === 0) {
    observed.setDate(observed.getDate() + 1);
  }

  dates.set(toISODate(observed), name);
};

  push(new Date(year, 0, 1), "New Year's Day");
  push(nthWeekdayOfMonth(year, 0, 1, 3), "Martin Luther King Jr. Day");
  push(nthWeekdayOfMonth(year, 1, 1, 3), "Presidents Day");
  push(lastWeekdayOfMonth(year, 4, 1), "Memorial Day");
  push(new Date(year, 5, 19), "Juneteenth");
  push(new Date(year, 6, 4), "Independence Day");
  push(nthWeekdayOfMonth(year, 8, 1, 1), "Labor Day");
  push(nthWeekdayOfMonth(year, 9, 1, 2), "Columbus Day");
  push(new Date(year, 10, 11), "Veterans Day");
  push(nthWeekdayOfMonth(year, 10, 4, 4), "Thanksgiving");
  push(new Date(year, 11, 25), "Christmas Day");

  return dates;
}

// -------------------------
// Interactive monthly equity chart
// -------------------------
type EquityDatum = {
  iso: string;
  daily: number;
  cumulative: number;
};

type EquityChartPoint = EquityDatum & {
  x: number;
  y: number;
};

function buildEquityChartModel(
  data: EquityDatum[],
  w = 1000,
  h = 118,
  padX = 12,
  padY = 14
) {
  if (!data.length) {
    return {
      w,
      h,
      padX,
      padY,
      points: [] as EquityChartPoint[],
      linePoints: "",
      areaPoints: "",
      zeroY: h / 2,
    };
  }

  const values = data.map((d) => d.cumulative);

  // Always include zero in the scale.
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;

  const yFor = (value: number) =>
    padY + ((max - value) * (h - padY * 2)) / span;

  const points: EquityChartPoint[] = data.map((datum, index) => ({
    ...datum,
    x:
      data.length === 1
        ? w / 2
        : padX +
          (index * (w - padX * 2)) /
            Math.max(1, data.length - 1),
    y: yFor(datum.cumulative),
  }));

  const linePoints = points
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");

  const areaBaseline = h - padY;

  const areaPoints =
    points.length > 1
      ? `${points[0].x.toFixed(1)},${areaBaseline.toFixed(1)} ` +
        `${linePoints} ` +
        `${points[points.length - 1].x.toFixed(1)},${areaBaseline.toFixed(1)}`
      : "";

  return {
    w,
    h,
    padX,
    padY,
    points,
    linePoints,
    areaPoints,
    zeroY: yFor(0),
  };
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

function pulseDotStyle(active: boolean): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: 999,
    display: "inline-block",
    background: active ? THEME.green : "rgba(255,255,255,0.25)",
    boxShadow: active ? "0 0 12px rgba(85,255,138,0.85)" : "none",
    verticalAlign: "middle",
    flex: "0 0 auto",
  };
}

// -------------------------
// Main
// -------------------------
export default function SubscriberDashboardPage() {

  const [countryHeatRows, setCountryHeatRows] = useState<
  {
  country: string;
  traders: number;
  subscribers: number;
  visible_leaderboard_subscribers: number;
  total_pnl: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  avg_win_rate: number;
}[]
>([]);
  const [, setCountryHeatLoading] = useState(false);

  const [usStatePresenceRows, setUsStatePresenceRows] = useState<any[]>([]);
  const [usStatePerformanceRows, setUsStatePerformanceRows] = useState<any[]>([]);

  const [myStateCode, setMyStateCode] = useState<string | null>(null);

  const [showNearbyLeaders, setShowNearbyLeaders] = useState(false);
  const [, setNearbyLoading] = useState(false);
  const [cityLeaders, setCityLeaders] = useState<GeoLeaderboardRow[]>([]);
  const [stateLeaders, setStateLeaders] = useState<GeoLeaderboardRow[]>([]);
  const [countryLeaders, setCountryLeaders] = useState<GeoLeaderboardRow[]>([]);

  // Hover + selection
  const [hoveredISO, setHoveredISO] = useState<string | null>(null);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  // Auth
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [, setVerifying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep status for debugging; toast is the “PRO” UX
  const [status, setStatus] = useState<string | null>(null);

  // Month navigation
  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(new Date()));

  // Calendar totals (combined)
  const [dailyTotals, setDailyTotals] = useState<Map<string, number>>(new Map());
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Has-entry set for calendar (distinguish no-entry vs net-0)
  const [dayHasEntry, setDayHasEntry] = useState<Set<string>>(new Set());

  // ✅ Dedicated YTD extremes (don’t depend on month grid map)
  const [bestYtd, setBestYtd] = useState<{ iso: string; val: number } | null>(null);
  const [worstYtd, setWorstYtd] = useState<{ iso: string; val: number } | null>(null);

  // ✅ Local community counts (privacy-safe)
  const [myCity, setMyCity] = useState<string | null>(null);
  const [myCountry, setMyCountry] = useState<string | null>(null);
  const [myRegion, setMyRegion] = useState<string | null>(null);
  const [othersInCity, setOthersInCity] = useState<number | null>(null);
  const [othersInCountry, setOthersInCountry] = useState<number | null>(null);

  const [showLocationEditor, setShowLocationEditor] = useState(false);
  
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [participatesInLeaderboard, setParticipatesInLeaderboard] = useState(false);
  
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [, setLocationSearching] = useState(false);
  


  // Summary cards
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [last30Total, setLast30Total] = useState<number>(0);
  const [allTimeTotal, setAllTimeTotal] = useState<number>(0);

  const [tokyoTotal, setTokyoTotal] = useState<number>(0);
  const [londonTotal, setLondonTotal] = useState<number>(0);
  const [nycTotal, setNycTotal] = useState<number>(0);

  //Collapsible map 
  const [showWorldMap, setShowWorldMap] = useState(false);

  // Day panel
  const [dayLoading, setDayLoading] = useState(false);
  const [daySaving, setDaySaving] = useState(false);

  const [dayTokVal, setDayTokVal] = useState<number>(0);
  const [dayLonVal, setDayLonVal] = useState<number>(0);
  const [dayNycVal, setDayNycVal] = useState<number>(0);

  const [dayTok, setDayTok] = useState<string>("");
  const [dayLon, setDayLon] = useState<string>("");
  const [dayNyc, setDayNyc] = useState<string>("");

  // "Has entry" flags (distinguish no-entry vs net-0)
  const [hasTok, setHasTok] = useState(false);
  const [hasLon, setHasLon] = useState(false);
  const [hasNyc, setHasNyc] = useState(false);

  const hasAnyEntryForSelected = hasTok || hasLon || hasNyc;

  // Dirty flags (core fix)
  const [dirtyTok, setDirtyTok] = useState(false);
  const [dirtyLon, setDirtyLon] = useState(false);
  const [dirtyNyc, setDirtyNyc] = useState(false);

  const hasUnsaved = dirtyTok || dirtyLon || dirtyNyc;

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Heatmap mode toggle
  const [heatmapMode, setHeatmapMode] = useState(false);

  const areaLabel =
  myCity && myCountry
    ? `${myCity}${myRegion ? `, ${myRegion}` : ""}, ${myCountry}`
    : myCountry
    ? myCountry
    : "Not set";

const cityLabel = myCity ?? "your city";

const cityBadge = clusterBadge(othersInCity);
const countryBadge = clusterBadge(othersInCountry);

const cityMessage = localCityMessage(othersInCity, cityLabel);
const countryMessage = localCountryMessage(othersInCountry);

const cityActive = (othersInCity ?? 0) > 0;
const countryActive = (othersInCountry ?? 0) > 0;


  // TradingView-style toast
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function toastOk(msg: string) {
    setToast({ type: "ok", msg });
  }
  function toastErr(msg: string) {
    setToast({ type: "err", msg });
  }

  function confirmLoseEdits() {
    if (!hasUnsaved) return true;
    return window.confirm("You have unsaved changes for this day. Discard them?");
  }

  function openDay(iso: string) {
    if (selectedISO && iso !== selectedISO && !confirmLoseEdits()) return;
    setSelectedISO(iso);
    setDrawerOpen(true);
    loadDayBreakdown(iso);
  }

  function closeDrawer() {
    if (!confirmLoseEdits()) return;
    setDrawerOpen(false);
  }

  function shiftSelectedDay(delta: number) {
    if (!selectedISO) return;
    const d = new Date(selectedISO + "T00:00:00");
    const next = addDays(d, delta);
    const nextISO = toISODate(next);
    openDay(nextISO);
  }

  // -------------------------
  // Auth bootstrap
  // -------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSignedIn(!!sess);

      // ✅ Only clear verification when the user actually signs out.
      if (event === "SIGNED_OUT") {
        setVerified(null);
        setUserId(null);
      }

      setError(null);
      setStatus(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setUserId(null);
      return;
    }
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.error(error);
        setUserId(null);
        return;
      }
      setUserId(data.user?.id ?? null);
    });
  }, [signedIn]);

  async function signIn() {
    setError(null);
    setStatus(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) setError(error.message);
  }

  async function signOut() {
    setError(null);
    setStatus(null);
    await supabase.auth.signOut();
  }

  // -------------------------
  // Verify contributor
  // -------------------------
  async function verifyContributor() {
    if (!signedIn) return;

    setError(null);
    setStatus(null);
    setVerifying(true);

    try {
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) {
        setError(sessErr.message);
        setVerified(false);
        return;
      }

      const token = sessData.session?.access_token;
      if (!token) {
        setError("No session token found. Sign out, sign in again, then retry.");
        setVerified(false);
        return;
      }

      const { data, error: fnErr } = await supabase.functions.invoke("verify-contributor", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (fnErr) {
        setError(fnErr.message || "Edge Function returned a non-2xx status code");
        setVerified(false);
        return;
      }

      if (!data?.ok) {
        setError(data?.error ?? "Verification failed");
        setVerified(false);
        return;
      }

      setVerified(true);
      setStatus("Verified ✅");
    } finally {
      setVerifying(false);
    }
  }

  // ✅ Only verify when we have a session and verified is unknown
  useEffect(() => {
    if (!signedIn) return;
    if (verified !== null) return;
    verifyContributor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, verified]);

  // -------------------------
  // Data loaders
  // -------------------------
  const calendarRange = useMemo(() => {
    const start = startOfCalendarGrid(monthCursor);
    const end = endOfCalendarGrid(monthCursor);
    return { startISO: toISODate(start), endISO: toISODate(end) };
  }, [monthCursor]);

  async function loadCountryHeatMap() {
  if (!signedIn || verified !== true) return;

  setCountryHeatLoading(true);
  try {
    const { data, error } = await supabase
      .from("v_country_heatmap_month")
      .select("*");

    if (error) {
      console.error("loadCountryHeatMap error:", error);
      setCountryHeatRows([]);
      return;
    }

    const rows = ((data ?? []) as any[]).map((r) => ({
  country: String(r.country ?? ""),
  traders: Number(r.traders ?? 0),
  subscribers: Number(r.subscribers ?? r.traders ?? 0),
  visible_leaderboard_subscribers: Number(
    r.visible_leaderboard_subscribers ?? r.traders ?? 0
  ),
  total_pnl: Number(r.total_pnl ?? 0),
  wins: Number(r.wins ?? 0),
  losses: Number(r.losses ?? 0),
  breakevens: Number(r.breakevens ?? 0),
  total_trades: Number(r.total_trades ?? 0),
  avg_win_rate: Number(r.avg_win_rate ?? 0),
}));

    setCountryHeatRows(rows);
  } finally {
    setCountryHeatLoading(false);
  }
}

async function loadUSStateHeatMap() {
  if (!signedIn || verified !== true) return;

  const { data, error } = await supabase
    .from("v_us_state_activity_month")
    .select("*");

  if (error) {
    console.error("US state activity error:", error);
    setUsStatePresenceRows([]);
    setUsStatePerformanceRows([]);
    return;
  }

  const rows = ((data ?? []) as any[]).map((r) => ({
    state_code: String(r.state_code ?? ""),
    session: String(r.session ?? "all"),
    traders: Number(r.traders ?? 0),
    total_pnl: Number(r.total_pnl ?? 0),
    avg_pnl_per_trader: Number(r.avg_pnl_per_trader ?? 0),
    wins: Number(r.wins ?? 0),
    losses: Number(r.losses ?? 0),
    breakevens: Number(r.breakevens ?? 0),
    total_trades: Number(r.total_trades ?? 0),
    avg_win_rate: Number(r.avg_win_rate ?? 0),
  }));

  setUsStatePresenceRows(rows);
  setUsStatePerformanceRows(rows);
}


  async function loadCalendar() {
    if (!signedIn || verified !== true || !userId) return;

    setCalendarLoading(true);
    try {
      // 1) Combined totals from view (visible grid only)
      const { data, error } = await supabase
        .from("v_my_calendar_daily")
        .select("date, day_total")
        .eq("user_id", userId)
        .gte("date", calendarRange.startISO)
        .lte("date", calendarRange.endISO);

      if (error) {
        console.error(error);
        setError(error.message);
        return;
      }

      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        map.set(String(r.date), Number(r.day_total ?? 0));
      });
      setDailyTotals(map);

      // 2) Has-entry set from raw submissions (visible grid only)
      const { data: entryRows, error: entryErr } = await supabase
        .from("subscriber_submissions")
        .select("date")
        .eq("user_id", userId)
        .gte("date", calendarRange.startISO)
        .lte("date", calendarRange.endISO);

      if (entryErr) {
        console.error(entryErr);
        setDayHasEntry(new Set());
      } else {
        const s = new Set<string>();
        (entryRows ?? []).forEach((r: any) => s.add(String(r.date)));
        setDayHasEntry(s);
      }
    } finally {
      setCalendarLoading(false);
    }
  }

  // ✅ YTD best/worst must query the whole YTD window, not the visible grid map
  async function loadYtdExtremes() {
    if (!signedIn || verified !== true || !userId) return;

    const year = monthCursor.getFullYear();
    const ytdStart = new Date(year, 0, 1);

    // ✅ YTD end: always today
    const ytdEnd = new Date();

    const startISO = toISODate(ytdStart);
    const endISO = toISODate(ytdEnd);

    const { data, error } = await supabase
      .from("v_my_calendar_daily")
      .select("date, day_total")
      .eq("user_id", userId)
      .gte("date", startISO)
      .lte("date", endISO);

    if (error) {
      console.error(error);
      return;
    }

    // Only consider days where an entry exists
    const { data: entryRows, error: entryErr } = await supabase
      .from("subscriber_submissions")
      .select("date")
      .eq("user_id", userId)
      .gte("date", startISO)
      .lte("date", endISO);

    const entrySet = new Set<string>();
    if (!entryErr) (entryRows ?? []).forEach((r: any) => entrySet.add(String(r.date)));

    let best: { iso: string; val: number } | null = null;
    let worst: { iso: string; val: number } | null = null;

    (data ?? []).forEach((r: any) => {
      const iso = String(r.date);
      if (!entrySet.has(iso)) return;

      const val = Number(r.day_total ?? 0);
      if (!best || val > best.val) best = { iso, val };
      if (!worst || val < worst.val) worst = { iso, val };
    });

    setBestYtd(best);
    setWorstYtd(worst);
  }

  // ✅ Local community counts (privacy-safe)
  // Uses your actual schema:
  // profiles.location_id -> locations.id

  async function loadLocalCommunityCounts() {
  if (!signedIn || verified !== true || !userId) return;

  const requestKey = `${userId}-${Date.now()}`;
  (window as any).__kingdmLocalCountsReq = requestKey;

  const meRes = await supabase
    .from("profiles")
    .select("id, location_id, locations:location_id (city,country,region,state_code,continent)")
    .eq("id", userId)
    .maybeSingle();

  if ((window as any).__kingdmLocalCountsReq !== requestKey) return;

  if (meRes.error) {
    console.error("loadLocalCommunityCounts meRes error:", meRes.error);
    setMyCity(null);
    setMyCountry(null);
    setMyRegion(null);
    setOthersInCity(null);
    setOthersInCountry(null);
    return;
  }

  const myLoc = (meRes.data as any)?.locations ?? null;

  const city = myLoc?.city ? String(myLoc.city).trim() : "";
  const country = myLoc?.country ? String(myLoc.country).trim() : "";
  const region = myLoc?.region ? String(myLoc.region).trim() : "";
  const stateCode = myLoc?.state_code ? String(myLoc.state_code).trim() : "";

  setMyCity(city || null);
  setMyCountry(country || null);
  setMyRegion(region || null);
  setMyStateCode(stateCode || null);

  if (!country) {
    setOthersInCity(null);
    setOthersInCountry(null);
    return;
  }

  const [cityRes, countryRes] = await Promise.all([
    city
      ? supabase
          .from("v_public_knight_locations")
          .select("id", { count: "exact", head: true })
          .neq("id", userId)
          .eq("city", city)
          .eq("country", country)
      : Promise.resolve(null),
    supabase
      .from("v_public_knight_locations")
      .select("id", { count: "exact", head: true })
      .neq("id", userId)
      .eq("country", country),
  ]);

  if ((window as any).__kingdmLocalCountsReq !== requestKey) return;

  if (cityRes && "error" in cityRes && cityRes.error) {
    console.error("cityRes error:", cityRes.error);
  }
  if (countryRes.error) {
    console.error("countryRes error:", countryRes.error);
  }

  setOthersInCity(city ? cityRes?.count ?? 0 : null);
  setOthersInCountry(countryRes.count ?? 0);
} 

async function loadVisibilityPreference() {
  if (!userId) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("participates_in_leaderboard")
    .eq("id", userId)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  setParticipatesInLeaderboard(
    !!data?.participates_in_leaderboard
  );
}

async function toggleLeaderboardVisibility() {
  if (!userId) return;

  const next = !participatesInLeaderboard;

  setParticipatesInLeaderboard(next);
  setVisibilitySaving(true);

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        participates_in_leaderboard: next,
      })
      .eq("id", userId);

    if (error) throw error;

    toastOk(
      next
        ? "Public visibility enabled"
        : "Public visibility disabled"
    );
  } catch (e: any) {
    console.error(e);

    setParticipatesInLeaderboard(!next);

    toastErr(
      e?.message ??
        "Failed to update visibility"
    );
  } finally {
    setVisibilitySaving(false);
  }
}

async function searchLocations(q: string) {
  setLocationSearch(q);

  const term = q.trim();

  if (term.length < 2) {
    setLocationResults([]);
    return;
  }

  setLocationSearching(true);

  try {
    const { data, error } = await supabase
      .from("locations")
      .select("id, city, state_code, country")
      .or(
        `city.ilike.%${term}%,country.ilike.%${term}%,state_code.ilike.%${term}%`
      )
      .limit(8);

    if (error) {
      console.error(error);
      return;
    }

    setLocationResults(data ?? []);
  } finally {
    setLocationSearching(false);
  }
}

    async function loadNearbyLeaders() {
    if (!signedIn || verified !== true || !userId) return;

    setNearbyLoading(true);

    try {
      const meRes = await supabase
        .from("profiles")
        .select("id, location_id, locations:location_id (city,country,region,state_code,continent)")
        .eq("id", userId)
        .maybeSingle();

      if (meRes.error) {
        console.error("loadNearbyLeaders meRes error:", meRes.error);
        setCityLeaders([]);
        setStateLeaders([]);
        setCountryLeaders([]);
        return;
      }

      const myLoc = (meRes.data as any)?.locations ?? null;

      const city = myLoc?.city ? String(myLoc.city).trim() : "";
      const stateCode = myLoc?.state_code ? String(myLoc.state_code).trim() : "";
      const country = myLoc?.country ? String(myLoc.country).trim() : "";

      if (!country) {
        setCityLeaders([]);
        setStateLeaders([]);
        setCountryLeaders([]);
        return;
      }

      const { data, error } = await supabase
        .from("v_public_geo_leaderboard_month")
        .select("*");

      if (error) {
        console.error("loadNearbyLeaders data error:", error);
        setCityLeaders([]);
        setStateLeaders([]);
        setCountryLeaders([]);
        return;
      }

      const rows = ((data ?? []) as any[]).map((r) => ({
        ...r,
        wins: Number(r.wins ?? 0),
        losses: Number(r.losses ?? 0),
        breakevens: Number(r.breakevens ?? 0),
        total_trades: Number(r.total_trades ?? 0),
        net_wins: Number(r.net_wins ?? 0),
        win_rate: Number(r.win_rate ?? 0),
        pnl: Number(r.pnl ?? 0),
      })) as GeoLeaderboardRow[];

      const sorter = (a: GeoLeaderboardRow, b: GeoLeaderboardRow) => {
        if (b.pnl !== a.pnl) return b.pnl - a.pnl;
        if (b.net_wins !== a.net_wins) return b.net_wins - a.net_wins;
        if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
        if (b.total_trades !== a.total_trades) return b.total_trades - a.total_trades;
        return a.display_name.localeCompare(b.display_name);
      };

      const cityRows = rows
        .filter(
          (r) =>
            (r.city ?? "").trim() === city &&
            (r.country ?? "").trim() === country
        )
        .sort(sorter)
        .slice(0, 5);

      const stateRows = rows
        .filter(
          (r) =>
            (r.state_code ?? "").trim() === stateCode &&
            (r.country ?? "").trim() === country
        )
        .sort(sorter)
        .slice(0, 5);

      const countryRows = rows
        .filter((r) => (r.country ?? "").trim() === country)
        .sort(sorter)
        .slice(0, 10);

      setCityLeaders(cityRows);
      setStateLeaders(stateRows);
      setCountryLeaders(countryRows);
    } finally {
      setNearbyLoading(false);
    }
  }

  async function loadSummaryCards() {
    if (!signedIn || verified !== true || !userId) return;

    const today = todayISO();

    const todayRes = await supabase
      .from("v_my_calendar_daily")
      .select("day_total")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (todayRes.error) console.error(todayRes.error);
    setTodayTotal(Number((todayRes.data as any)?.day_total ?? 0));

    const d0 = new Date();
    const start30 = addDays(d0, -29);
    const start30ISO = toISODate(start30);

    const last30Res = await supabase
      .from("v_my_calendar_daily")
      .select("day_total,date")
      .eq("user_id", userId)
      .gte("date", start30ISO)
      .lte("date", today);

    if (last30Res.error) console.error(last30Res.error);
    const sum30 = (last30Res.data ?? []).reduce((acc: number, r: any) => acc + Number(r.day_total ?? 0), 0);
    setLast30Total(sum30);

    const allTimeRes = await supabase.from("subscriber_submissions").select("amount").eq("user_id", userId);
    if (allTimeRes.error) console.error(allTimeRes.error);
    const sumAll = (allTimeRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount ?? 0), 0);
    setAllTimeTotal(sumAll);

    const sessRes = await supabase.from("subscriber_submissions").select("session, amount").eq("user_id", userId);
    if (sessRes.error) console.error(sessRes.error);

    let tok = 0,
      lon = 0,
      ny = 0;
    (sessRes.data ?? []).forEach((r: any) => {
      const amt = Number(r.amount ?? 0);
      const s = String(r.session) as Session;
      if (s === "tokyo") tok += amt;
      if (s === "london") lon += amt;
      if (s === "nyc") ny += amt;
    });

    setTokyoTotal(tok);
    setLondonTotal(lon);
    setNycTotal(ny);
  }

  async function refreshAll() {
  setError(null);
  setStatus(null);
  await Promise.all([
    loadSummaryCards(),
    loadCalendar(),
    loadYtdExtremes(),
    loadLocalCommunityCounts(),
    loadNearbyLeaders(),
    loadCountryHeatMap(),
    loadUSStateHeatMap(),
    loadVisibilityPreference(),
  ]);
}

  useEffect(() => {
    if (!signedIn || verified !== true || !userId) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, verified, userId, calendarRange.startISO, calendarRange.endISO, monthCursor]);

  // Auto-select today (only once we have calendar data and nothing selected yet)
  useEffect(() => {
    if (!signedIn || verified !== true || !userId) return;
    if (selectedISO) return;
    if (dailyTotals.size === 0 && dayHasEntry.size === 0) return;

    const t = todayISO();
    setSelectedISO(t);
    loadDayBreakdown(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyTotals, dayHasEntry, signedIn, verified, userId]);

  // -------------------------
  // Day breakdown (no-entry vs net-0) + safe save
  // -------------------------
  async function loadDayBreakdown(dateISO: string) {
    if (!signedIn || verified !== true || !userId) return;

    setDayLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscriber_submissions")
        .select("session, amount")
        .eq("user_id", userId)
        .eq("date", dateISO);

      if (error) {
        console.error(error);
        setError(error.message);
        return;
      }

      let tok = 0,
        lon = 0,
        ny = 0;
      let tokHas = false,
        lonHas = false,
        nyHas = false;

      (data ?? []).forEach((r: any) => {
        const s = String(r.session).toLowerCase();
        const amt = Number(r.amount ?? 0);
        if (s === "tokyo") {
          tokHas = true;
          tok += amt;
        }
        if (s === "london") {
          lonHas = true;
          lon += amt;
        }
        if (s === "nyc") {
          nyHas = true;
          ny += amt;
        }
      });

      setDayTokVal(tok);
      setDayLonVal(lon);
      setDayNycVal(ny);

      setHasTok(tokHas);
      setHasLon(lonHas);
      setHasNyc(nyHas);

      // - no entry => blank
      // - entry exists => show exact value (including 0)
      setDayTok(tokHas ? String(tok) : "");
      setDayLon(lonHas ? String(lon) : "");
      setDayNyc(nyHas ? String(ny) : "");

      setDirtyTok(false);
      setDirtyLon(false);
      setDirtyNyc(false);
    } finally {
      setDayLoading(false);
    }
  }

  async function upsertOrDelete(dateISO: string, session: Session, amt: number | null) {
    if (!userId) throw new Error("Missing userId");

    if (amt === null) {
      const { error } = await supabase
        .from("subscriber_submissions")
        .delete()
        .eq("user_id", userId)
        .eq("date", dateISO)
        .eq("session", session);

      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("subscriber_submissions")
      .upsert({ user_id: userId, date: dateISO, session, amount: amt }, { onConflict: "user_id,date,session" });

    if (error) throw error;
  }

  async function saveDayEdits() {
    if (!selectedISO) return;
    if (!signedIn || verified !== true || !userId) return;

    setError(null);
    setStatus(null);
    setDaySaving(true);

    try {
      const tok = parseAmountOrNull(dayTok);
      const lon = parseAmountOrNull(dayLon);
      const nyc = parseAmountOrNull(dayNyc);

      if (dirtyTok && dayTok.trim() !== "" && tok === null) return toastErr("Tokyo amount must be a number.");
      if (dirtyLon && dayLon.trim() !== "" && lon === null) return toastErr("London amount must be a number.");
      if (dirtyNyc && dayNyc.trim() !== "" && nyc === null) return toastErr("NYC amount must be a number.");

      const savedDate = selectedISO;

const ops: Promise<void>[] = [];
const changedSessions: Session[] = [];

if (dirtyTok) {
  ops.push(upsertOrDelete(savedDate, "tokyo", tok));
  changedSessions.push("tokyo");
}

if (dirtyLon) {
  ops.push(upsertOrDelete(savedDate, "london", lon));
  changedSessions.push("london");
}

if (dirtyNyc) {
  ops.push(upsertOrDelete(savedDate, "nyc", nyc));
  changedSessions.push("nyc");
}

if (ops.length === 0) return toastOk("No changes");

await Promise.all(ops);

/*
 * Check Discord eligibility for each changed session.
 * This runs after the database save, but a Discord problem
 * will never make the member's trade save appear to fail.
 */
void Promise.allSettled(
  changedSessions.map(async (session) => {
    const { data, error: publishError } =
      await supabase.functions.invoke("post-member-win", {
        body: {
          date: savedDate,
          session,
        },
      });

    if (publishError) {
      console.error(
        `post-member-win failed for ${session}:`,
        publishError
      );
      return;
    }

    console.info(
      `post-member-win result for ${session}:`,
      data
    );
  })
);

toastOk("Saved");
setStatus("Saved ✅");

await Promise.all([
  loadDayBreakdown(savedDate),
  refreshAll(),
]);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Failed to save day edits.";
      setError(msg);
      toastErr(msg);
    } finally {
      setDaySaving(false);
    }
  }

  // -------------------------
  // Keyboard controls:
  // - Enter = save
  // - Shift+Enter = save + next day
  // - Esc = close drawer
  // - Left/Right arrows = previous/next day (drawer open, not typing)
  // - Ctrl/Cmd+S = save
  // -------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!signedIn || verified !== true) return;

      if (e.key === "Escape") {
        if (!drawerOpen) return;
        e.preventDefault();
        closeDrawer();
        setHoveredISO(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (!daySaving && !dayLoading && hasUnsaved) saveDayEdits();
        return;
      }

      if (e.key === "Enter" && !isTypingTarget(e.target)) {
        if (!drawerOpen) return;
        e.preventDefault();
        if (!daySaving && !dayLoading && hasUnsaved) {
          if (e.shiftKey) {
            (async () => {
              await saveDayEdits();
              shiftSelectedDay(+1);
            })();
          } else {
            saveDayEdits();
          }
        }
        return;
      }

      if (!drawerOpen) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftSelectedDay(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftSelectedDay(+1);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, verified, drawerOpen, selectedISO, daySaving, dayLoading, hasUnsaved, dayTok, dayLon, dayNyc]);

  // -------------------------
  // Calendar grid + derived month insights
  // -------------------------
  const holidayMap = useMemo(() => usFederalHolidayMap(monthCursor.getFullYear()), [monthCursor]);

  const monthBestWorst = useMemo(() => {
    let bestISO: string | null = null;
    let worstISO: string | null = null;
    let bestVal = -Infinity;
    let worstVal = Infinity;

    dailyTotals.forEach((val, iso) => {
      const d = new Date(iso + "T00:00:00");
      if (d.getMonth() !== monthCursor.getMonth()) return;
      if (!dayHasEntry.has(iso)) return;

      const n = Number(val ?? 0);
      if (n > bestVal) {
        bestVal = n;
        bestISO = iso;
      }
      if (n < worstVal) {
        worstVal = n;
        worstISO = iso;
      }
    });

    return {
      best: bestISO ? { iso: bestISO, val: Number(dailyTotals.get(bestISO) ?? 0) } : null,
      worst: worstISO ? { iso: worstISO, val: Number(dailyTotals.get(worstISO) ?? 0) } : null,
    };
  }, [dailyTotals, dayHasEntry, monthCursor]);

const monthEquityData = useMemo<EquityDatum[]>(() => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  // Use only dates containing an actual submission.
  // This prevents weekends, future dates, and empty days from
  // stretching the chart into long flat sections.
  const reportedDates = Array.from(dayHasEntry)
    .filter((iso) => {
      const d = new Date(`${iso}T00:00:00`);

      return (
        d.getFullYear() === year &&
        d.getMonth() === month
      );
    })
    .sort((a, b) => a.localeCompare(b));

  let cumulative = 0;

  return reportedDates.map((iso) => {
    const daily = Number(dailyTotals.get(iso) ?? 0);
    cumulative += daily;

    return {
      iso,
      daily,
      cumulative,
    };
  });
}, [dailyTotals, dayHasEntry, monthCursor]);

const equityChart = useMemo(
  () => buildEquityChartModel(monthEquityData),
  [monthEquityData]
);

const equityLastPoint =
  equityChart.points.length > 0
    ? equityChart.points[equityChart.points.length - 1]
    : null;

const equityHoverPoint = useMemo(() => {
  if (!hoveredISO) return null;

  return (
    equityChart.points.find(
      (point) => point.iso === hoveredISO
    ) ?? null
  );
}, [equityChart.points, hoveredISO]);

// This is the true cumulative result for the displayed month.
// The old calculation accidentally subtracted the first day.
const monthDelta = useMemo(() => {
  if (!monthEquityData.length) return 0;

  return monthEquityData[monthEquityData.length - 1].cumulative;
}, [monthEquityData]);

function updateEquityHover(
  event: React.PointerEvent<SVGSVGElement>
) {
  if (!equityChart.points.length) return;

  const rect = event.currentTarget.getBoundingClientRect();

  const pointerX = clamp(
    ((event.clientX - rect.left) / rect.width) *
      equityChart.w,
    equityChart.padX,
    equityChart.w - equityChart.padX
  );

  let nearest = equityChart.points[0];
  let nearestDistance = Math.abs(nearest.x - pointerX);

  for (const point of equityChart.points) {
    const distance = Math.abs(point.x - pointerX);

    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  // Reusing hoveredISO automatically highlights the matching
  // calendar cell below. Calendar hover also highlights the chart.
  setHoveredISO(nearest.iso);
}

  const calendarRangeDays = useMemo(() => {
    const start = new Date(calendarRange.startISO + "T00:00:00");
    const end = new Date(calendarRange.endISO + "T00:00:00");
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d));
    return days;
  }, [calendarRange.startISO, calendarRange.endISO]);

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < calendarRangeDays.length; i += 7) rows.push(calendarRangeDays.slice(i, i + 7));
    return rows;
  }, [calendarRangeDays]);

  // -------------------------
  // UI
  // -------------------------
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto", color: "white" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 18,
            right: 18,
            zIndex: 9999,
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${THEME.borderStrong}`,
            background: "rgba(10,10,10,0.88)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            fontWeight: 800,
            fontSize: 13,
            color: toast.type === "ok" ? THEME.green : THEME.red,
            maxWidth: 360,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 8, lineHeight: "34px" }}>
            <span style={{ color: THEME.gold, fontWeight: 900 }}>The Kingdm</span>
            <div style={{ marginTop: 6, opacity: 0.95, fontWeight: 900 }}>Subscriber Dashboard</div>
          </h1>
          <p style={{ opacity: 0.75, marginBottom: 18 }}>Your performance overview + calendar.</p>
        </div>
      
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{gap: 10}}><TopNav currentPath="/dashboard" />           

          {signedIn ? (
            <>
              <button onClick={signOut} style={btn(false)}>
                Sign out
              </button>
              <button onClick={refreshAll} style={btn(false)} disabled={calendarLoading}>
                {calendarLoading ? "Loading..." : "Refresh"}
              </button>

            </>
          ) : (
            <button onClick={signIn} style={btn(true)}>
              Sign in with Discord
            </button>
          )}
          
          </div>
        </div>
      </div>

      {status && <div style={{ color: THEME.green, marginBottom: 10 }}>{status}</div>}
      {error && <div style={{ color: THEME.red, marginBottom: 10 }}>{error}</div>}

      {!signedIn && (
  <div style={{ ...panel(), padding: 24, marginTop: 16 }}>
    <div style={{ fontSize: 22, fontWeight: 950, color: THEME.gold }}>
      Welcome to The Kingdm Trade Tracker
    </div>

    <div style={{ marginTop: 8, fontSize: 14, opacity: 0.82 }}>
      Sign in with Discord to unlock your subscriber dashboard.
    </div>

    <ul
      style={{
        marginTop: 16,
        marginBottom: 18,
        paddingLeft: 20,
        lineHeight: "28px",
        opacity: 0.88,
        fontSize: 14,
      }}
    >
      <li>Your Discord role automatically unlocks access</li>
      <li>View your personal trading calendar</li>
      <li>Track Tokyo, London, and NYC session performance</li>
      <li>Compare your progress with the community</li>
      <li>See regional activity and nearby trader rankings</li>
    </ul>

    <button
      onClick={signIn}
      style={{
        ...btn(true),
        padding: "12px 18px",
        fontSize: 15,
        fontWeight: 900,
        color: THEME.gold,
        borderColor: "rgba(215,177,74,0.42)",
        boxShadow: `0 0 22px ${THEME.goldSoft}`,
      }}
    >
      Sign in with Discord
    </button>
  </div>
)}

      {signedIn && verified === false && (
        <div style={panel()}>
          You’re signed in, but you don’t have the required Discord role.
          <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>If you *do* have the role, sign out and sign back in.</div>
        </div>
      )}

      {signedIn && verified !== true && verified !== false && <div style={panel()}>Checking your role…</div>}

      {signedIn && verified === true && (
        <>

          <div style={{ height: 16 }} />

          {/* Summary cards */}
          <div style={panel()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <Card title="Today" value={fmtMoney(todayTotal)} />
              <Card title="Last 30 days" value={fmtMoney(last30Total)} />
              <Card title="All-time" value={fmtMoney(allTimeTotal)} />

            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <Card title="Tokyo (lifetime)" value={fmtMoney(tokyoTotal)} />
              <Card title="London (lifetime)" value={fmtMoney(londonTotal)} />
              <Card title="NYC (lifetime)" value={fmtMoney(nycTotal)} />
            </div>
          </div>

          <div style={{ height: 16 }} />

          {/* Calendar */}
          <div style={panel()}>
            {/* Calendar Header */}

<div style={{ display: "grid", gap: 12 }}>
  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
    <div style={{ fontSize: 18, fontWeight: 900 }}>Calendar</div>
    <div
      style={{
        fontSize: 24,
        fontWeight: 950,
        color: THEME.gold,
        letterSpacing: 0.8,
        textShadow: "0 10px 24px rgba(0,0,0,0.45)",
      }}
    >
      {monthCursor.getFullYear()}
    </div>
  </div>

  <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
  }}
>
    <MetricPill
      kind="best"
      label="Best [Day]"
      iso={monthBestWorst.best?.iso ?? null}
      val={monthBestWorst.best?.val ?? null}
      onClick={(iso) => openDay(iso)}
    />
    <MetricPill
      kind="worst"
      label="Worst [Day]"
      iso={monthBestWorst.worst?.iso ?? null}
      val={monthBestWorst.worst?.val ?? null}
      onClick={(iso) => openDay(iso)}
    />
    <MetricPill
      kind="best"
      label="Best [YTD]"
      iso={bestYtd?.iso ?? null}
      val={bestYtd?.val ?? null}
      onClick={(iso) => openDay(iso)}
    />
    <MetricPill
      kind="worst"
      label="Worst [YTD]"
      iso={worstYtd?.iso ?? null}
      val={worstYtd?.val ?? null}
      onClick={(iso) => openDay(iso)}
    />
  </div>

  <div
  style={{
    border: `1px solid ${THEME.border}`,
    borderRadius: 16,
    padding: "12px 14px 10px",
    background:
      "linear-gradient(135deg, rgba(140,95,255,0.045), rgba(215,177,74,0.035))",
    position: "relative",
    overflow: "hidden",
  }}
>
  {/* Equity header */}
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    }}
  >
    <div>
      <div
        style={{
          color: THEME.gold,
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: 0.2,
        }}
      >
        Equity
      </div>

      <div
        style={{
          marginTop: 3,
          fontSize: 11,
          opacity: 0.56,
        }}
      >
        Monthly cumulative P/L • drag to inspect
      </div>
    </div>

    <div
      style={{
        color: monthDelta >= 0 ? THEME.green : THEME.red,
        fontSize: 18,
        fontWeight: 750,
        whiteSpace: "nowrap",
      }}
    >
      {monthDelta >= 0 ? "+" : ""}
      {fmtMoneyCompact(monthDelta)}
    </div>
  </div>

  {/* Interactive equity chart */}
  <div
    style={{
      position: "relative",
      height: 126,
      marginTop: 4,
    }}
  >
    <svg
      width="100%"
      height="118"
      viewBox={`0 0 ${equityChart.w} ${equityChart.h}`}
      preserveAspectRatio="none"
      style={{
        display: "block",
        width: "100%",
        height: 118,
        cursor: equityChart.points.length
          ? "crosshair"
          : "default",
        touchAction: "pan-y",
        overflow: "visible",
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(
          event.pointerId
        );

        updateEquityHover(event);
      }}
      onPointerMove={updateEquityHover}
      onPointerUp={(event) => {
        if (
          event.currentTarget.hasPointerCapture?.(
            event.pointerId
          )
        ) {
          event.currentTarget.releasePointerCapture?.(
            event.pointerId
          );
        }
      }}
      onPointerLeave={() => setHoveredISO(null)}
    >
      <defs>
        {/* Subtle area under the curve */}
        <linearGradient
          id="eqFillSharp"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="rgba(215,177,74,0.20)"
          />
          <stop
            offset="100%"
            stopColor="rgba(0,0,0,0)"
          />
        </linearGradient>

        {/* Purple-to-gold laser gradient */}
        <linearGradient
          id="eqLaserLine"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop
            offset="0%"
            stopColor="rgba(140,95,255,1)"
          />
          <stop
            offset="55%"
            stopColor="rgba(215,177,74,0.88)"
          />
          <stop
            offset="100%"
            stopColor={THEME.gold}
          />
        </linearGradient>

        {/* Glow only sits behind the sharp line */}
        <filter
          id="eqLaserGlow"
          x="-20%"
          y="-50%"
          width="140%"
          height="200%"
        >
          <feGaussianBlur
            stdDeviation="1.8"
            result="blur"
          />
        </filter>
      </defs>

      {/* Zero reference line */}
      <line
        x1={equityChart.padX}
        x2={equityChart.w - equityChart.padX}
        y1={equityChart.zeroY}
        y2={equityChart.zeroY}
        stroke="rgba(255,255,255,0.075)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {/* Faint gradient area */}
      {equityChart.areaPoints && (
        <polygon
          points={equityChart.areaPoints}
          fill="url(#eqFillSharp)"
          opacity="0.32"
        />
      )}

      {/* Soft glow underlay */}
      {equityChart.linePoints && (
        <polyline
          points={equityChart.linePoints}
          fill="none"
          stroke="url(#eqLaserLine)"
          strokeWidth="5.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.22"
          filter="url(#eqLaserGlow)"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Tight laser foreground line */}
      {equityChart.linePoints && (
        <polyline
          points={equityChart.linePoints}
          fill="none"
          stroke="url(#eqLaserLine)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Latest reported point */}
      {equityLastPoint && (
        <>
          <circle
            cx={equityLastPoint.x}
            cy={equityLastPoint.y}
            r="7"
            fill={THEME.goldSoft}
            opacity="0.58"
            vectorEffect="non-scaling-stroke"
          />

          <circle
            cx={equityLastPoint.x}
            cy={equityLastPoint.y}
            r="2.8"
            fill={THEME.gold}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {/* Hover guide */}
      {equityHoverPoint && (
        <>
          <line
            x1={equityHoverPoint.x}
            x2={equityHoverPoint.x}
            y1={equityChart.padY}
            y2={equityChart.h - equityChart.padY}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />

          <circle
            cx={equityHoverPoint.x}
            cy={equityHoverPoint.y}
            r="6"
            fill="rgba(8,8,10,0.95)"
            stroke={THEME.gold}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />

          <circle
            cx={equityHoverPoint.x}
            cy={equityHoverPoint.y}
            r="2.4"
            fill={THEME.gold}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>

    {/* HTML tooltip */}
    {equityHoverPoint && (
      <div
        style={{
          position: "absolute",
          top: 5,
          left: `${(
            (equityHoverPoint.x / equityChart.w) *
            100
          ).toFixed(2)}%`,
          transform:
            equityHoverPoint.x <
            equityChart.w * 0.2
              ? "translateX(0)"
              : equityHoverPoint.x >
                equityChart.w * 0.8
              ? "translateX(-100%)"
              : "translateX(-50%)",
          pointerEvents: "none",
          minWidth: 180,
          padding: "8px 10px",
          borderRadius: 11,
          border: `1px solid ${THEME.borderStrong}`,
          background: "rgba(8,8,10,0.92)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 10px 26px rgba(0,0,0,0.42)",
          zIndex: 3,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 950,
            color: THEME.gold,
          }}
        >
          {new Date(
            `${equityHoverPoint.iso}T00:00:00`
          ).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </div>

        <div
          style={{
            marginTop: 5,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            fontSize: 11,
          }}
        >
          <span style={{ opacity: 0.68 }}>Day</span>

          <span
            style={{
              color:
                equityHoverPoint.daily >= 0
                  ? THEME.green
                  : THEME.red,
              fontWeight: 950,
            }}
          >
            {fmtMoney(equityHoverPoint.daily)}
          </span>
        </div>

        <div
          style={{
            marginTop: 4,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            fontSize: 11,
          }}
        >
          <span style={{ opacity: 0.68 }}>
            Month total
          </span>

          <span
            style={{
              color:
                equityHoverPoint.cumulative >= 0
                  ? THEME.green
                  : THEME.red,
              fontWeight: 950,
            }}
          >
            {fmtMoney(equityHoverPoint.cumulative)}
          </span>
        </div>
      </div>
    )}
  </div>
</div>

  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      justifyContent: "flex-end",
      flexWrap: "wrap",
    }}
  >
    <button
      onClick={() => setHeatmapMode((v) => !v)}
      style={{
        ...btn(false),
        borderColor: heatmapMode ? THEME.borderStrong : THEME.border,
        boxShadow: heatmapMode ? `0 0 18px ${THEME.purpleSoft}` : "none",
      }}
      title="Toggle heatmap mode"
    >
      {heatmapMode ? "Heatmap: On" : "Heatmap: Off"}
    </button>

    <button
      onClick={() => {
        if (!confirmLoseEdits()) return;
        setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
      }}
      style={btn(false)}
    >
      Prev
    </button>

    <div style={{ fontWeight: 900, minWidth: 160, textAlign: "center", color: THEME.gold }}>
      {monthLabel(monthCursor)}
    </div>

    <button
      onClick={() => {
        if (!confirmLoseEdits()) return;
        setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
      }}
      style={btn(false)}
    >
      Next
    </button>
  </div>
</div>

            <div style={{ height: 12 }} />

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980, tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <th key={d} style={th()}>
                        {d}
                      </th>
                    ))}
                    <th style={{ ...th(), width: 140 }}>Week Total</th>
                  </tr>
                </thead>

                <tbody>
                  {weeks.map((week, idx) => {
                    const weekTotal = week.reduce((acc, day) => acc + Number(dailyTotals.get(toISODate(day)) ?? 0), 0);

                    return (
                      <tr key={idx}>
                        {week.map((day) => {
                          const iso = toISODate(day);
                          const inMonth = day.getMonth() === monthCursor.getMonth();
                          const total = Number(dailyTotals.get(iso) ?? 0);

                          const isToday = iso === todayISO();
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          const isSelected = selectedISO === iso;

                          const hasEntry = dayHasEntry.has(iso);
                          const holidayName = holidayMap.get(iso) ?? null;
                          const isHoliday = !!holidayName;

                          const isBestMonth = monthBestWorst.best?.iso === iso && inMonth;
                          const isWorstMonth = monthBestWorst.worst?.iso === iso && inMonth;

                          const showValue = heatmapMode ? "" : total === 0 ? (hasEntry ? "$0" : "") : fmtMoneyCompact(total);

                          return (
                            <td key={iso} style={tdCell()}>
                              <div
                                onMouseEnter={() => setHoveredISO(iso)}
                                onMouseLeave={() => setHoveredISO((x) => (x === iso ? null : x))}
                                onClick={() => openDay(iso)}
                                style={{
                                  ...dayCellPRO({
                                    inMonth,
                                    isToday,
                                    isWeekend,
                                    total,
                                    hovered: hoveredISO === iso,
                                    selected: isSelected,
                                    hasEntry,
                                    isHoliday,
                                    heatmapMode,
                                    isBest: isBestMonth,
                                    isWorst: isWorstMonth,
                                  }),
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div style={{ fontWeight: 800, opacity: inMonth ? 1 : 0.35 }}>{day.getDate()}</div>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    {isToday && <div style={{ fontSize: 11, opacity: 0.8, color: THEME.gold }}>Today</div>}
                                  </div>
                                </div>
                                {isHoliday && (
                                  <div
                                    title={`${holidayName} • US Markets Closed`}
                                    style={{
                                            marginTop: 6,
                                            lineHeight: "14px",
                                            fontSize: 11,
                                            opacity: 0.85,
                                            color: THEME.gold,
                                            fontWeight: 900,
                                          }}
                                    >
                                      {holidayName}
                                  </div>
                                  )}

                                {(isBestMonth || isWorstMonth) && (hoveredISO === iso || isSelected) && (
                                  <div
                                    title={isBestMonth ? "Best day (Month)" : "Worst day (Month)"}
                                    style={{
                                      position: "absolute",
                                      top: 10,
                                      left: 10,
                                      fontSize: 12,
                                      fontWeight: 900,
                                      opacity: 0.9,
                                      filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
                                      pointerEvents: "none",
                                    }}
                                  >
                                    {isBestMonth ? "🏆" : "💀"}
                                  </div>
                                )}

                                {hasEntry && (
                                  <div
                                    title="Entry exists"
                                    style={{
                                      position: "absolute",
                                      left: 10,
                                      bottom: 10,
                                      width: 7,
                                      height: 7,
                                      borderRadius: 99,
                                      background: THEME.goldSoft,
                                      boxShadow: `0 0 12px ${THEME.purpleSoft}`,
                                      opacity: heatmapMode ? 0.75 : 0.55,
                                    }}
                                  />
                                )}

                                <div
                                  title={hasEntry ? fmtMoney(total) : total === 0 ? "" : fmtMoney(total)}
                                  style={{
                                    marginTop: "auto",
                                    fontWeight: 900,
                                    fontSize: 16,
                                    lineHeight: "20px",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    textAlign: "right",
                                    width: "100%",
                                    opacity: inMonth ? 1 : 0.5,
                                    color: total > 0 ? THEME.green : total < 0 ? THEME.red : "inherit",
                                  }}
                                >
                                  {showValue}
                                </div>

                                {hoveredISO === iso && (hasEntry || total !== 0) && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: 10,
                                      right: 10,
                                      padding: "6px 8px",
                                      borderRadius: 10,
                                      border: `1px solid ${THEME.borderStrong}`,
                                      background: "rgba(10,10,10,0.85)",
                                      backdropFilter: "blur(6px)",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      color: pnlTextColor(total),
                                      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                                      pointerEvents: "none",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {hasEntry ? fmtMoney(total) : total === 0 ? "No entry" : fmtMoney(total)}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td style={tdCell()}>
                          <div style={weekTotalCell()}>
                            <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800, color: THEME.gold }}>Week</div>
                            <div
                              title={fmtMoney(weekTotal)}
                              style={{
                                marginTop: 6,
                                fontWeight: 900,
                                textAlign: "right",
                                width: "100%",
                                color: weekTotal > 0 ? THEME.green : weekTotal < 0 ? THEME.red : "inherit",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {fmtMoneyCompact(weekTotal)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Week totals include all days shown in that row (including the greyed-out days from adjacent months). Holidays are lightly shaded.
            </div>
          </div>
        </>
      )}

                  {signedIn && verified === true && (
        <>
          {/* Right Drawer */}
      <div
        onClick={() => closeDrawer()}
        style={{
          position: "fixed",
          inset: 0,
          background: drawerOpen ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
          pointerEvents: drawerOpen ? "auto" : "none",
          opacity: drawerOpen ? 1 : 0,
          transition: "opacity 140ms ease",
          zIndex: 9000,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: "min(520px, 92vw)",
            borderLeft: `1px solid ${THEME.border}`,
            background: "rgba(10,10,10,0.92)",
            backdropFilter: "blur(10px)",
            boxShadow: "-20px 0 50px rgba(0,0,0,0.55)",
            transform: drawerOpen ? "translateX(0)" : "translateX(18px)",
            transition: "transform 160ms ease",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: 16, borderBottom: `1px solid ${THEME.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800, color: THEME.gold }}>Day</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedISO ?? "—"}</div>

              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>

                <button
                  onClick={() => closeDrawer()}
                  style={{
                    ...btn(false),
                    borderColor: THEME.border,
                    background: "rgba(255,255,255,0.04)",
                  }}
                  title="Esc"
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <MiniCard title="Tokyo" value={dayLoading ? "…" : !hasTok ? "—" : fmtMoney(dayTokVal)} accent="tokyo" />
              <MiniCard title="London" value={dayLoading ? "…" : !hasLon ? "—" : fmtMoney(dayLonVal)} accent="london" />
              <MiniCard title="NYC" value={dayLoading ? "…" : !hasNyc ? "—" : fmtMoney(dayNycVal)} accent="nyc" />
              <MiniCard title="Day Total" value={dayLoading ? "…" : !hasAnyEntryForSelected ? "—" : fmtMoney(dayTokVal + dayLonVal + dayNycVal)} />
            </div>
          </div>

          <div style={{ padding: 16, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Daily Entry</div>

              <button
                onClick={saveDayEdits}
                disabled={daySaving || dayLoading || !hasUnsaved}
                style={{
                  ...btn(true),
                  borderColor: hasUnsaved ? "rgba(215,177,74,0.35)" : THEME.border,
                  boxShadow: hasUnsaved ? `0 0 18px ${THEME.purpleSoft}` : "none",
                  opacity: daySaving || dayLoading ? 0.8 : 1,
                  transition: "all 120ms ease",
                  transform: hasUnsaved ? "translateY(-1px)" : "none",
                }}
                title={!hasUnsaved ? "No changes to save" : "Enter to save • Shift+Enter save+next • Ctrl/Cmd+S save"}
              >
                {daySaving ? "Saving..." : "Save Day"}
              </button>
              
            </div>
<div style={{
  marginTop: 8,
  fontSize: 11,
  opacity: 0.55
}}>
  Blank input removes that session entry.

</div>
            <div style={{ height: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <MiniEditCard
                title="Tokyo"
                value={dayTokVal}
                input={dayTok}
                dirty={dirtyTok}
                hasEntry={hasTok}
                accent="tokyo"
                onChange={(v) => {
                  setDayTok(v);
                  setDirtyTok(true);
                }}
                onClear={() => {
                  setDayTok("");
                  setDirtyTok(true);
                }}
              />

              <MiniEditCard
                title="London"
                value={dayLonVal}
                input={dayLon}
                dirty={dirtyLon}
                hasEntry={hasLon}
                accent="london"
                onChange={(v) => {
                  setDayLon(v);
                  setDirtyLon(true);
                }}
                onClear={() => {
                  setDayLon("");
                  setDirtyLon(true);
                }}
              />

              <MiniEditCard
                title="NYC"
                value={dayNycVal}
                input={dayNyc}
                dirty={dirtyNyc}
                hasEntry={hasNyc}
                accent="nyc"
                onChange={(v) => {
                  setDayNyc(v);
                  setDirtyNyc(true);
                }}
                onClear={() => {
                  setDayNyc("");
                  setDirtyNyc(true);
                }}
              />


            </div>
          </div>
        </div>
      </div>

      <div
  style={{
    border: `1px solid ${THEME.border}`,
    borderRadius: 18,
    padding: 16,
    background: THEME.panel,
  }}
>
  {/* Header */}
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div>
      <div style={{ fontWeight: 900, fontSize: 16 }}>
        Top Traders Near You
      </div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
  {cityLeaders.length > 0 || countryLeaders.length > 0
    ? `${cityLeaders.length} in your city • ${countryLeaders.length} in your country`
    : "See who’s leading in your area"}
</div>
    </div>

    <button
      onClick={() => setShowNearbyLeaders(v => !v)}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${THEME.border}`,
        background: showNearbyLeaders ? THEME.goldSoft : "transparent",
        color: showNearbyLeaders ? THEME.gold : "white",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      {showNearbyLeaders ? "Hide" : "Show"}
    </button>
  </div>

  {/* Content */}
  {showNearbyLeaders && (
    <>
      <div style={{ height: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <NearbyLeadersCard
          title={myCity ? `Top in ${myCity}` : "Top in Your City"}
          subtitle={
            myCity && myCountry
              ? `${myCity}${myStateCode ? `, ${myStateCode}` : ""}, ${myCountry}`
              : "Local city leaders"
          }
          rows={cityLeaders}
        />

        <NearbyLeadersCard
          title={myStateCode ? `Top in ${myStateCode}` : "Top in Your State"}
          subtitle={
            myStateCode && myCountry
              ? `${myStateCode}, ${myCountry}`
              : "State leaders"
          }
          rows={stateLeaders}
        />

        <NearbyLeadersCard
          title={myCountry ? `Top in ${myCountry}` : "Top in Your Country"}
          subtitle={myCountry ?? "Country leaders"}
          rows={countryLeaders}
        />
      </div>
    </>
  )}
</div>

<div style={panel()}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    }}
  >
    <div>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Kingdm Global Activity Map</div>
      <div style={{ fontSize: 13, opacity: 0.72 }}>
        Month-to-date country activity across the community
      </div>
    </div>

    <button
      onClick={() => setShowWorldMap((v) => !v)}
      style={{
        ...btn(false),
        borderColor: showWorldMap ? THEME.borderStrong : THEME.border,
        boxShadow: showWorldMap ? `0 0 18px ${THEME.purpleSoft}` : "none",
      }}
    >
      {showWorldMap ? "Hide Map" : "Show Map"}
    </button>
  </div>

  {showWorldMap && (
  <>
    <div style={{ height: 14 }} />

    {myCountry === "United States" ? (
      <USStateHeatMap
        presenceRows={usStatePresenceRows}
        performanceRows={usStatePerformanceRows}
      />
    ) : (
      <CountryHeatMap presenceRows={countryHeatRows} />
    )}

    <div style={{ height: 16 }} />
  </>
)}
</div>
<div style={{ height: 20 }} />

<h2
  style={{
    color: THEME.gold,
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 12,
  }}
>
  Profile & Privacy
</h2>

                    {/* Local community counts (privacy-safe) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={miniCard()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, color: THEME.gold }}>Your area</div>
                {cityBadge && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: `1px solid ${THEME.border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: cityActive ? THEME.green : "rgba(255,255,255,0.82)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cityBadge}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 900 }}>
                {areaLabel}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  opacity: 0.88,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: cityActive ? THEME.green : "rgba(255,255,255,0.75)",
                }}
              >
                <span style={pulseDotStyle(cityActive)} />
                <span>{cityMessage}</span>
                <button
  type="button"
  onClick={() => {
    setLocationSearch(areaLabel !== "Not set" ? areaLabel : "");
setSelectedLocation(null);
setLocationResults([]);
setShowLocationEditor((v) => !v);
  }}
  style={{
    marginTop: 10,
    ...btn(false),
    padding: "6px 10px",
    fontSize: 12,
  }}
>
  {showLocationEditor ? "Cancel" : "Edit Location"}
</button>
              </div>
            </div>

            <div style={miniCard()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, color: THEME.gold }}>Country</div>
                {countryBadge && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: `1px solid ${THEME.border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: countryActive ? THEME.green : "rgba(255,255,255,0.82)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {countryBadge}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 900 }}>
                {myCountry ?? "Not set"}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  opacity: 0.88,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: countryActive ? THEME.green : "rgba(255,255,255,0.75)",
                }}
              >
                <span style={pulseDotStyle(countryActive)} />
                <span>{countryMessage}</span>
              </div>
            </div>
          </div>

          {showLocationEditor && (
  <div style={{ ...panel(), marginBottom: 14 }}>
    <div style={{ fontWeight: 900, fontSize: 16, color: THEME.gold }}>
      Profile Location
    </div>

    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
      Used for country, city, nearby trader, and heatmap rankings.
    </div>

    <div
      style={{
        marginTop: 14,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr auto",
        gap: 10,
        alignItems: "end",
      }}
    >

      <div style={{ position: "relative" }}>
  <input
    value={locationSearch}
    onChange={(e) => {
      setSelectedLocation(null);
      searchLocations(e.target.value);
    }}
    placeholder="Search city, state, country..."
    style={{
      width: "100%",
      padding: "12px",
      borderRadius: 12,
      border: `1px solid ${THEME.borderStrong}`,
      background: "rgba(255,255,255,0.03)",
      color: "white",
      fontWeight: 800,
    }}
  />

  {locationResults.length > 0 && (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        marginTop: 6,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        background: "rgba(10,10,10,0.98)",
        overflow: "hidden",
        zIndex: 100,
        boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
      }}
    >
      {locationResults.map((loc) => (
        <button
          key={loc.id}
          type="button"
          onClick={() => {
            setSelectedLocation(loc);
            setLocationSearch(
              `${loc.city}, ${loc.state_code ?? ""}, ${loc.country}`
            );
            setLocationResults([]);
          }}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            border: "none",
            borderBottom: `1px solid ${THEME.border}`,
            background:
              selectedLocation?.id === loc.id
                ? THEME.goldSoft
                : "transparent",
            color: "white",
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 800 }}>
            {loc.city}
            {loc.state_code ? `, ${loc.state_code}` : ""}
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {loc.country}
          </div>
        </button>
      ))}
    </div>
  )}
</div>


      <button
        type="button"
        onClick={async () => {
  if (!selectedLocation) {
    toastErr("Select a location first.");
    return;
  }

  setLocationSaving(true);

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ location_id: selectedLocation.id })
      .eq("id", userId);

    if (error) throw error;

    toastOk("Location saved");
    setShowLocationEditor(false);

    await Promise.all([
      loadLocalCommunityCounts(),
      loadNearbyLeaders(),
      loadCountryHeatMap(),
    ]);
  } catch (e: any) {
    console.error(e);
    toastErr(e?.message ?? "Failed to save location.");
  } finally {
    setLocationSaving(false);
  }
}}
        disabled={locationSaving}
        style={{
          ...btn(true),
          height: 40,
          opacity: locationSaving ? 0.7 : 1,
        }}
      >
        {locationSaving ? "Saving..." : "Save"}
      </button>
    </div>
  </div>
)}

 
<div style={{ ...panel(), marginBottom: 14 }}>
  <div style={{ fontWeight: 900, fontSize: 16, color: THEME.gold }}>
    Public Visibility
  </div>

  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
    Control whether your display name, location, and submitted performance appear in community leaderboards, maps, and nearby trader rankings.
  </div>

  <div
    style={{
      marginTop: 14,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
    }}
  >
    <div>
      <div style={{ fontWeight: 900 }}>
        Show me publicly
      </div>

      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
        You can still use your private dashboard even when this is off.
      </div>
    </div>

    <button
      type="button"
      onClick={toggleLeaderboardVisibility}
      disabled={visibilitySaving}
      style={{
        ...btn(participatesInLeaderboard),
        minWidth: 96,
        opacity: visibilitySaving ? 0.65 : 1,
        color: participatesInLeaderboard ? THEME.gold : "white",
      }}
    >
      {visibilitySaving
        ? "Saving..."
        : participatesInLeaderboard
        ? "Visible"
        : "Hidden"}
    </button>
  </div>
</div>

        </>
      )}
    </main>
  );
}




// -------------------------
// Styles + components
// -------------------------
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

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    borderBottom: `1px solid ${THEME.border}`,
    padding: 8,
    fontSize: 12,
    opacity: 0.9,
    fontWeight: 900,
    color: THEME.gold,
  };
}

function tdCell(): React.CSSProperties {
  return {
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    padding: 8,
    verticalAlign: "top",
    height: 128,
  };
}

function dayCellPRO(opts: {
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  total: number;
  hovered: boolean;
  selected: boolean;
  hasEntry: boolean;
  isHoliday: boolean;
  heatmapMode: boolean;
  isBest: boolean;
  isWorst: boolean;
}): React.CSSProperties {
  const {
    inMonth,
    isToday,
    isWeekend,
    total,
    hovered,
    selected,
    hasEntry,
    isHoliday,
    heatmapMode,
    isBest,
    isWorst,
  } = opts;

  const selectedBorder = "rgba(215,177,74,0.55)";
  const holidayBorder = "rgba(215,177,74,0.22)";
  const selectedShadow =
    "0 0 0 1px rgba(215,177,74,0.30), 0 16px 40px rgba(0,0,0,0.45)";

  const baseBg = inMonth
    ? isWeekend && total === 0 && !hasEntry
      ? "rgba(255,255,255,0.018)"
      : pnlHeatBg(total)
    : "rgba(255,255,255,0.015)";

  const heatBg = inMonth ? pnlHeatBg(total) : "rgba(255,255,255,0.015)";

  const holidayBg =
    "linear-gradient(135deg, rgba(215,177,74,0.10), rgba(215,177,74,0.03))";

  const bg = isHoliday ? holidayBg : heatmapMode ? heatBg : baseBg;

  const overlay = isHoliday
    ? null
    : isBest
    ? "linear-gradient(135deg, rgba(215,177,74,0.10), rgba(0,0,0,0.00))"
    : isWorst
    ? "linear-gradient(135deg, rgba(255,92,92,0.10), rgba(0,0,0,0.00))"
    : null;

  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 12,
    height: "100%",
    width: "100%",
    boxSizing: "border-box",
    background: overlay ? `${overlay}, ${bg}` : bg,

    opacity: inMonth ? 1 : 0.55,
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    position: "relative",

    transition:
      "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
    transform: hovered ? "translateY(-1px)" : "none",

    outline: isToday ? `1px solid ${THEME.borderStrong}` : "none",
    outlineOffset: isToday ? "2px" : undefined,

    borderColor: selected
      ? selectedBorder
      : isHoliday
      ? holidayBorder
      : hovered
      ? THEME.borderStrong
      : THEME.border,

    boxShadow: selected ? selectedShadow : hovered ? pnlGlow(total) : "none",
  };
}

function weekTotalCell(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 12,
    height: "100%",
    width: "100%",
    boxSizing: "border-box",
    background: THEME.panel2,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };
}

function miniCard(accent?: Session): React.CSSProperties {
  const accentMap: Record<Session, string> = {
    tokyo: "rgba(170, 110, 255, 0.55)",
    london: "rgba(90, 180, 255, 0.55)",
    nyc: "rgba(215,177,74,0.55)",
  };

  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    padding: 10,
    background: THEME.panel2,
    boxShadow: accent ? `inset 3px 0 0 ${accentMap[accent]}` : undefined,
  };
}

function MiniCard({ title, value, accent }: { title: string; value: string; accent?: Session }) {
  return (
    <div style={miniCard(accent)}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, color: THEME.gold }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, textAlign: "right" }}>{value}</div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 10, background: THEME.panel2 }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, color: THEME.gold }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function MetricPill(props: { kind: "best" | "worst"; label: string; iso: string | null; val: number | null; onClick: (iso: string) => void }) {
  const isBest = props.kind === "best";
  const isYtd = props.label.includes("YTD");
  const icon = isBest ? (isYtd ? "👑" : "🏆") : isYtd ? "☠️" : "💀";

  const accent = isBest ? THEME.goldSoft : "rgba(255,92,92,0.14)";
  const border = isBest ? "rgba(215,177,74,0.30)" : "rgba(255,92,92,0.28)";
  const valueColor = props.val == null ? "rgba(255,255,255,0.6)" : props.val >= 0 ? THEME.green : THEME.red;

  const disabled = !props.iso;

  return (
    <button
      disabled={disabled}
      onClick={() => props.iso && props.onClick(props.iso)}
      style={{
        ...btn(false),
        padding: "10px 12px",
        borderRadius: 14,
        border: `1px solid ${border}`,
        background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.02))`,
        display: "grid",
        gridTemplateColumns: "34px 1fr",
        gridTemplateRows: "auto auto",
        alignItems: "center",
        columnGap: 8,
        rowGap: 5,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        overflow: "hidden",
        minHeight: 58,
      }}
      title={disabled ? "No entries yet" : "Click to jump to day"}
    >
      <span
        style={{
          fontSize: 22,
          gridRow: "1 / span 2",
          lineHeight: "22px",
          textAlign: "center",
        }}
      >
        {icon}
      </span>

      <span
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 950,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span>{props.label}</span>
        <span style={{ opacity: 0.78, fontWeight: 900 }}>
          {props.iso ? mmdd(props.iso) : "—"}
        </span>
      </span>

      <span
        style={{
          fontSize: 18,
          fontWeight: 950,
          color: valueColor,
          whiteSpace: "nowrap",
          textAlign: "center",
          lineHeight: "20px",
        }}
      >
        {props.val == null ? "—" : fmtMoneyCompact(props.val)}
      </span>
    </button>
  );
}

function MiniEditCard(props: {
  title: string;
  value: number;
  input: string;
  onChange: (v: string) => void;
  onClear: () => void;
  dirty: boolean;
  hasEntry: boolean;
  accent: Session;
}) {
  return (
    <div style={miniCard(props.accent)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, color: THEME.gold }}>{props.title}</div>
          {props.dirty && (
            <div title="Unsaved change" style={{ fontSize: 12, opacity: 0.95, color: "#ffd166" }}>
              ●
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            onClick={props.onClear}
            style={{
              border: `1px solid ${THEME.border}`,
              background: "rgba(255,255,255,0.04)",
              color: "inherit",
              padding: "4px 8px",
              borderRadius: 10,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Clear this session entry (will delete on Save Day)"
          >
            Clear
          </button>
          

          <div style={{ fontSize: 14, fontWeight: 900, textAlign: "right", opacity: props.hasEntry ? 1 : 0.6 }}>
            {props.hasEntry ? fmtMoney(props.value) : "—"}
          </div>
        </div>
      </div>

      <div style={{ height: 10 }} />

      <input
        value={props.input}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="blank = no entry"
        inputMode="decimal"
        style={{
          padding: 10,
          borderRadius: 10,
          border: `1px solid ${THEME.borderStrong}`,
          background: "transparent",
          color: "inherit",
          width: "100%",
          textAlign: "right",
          fontWeight: 900,
        }}
      />
    </div>
  );
}