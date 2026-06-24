"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TopNav from "@/app/components/TopNav";

type Session = "tokyo" | "london" | "nyc";

type SummaryCardKind = "weekly" | "monthly" | null;

type DailyOverallRow = {
  date: string;
  wins: number | null;
  losses: number | null;
  breakevens: number | null;
};

type DailySessionRow = {
  date: string;
  session: Session;
  wins: number | null;
  losses: number | null;
  breakevens: number | null;
};

type TrackerHighlightStats = {
  longestHotStreak: number;
  worstLossStreak: number;
  bestDay: { iso: string; net: number } | null;
  bestWeek: { label: string; net: number } | null;
};

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
  deepRed: "rgba(168, 28, 28, 0.95)",
  blue: "rgba(90, 180, 255, 0.95)",
  purple: "rgba(170, 110, 255, 0.95)",
  tokyoRed: "rgba(255, 92, 92, 0.95)",
};

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nthWeekdayOfMonth(
  year: number,
  month0: number,
  weekday: number,
  nth: number
) {
  const first = new Date(year, month0, 1);
  const firstDow = first.getDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;

  return new Date(year, month0, day);
}

function lastWeekdayOfMonth(
  year: number,
  month0: number,
  weekday: number
) {
  const last = new Date(year, month0 + 1, 0);
  const lastDow = last.getDay();
  const offset = (lastDow - weekday + 7) % 7;

  return new Date(
    year,
    month0,
    last.getDate() - offset
  );
}

function usFederalHolidayMap(year: number) {
  const dates = new Map<string, string>();

  const addObservedHoliday = (
    holiday: Date,
    name: string
  ) => {
    const observed = new Date(holiday);

    // Saturday holidays are observed Friday.
    if (observed.getDay() === 6) {
      observed.setDate(observed.getDate() - 1);
    }

    // Sunday holidays are observed Monday.
    if (observed.getDay() === 0) {
      observed.setDate(observed.getDate() + 1);
    }

    dates.set(toISODate(observed), name);
  };

  addObservedHoliday(
    new Date(year, 0, 1),
    "New Year's Day"
  );

  addObservedHoliday(
    nthWeekdayOfMonth(year, 0, 1, 3),
    "Martin Luther King Jr. Day"
  );

  addObservedHoliday(
    nthWeekdayOfMonth(year, 1, 1, 3),
    "Presidents Day"
  );

  addObservedHoliday(
    lastWeekdayOfMonth(year, 4, 1),
    "Memorial Day"
  );

  addObservedHoliday(
    new Date(year, 5, 19),
    "Juneteenth"
  );

  addObservedHoliday(
    new Date(year, 6, 4),
    "Independence Day"
  );

  addObservedHoliday(
    nthWeekdayOfMonth(year, 8, 1, 1),
    "Labor Day"
  );

  addObservedHoliday(
    nthWeekdayOfMonth(year, 9, 1, 2),
    "Columbus Day"
  );

  addObservedHoliday(
    new Date(year, 10, 11),
    "Veterans Day"
  );

  addObservedHoliday(
    nthWeekdayOfMonth(year, 10, 4, 4),
    "Thanksgiving"
  );

  addObservedHoliday(
    new Date(year, 11, 25),
    "Christmas Day"
  );

  return dates;
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

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function winRatePct(w: number, l: number) {
  const denom = w + l;
  return denom > 0 ? (w / denom) : 0;
}

function startOfCalendarGrid(monthDate: Date) {
  const s = startOfMonth(monthDate);
  const dow = s.getDay();
  return addDays(s, -dow);
}

function endOfCalendarGrid(monthDate: Date) {
  const e = endOfMonth(monthDate);
  const dow = e.getDay();
  return addDays(e, 6 - dow);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: number | null | undefined) {
  return Number(v ?? 0);
}

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

function fmtPct01(v: number, digits = 1) {
  if (!Number.isFinite(v)) return `0.${"0".repeat(digits)}%`;
  return `${(v * 100).toFixed(digits)}%`;
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

function isWeekendDate(d: Date) {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function isWeekendISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return isWeekendDate(d);
}

function previousTradingDateISO(iso: string) {
  let d = new Date(iso + "T00:00:00");
  do {
    d = addDays(d, -1);
  } while (isWeekendDate(d));
  return toISODate(d);
}

function heatBgForDay(w: number, l: number, be: number) {
  const total = Math.max(1, w + l + be);
  const dominance = w - l;
  const rawIntensity = clamp(Math.abs(dominance) / total, 0, 1);
  const directional = Math.pow(rawIntensity, 0.7);
  const sizeIntensity = clamp(total / 15, 0, 1);

  if (dominance === 0) {
    return `rgba(255,255,255,${0.025 + directional * 0.045})`;
  }

  if (dominance > 0) {
    return `rgba(85,255,138,${0.07 + directional * 0.12 + sizeIntensity * 0.12})`;
  }

  return `rgba(255,92,92,${0.07 + directional * 0.12 + sizeIntensity * 0.12})`;
}

function getHotStreakMap(calendarMap: Map<string, DailyOverallRow>) {
  const streakMap = new Map<string, number>();
  const dates = Array.from(calendarMap.keys()).sort();

  let streak = 0;

  for (const iso of dates) {
    const row = calendarMap.get(iso);
    if (!row) continue;

    const w = safeNum(row.wins);
    const l = safeNum(row.losses);
    const be = safeNum(row.breakevens);
    const total = w + l + be;

    // Unreported days do not count and do not break the run.
    if (total <= 0) {
      streakMap.set(iso, 0);
      continue;
    }

    // Any loss breaks the run.
    if (l > 0) {
      streak = 0;
      streakMap.set(iso, 0);
      continue;
    }

    // Any reported day with zero losses continues the run.
    streak += 1;
    streakMap.set(iso, streak);
  }

  return streakMap;
}

type NoLossRuns = Record<"overall" | Session, number>;

function emptyNoLossRuns(): NoLossRuns {
  return {
    overall: 0,
    tokyo: 0,
    london: 0,
    nyc: 0,
  };
}

function hasReportedOutcome(w: number, l: number, be: number) {
  return w + l + be > 0;
}

function getCurrentOverallNoLossRun(rows: DailyOverallRow[]) {
  const cleaned = rows
    .map((r) => ({
      date: String(r.date),
      wins: safeNum(r.wins),
      losses: safeNum(r.losses),
      breakevens: safeNum(r.breakevens),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let streak = 0;

  for (const r of cleaned) {
    if (!hasReportedOutcome(r.wins, r.losses, r.breakevens)) continue;

    if (r.losses > 0) {
      streak = 0;
    } else {
      streak += 1;
    }
  }

  return streak;
}

function getCurrentSessionNoLossRuns(rows: DailySessionRow[]) {
  const runs: Record<Session, number> = {
    tokyo: 0,
    london: 0,
    nyc: 0,
  };

  (["tokyo", "london", "nyc"] as Session[]).forEach((session) => {
    const cleaned = rows
      .filter((r) => r.session === session)
      .map((r) => ({
        date: String(r.date),
        wins: safeNum(r.wins),
        losses: safeNum(r.losses),
        breakevens: safeNum(r.breakevens),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let streak = 0;

    for (const r of cleaned) {
      if (!hasReportedOutcome(r.wins, r.losses, r.breakevens)) continue;

      if (r.losses > 0) {
        streak = 0;
      } else {
        streak += 1;
      }
    }

    runs[session] = streak;
  });

  return runs;
}

function getSessionNoLossRunMaps(
  sessionMap: Map<string, Map<Session, DailySessionRow>>
) {
  const maps: Record<Session, Map<string, number>> = {
    tokyo: new Map<string, number>(),
    london: new Map<string, number>(),
    nyc: new Map<string, number>(),
  };

  (["tokyo", "london", "nyc"] as Session[]).forEach((session) => {
    const rows: Array<{
      date: string;
      wins: number;
      losses: number;
      breakevens: number;
    }> = [];

    sessionMap.forEach((perDay, iso) => {
      const r = perDay.get(session);
      if (!r) return;

      rows.push({
        date: iso,
        wins: safeNum(r.wins),
        losses: safeNum(r.losses),
        breakevens: safeNum(r.breakevens),
      });
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));

    let streak = 0;

    for (const r of rows) {
      if (!hasReportedOutcome(r.wins, r.losses, r.breakevens)) {
        maps[session].set(r.date, 0);
        continue;
      }

      if (r.losses > 0) {
        streak = 0;
        maps[session].set(r.date, 0);
        continue;
      }

      streak += 1;
      maps[session].set(r.date, streak);
    }
  });

  return maps;
}

function sessionMomentumLabel(s: Session) {
  if (s === "tokyo") return "Tokyo";
  if (s === "london") return "London";
  return "NYC";
}

function sessionMomentumColor(s: Session) {
  if (s === "tokyo") return THEME.tokyoRed;
  if (s === "london") return THEME.blue;
  return THEME.purple;
}


function mondayOfISO(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const dow = d.getDay();
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  return addDays(d, -daysSinceMon);
}

function computeTrackerHighlightStats(
  rows: DailyOverallRow[]
): TrackerHighlightStats {
  const cleaned = rows
    .map((r) => ({
      date: String(r.date),
      wins: safeNum(r.wins),
      losses: safeNum(r.losses),
      breakevens: safeNum(r.breakevens),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let longestHotStreak = 0;
  let currentHotStreak = 0;

  let worstLossStreak = 0;
  let currentLossStreak = 0;

  let bestDay: { iso: string; net: number } | null = null;

  const weekly = new Map<
    string,
    { wins: number; losses: number; breakevens: number }
  >();

  let prevActiveIso: string | null = null;

  for (const r of cleaned) {
    const total = r.wins + r.losses + r.breakevens;

    if (total <= 0) continue;

    const net = r.wins - r.losses;

    if (!bestDay || net > bestDay.net) {
      bestDay = { iso: r.date, net };
    }

    const weekMon = toISODate(mondayOfISO(r.date));

    const wk = weekly.get(weekMon) ?? {
      wins: 0,
      losses: 0,
      breakevens: 0,
    };

    wk.wins += r.wins;
    wk.losses += r.losses;
    wk.breakevens += r.breakevens;

    weekly.set(weekMon, wk);

    const consecutive = prevActiveIso
      ? previousTradingDateISO(r.date) === prevActiveIso
      : false;

    if (r.losses === 0) {
      currentHotStreak = consecutive ? currentHotStreak + 1 : 1;
      longestHotStreak = Math.max(longestHotStreak, currentHotStreak);

      currentLossStreak = 0;
    } else {
      currentHotStreak = 0;

      currentLossStreak = consecutive ? currentLossStreak + 1 : 1;

      worstLossStreak = Math.max(worstLossStreak, currentLossStreak);
    }

    prevActiveIso = r.date;
  }

  let bestWeek: { label: string; net: number } | null = null;

  for (const [weekMon, wk] of weekly.entries()) {
    const net = wk.wins - wk.losses;

    const weekFri = toISODate(
      addDays(new Date(weekMon + "T00:00:00"), 4)
    );

    if (!bestWeek || net > bestWeek.net) {
      bestWeek = {
        label: `${weekMon} → ${weekFri}`,
        net,
      };
    }
  }

  return {
    longestHotStreak,
    worstLossStreak,
    bestDay,
    bestWeek,
  };
}
type SeriesKey = "overall" | "tokyo" | "london" | "nyc";

type ChartModel = {
  w: number;
  h: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;

  dates: string[];
  x: number[];

  yMin: number;
  yMax: number;
  yTicks: number[];
  zeroY: number;

  yToPix: (v: number) => number;

  series: Record<
    SeriesKey,
    {
      values: number[];
      pts: { x: number; y: number }[];
      pointsStr: string;
      areaPath: string;
    }
  >;
};

function niceStep(raw: number) {
  if (raw <= 0) return 1;

  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);

  const frac = raw / base;

  const niceFrac =
    frac <= 1 ? 1 :
    frac <= 2 ? 2 :
    frac <= 5 ? 5 :
    10;

  return niceFrac * base;
}

function buildChartModel(
  input: {
    dates: string[];
    overall: number[];
    tokyo: number[];
    london: number[];
    nyc: number[];
  },
  opts?: Partial<Pick<ChartModel, "w" | "h">>
): ChartModel {

  const w = opts?.w ?? 760;
  const h = opts?.h ?? 180;

  const padL = 56;
  const padR = 18;
  const padT = 14;
  const padB = 28;

  const n = input.dates.length;

  const x = Array.from({ length: n }, (_, i) =>
    padL + (i * (w - padL - padR)) / Math.max(1, n - 1)
  );

  const all = [
    ...input.overall,
    ...input.tokyo,
    ...input.london,
    ...input.nyc,
  ];

  const maxAbs = Math.max(
    1,
    ...all.map((v) => Math.abs(v))
  );

  const yMax = Math.ceil(maxAbs * 1.15);
  const yMin = -yMax;

  const span = yMax - yMin || 1;

  const yToPix = (v: number) =>
    padT + ((yMax - v) * (h - padT - padB)) / span;

  const yTickCount = 5;

  const step = niceStep((yMax - yMin) / (yTickCount - 1));

  const start = Math.ceil(yMin / step) * step;

  const yTicks: number[] = [];

  for (let v = start; v <= yMax + 0.0001; v += step) {
    yTicks.push(v);
  }

  const zeroY = yToPix(0);

  function mk(values: number[]) {

    const pts = values.map((v, i) => ({
      x: x[i],
      y: yToPix(v),
    }));

    const pointsStr = pts
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

    let areaPath = "";

    if (pts.length >= 2) {

      const first = pts[0];
      const last = pts[pts.length - 1];

      areaPath =
        `M ${first.x.toFixed(1)} ${zeroY.toFixed(1)}` +
        ` L ${first.x.toFixed(1)} ${first.y.toFixed(1)}` +
        pts
          .slice(1)
          .map(
            (p) =>
              ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          )
          .join("") +
        ` L ${last.x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
    }

    return { values, pts, pointsStr, areaPath };
  }

  return {
    w,
    h,
    padL,
    padR,
    padT,
    padB,

    dates: input.dates,
    x,

    yMin,
    yMax,
    yTicks,
    zeroY,

    yToPix,

    series: {
      overall: mk(input.overall),
      tokyo: mk(input.tokyo),
      london: mk(input.london),
      nyc: mk(input.nyc),
    },
  };
}

function smoothLinePath(
  pts: { x: number; y: number }[]
) {
  if (!pts.length) return "";

  if (pts.length === 1) {
    return `M ${pts[0].x} ${pts[0].y}`;
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {

    const p0 = pts[i];
    const p1 = pts[i + 1];

    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;

    d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`;
  }

  const last = pts[pts.length - 1];

  d += ` T ${last.x} ${last.y}`;

  return d;
}

function shortDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function rangeLabel(tf: TF) {
  if (tf === "week") return "Week";
  if (tf === "month") return "Month";
  if (tf === "year") return "Year";
  return "All-time";
}

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type ZoomScheduleItem = {
  id: string;
  coach: string;
  session: string;
  etTime: string;
  days: Weekday[];
  instruments: string;
};

function startOfWeekMonday(d: Date) {
  const dow = d.getDay();
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  return addDays(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    -daysSinceMon
  );
}

function nextMonday(d: Date) {
  const dow = d.getDay();
  const delta = (8 - dow) % 7;
  return addDays(d, delta);
}

function timeframeRange(tf: TF, monthRef: Date) {
  const now = new Date();
  const today = toISODate(now);

  const isCurrentMonth =
    monthRef.getFullYear() === now.getFullYear() &&
    monthRef.getMonth() === now.getMonth();

  const monthStart = new Date(monthRef.getFullYear(), monthRef.getMonth(), 1);
  const monthEnd = new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 0);

  const monthStartISO = toISODate(monthStart);
  const monthEndISO = toISODate(monthEnd);

  if (tf === "week") {
    if (isCurrentMonth) {
      const mon = startOfWeekMonday(now);
      return { startISO: toISODate(mon), endISO: today };
    }

    const anchor =
      monthStart.getDay() === 0 || monthStart.getDay() === 6
        ? nextMonday(monthStart)
        : monthStart;

    const weekMon = startOfWeekMonday(anchor);
    const weekFri = addDays(weekMon, 4);

    const start = weekMon < monthStart ? monthStart : weekMon;
    const end = weekFri > monthEnd ? monthEnd : weekFri;

    return { startISO: toISODate(start), endISO: toISODate(end) };
  }

  if (tf === "month") {
    return {
      startISO: monthStartISO,
      endISO: isCurrentMonth ? today : monthEndISO,
    };
  }

  if (tf === "year") {
    return { startISO: `${now.getFullYear()}-01-01`, endISO: today };
  }

  return { startISO: "2000-01-01", endISO: today };
}

function buildSeriesFromMaps(
  range: { startISO: string; endISO: string },
  calendarMap: Map<string, DailyOverallRow>,
  sessionMap: Map<string, Map<Session, DailySessionRow>>
) {
  const start = new Date(range.startISO + "T00:00:00");
  const end = new Date(range.endISO + "T00:00:00");

  const dates: string[] = [];
  const cum = {
    overall: [] as number[],
    tokyo: [] as number[],
    london: [] as number[],
    nyc: [] as number[],
  };

  let cO = 0;
  let cT = 0;
  let cL = 0;
  let cN = 0;

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (isWeekendDate(d)) continue;

    const iso = toISODate(d);

    const o = calendarMap.get(iso);
    cO += safeNum(o?.wins) - safeNum(o?.losses);

    const m = sessionMap.get(iso);
    cT += safeNum(m?.get("tokyo")?.wins) - safeNum(m?.get("tokyo")?.losses);
    cL += safeNum(m?.get("london")?.wins) - safeNum(m?.get("london")?.losses);
    cN += safeNum(m?.get("nyc")?.wins) - safeNum(m?.get("nyc")?.losses);

    dates.push(iso);
    cum.overall.push(cO);
    cum.tokyo.push(cT);
    cum.london.push(cL);
    cum.nyc.push(cN);
  }

  return { dates, ...cum };
}

function fmtLocalTime(ms: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

function fmtCountdown(msUntil: number) {
  if (msUntil <= 0) return "Starting";

  const totalMin = Math.floor(msUntil / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (h <= 0) return `Starts in ${m}m`;
  return `Starts in ${h}h ${m}m`;
}

function fmtEndsIn(msLeft: number) {
  if (msLeft <= 0) return "Ending";

  const totalMin = Math.ceil(msLeft / 60000);

  if (totalMin <= 1) return "Ends in 1m";
  return `Ends in ${totalMin}m`;
}
function ymdInTimeZone(tz: string, d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function zonedWallTimeToUtcMs(
  tz: string,
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number
) {
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const guessDate = new Date(guessUtc);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guessDate);

  const y2 = Number(parts.find((p) => p.type === "year")?.value);
  const m2 = Number(parts.find((p) => p.type === "month")?.value);
  const d2 = Number(parts.find((p) => p.type === "day")?.value);
  const hh2 = Number(parts.find((p) => p.type === "hour")?.value);
  const mm2 = Number(parts.find((p) => p.type === "minute")?.value);

  const asIfUtc = Date.UTC(y2, m2 - 1, d2, hh2, mm2, 0);
  const offset = asIfUtc - guessUtc;

  return guessUtc - offset;
}

function calcTickerSpeedSec(text: string) {
  const len = (text || "").length;
  const sec = 14 + len / 5;
  return clamp(sec, 18, 48);
}

function buildZoomTickerText(item: ZoomScheduleItem, startUtcMs: number) {
  const local = fmtLocalTime(startUtcMs);
  return `${item.session} with Coach ${item.coach} • ${local} • Trading ${item.instruments} • Click to join.`;
}

type ZoomStatus =
  | { mode: "none" }
  | { mode: "live"; item: ZoomScheduleItem; startUtcMs: number; endsUtcMs: number }
  | { mode: "next"; item: ZoomScheduleItem; startUtcMs: number };

function getZoomStatus(
  items: ZoomScheduleItem[],
  nowUtc: number,
  liveWindowMs = 30 * 60 * 1000
): ZoomStatus {
  const tz = "America/New_York";

  let bestLive: {
    item: ZoomScheduleItem;
    startUtcMs: number;
    endsUtcMs: number;
  } | null = null;

  for (let add = -2; add <= 0; add++) {
    const base = new Date(nowUtc + add * 24 * 60 * 60 * 1000);
    const { y, m, day } = ymdInTimeZone(tz, base);
    const etWeekday = new Date(
      zonedWallTimeToUtcMs(tz, y, m, day, 12, 0)
    ).getUTCDay() as Weekday;

    for (const item of items) {
      if (!item.days.includes(etWeekday)) continue;

      const [hh, mm] = item.etTime.split(":").map(Number);
      const startUtcMs = zonedWallTimeToUtcMs(tz, y, m, day, hh, mm);
      const endsUtcMs = startUtcMs + liveWindowMs;

      if (nowUtc >= startUtcMs && nowUtc < endsUtcMs) {
        if (!bestLive || startUtcMs > bestLive.startUtcMs) {
          bestLive = { item, startUtcMs, endsUtcMs };
        }
      }
    }
  }

  if (bestLive) return { mode: "live", ...bestLive };

  let bestNext: { item: ZoomScheduleItem; startUtcMs: number } | null = null;

  for (let add = 0; add <= 14; add++) {
    const base = new Date(nowUtc + add * 24 * 60 * 60 * 1000);
    const { y, m, day } = ymdInTimeZone(tz, base);
    const etWeekday = new Date(
      zonedWallTimeToUtcMs(tz, y, m, day, 12, 0)
    ).getUTCDay() as Weekday;

    for (const item of items) {
      if (!item.days.includes(etWeekday)) continue;

      const [hh, mm] = item.etTime.split(":").map(Number);
      const startUtcMs = zonedWallTimeToUtcMs(tz, y, m, day, hh, mm);

      if (startUtcMs <= nowUtc) continue;

      if (!bestNext || startUtcMs < bestNext.startUtcMs) {
        bestNext = { item, startUtcMs };
      }
    }
  }

  if (bestNext) return { mode: "next", ...bestNext };

  return { mode: "none" };
}

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

function twemojiFlagSvgUrl(country: "jp" | "gb" | "us") {
  const code =
    country === "jp"
      ? "1f1ef-1f1f5"
      : country === "gb"
      ? "1f1ec-1f1e7"
      : "1f1fa-1f1f8";

  return `${TWEMOJI_BASE}/${code}.svg`;
}

function FlagIcon({
  country,
  size = 18,
}: {
  country: "jp" | "gb" | "us";
  size?: number;
}) {
  const src = twemojiFlagSvgUrl(country);

  const alt =
    country === "jp"
      ? "Japan"
      : country === "gb"
      ? "United Kingdom"
      : "United States";

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle" }}
      loading="lazy"
      decoding="async"
    />
  );
}

function sessionCountry(s: string): "jp" | "gb" | "us" | null {
  const t = s.toLowerCase();

  if (t.includes("tokyo")) return "jp";
  if (t.includes("london")) return "gb";
  if (t.includes("nyc") || t.includes("new york")) return "us";

  return null;
}

export default function PublicDashboardPage() {
  const [monthCursor, setMonthCursor] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [loading, setLoading] = useState(false);

  const [calendarMap, setCalendarMap] = useState<
    Map<string, DailyOverallRow>
  >(new Map());

  const [sessionMap, setSessionMap] = useState<
    Map<string, Map<Session, DailySessionRow>>
  >(new Map());

  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [noLossRuns, setNoLossRuns] = useState<NoLossRuns>(() =>
  emptyNoLossRuns()
    );
  const [trackerHighlights, setTrackerHighlights] =
    useState<TrackerHighlightStats | null>(null);

  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [summaryOpen, setSummaryOpen] = useState(false);
const [summaryTitle, setSummaryTitle] = useState<string>("");
const [summaryOverall, setSummaryOverall] = useState<{
  wins: number;
  losses: number;
  breakevens: number;
} | null>(null);

const [summaryBySession, setSummaryBySession] = useState<
  Record<Session, { wins: number; losses: number; breakevens: number }> | null
>(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryCardUrl, setSummaryCardUrl] =
    useState<string | null>(null);

  const [tf, setTf] = useState<TF>("month");
  const [chartOverall, setChartOverall] = useState<DailyOverallRow[]>([]);
  const [chartBySession, setChartBySession] = useState<DailySessionRow[]>([]);

  const [calendarDensity, setCalendarDensity] = useState<"simple" | "detailed">(
    "simple"
  );

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focusSeries, setFocusSeries] = useState<SeriesKey | null>(null);

  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>(
    {
      overall: true,
      london: true,
      nyc: true,
      tokyo: true,
    }
  );

  const [weekPreview, setWeekPreview] = useState<{
    startISO: string;
    endISO: string;
    label: string;
  } | null>(null);

  const [pinnedWeek, setPinnedWeek] = useState<{
    startISO: string;
    endISO: string;
    label: string;
  } | null>(null);

const [chartAnimProgress, setChartAnimProgress] = useState(0);  
const [nowUtc, setNowUtc] = useState(0);

useEffect(() => {
  setNowUtc(Date.now());
  const t = setInterval(() => setNowUtc(Date.now()), 15000);
  return () => clearInterval(t);
}, []);

  const joinUrl = "https://www.thekingdm.com/";

  const zoomSchedule: ZoomScheduleItem[] = useMemo(
    () => [
      {
        id: "tokyo-luca",
        coach: "Luca",
        session: "Tokyo Session",
        etTime: "20:45",
        days: [1, 2, 3, 4],
        instruments: "Gold and NASDAQ",
      },
      {
        id: "london-emmitt",
        coach: "Emmitt",
        session: "London Session",
        etTime: "02:50",
        days: [1, 2, 3, 4],
        instruments: "Oil, GER30 and Gold",
      },
      {
        id: "nyc-mamba",
        coach: "Mamba",
        session: "NYC Session",
        etTime: "09:25",
        days: [1, 2, 3, 4],
        instruments: "US30 and NASDAQ",
      },
    ],
    []
  );

  const zoomStatus = useMemo(
    () => getZoomStatus(zoomSchedule, nowUtc, 30 * 60 * 1000),
    [zoomSchedule, nowUtc]
  );

  const isClockReady = nowUtc > 0;
  const soonWindowMin = 15;

  const isSoon =
    zoomStatus.mode === "next" &&
    zoomStatus.startUtcMs - nowUtc <= soonWindowMin * 60 * 1000;

  const [flashBulletin, setFlashBulletin] = useState(false);
  const lastKeyRef = useRef<string>("");
  
    useEffect(() => {
    const key =
      zoomStatus.mode === "none"
        ? "none"
        : zoomStatus.mode === "live"
        ? `live:${zoomStatus.item.id}`
        : `next:${zoomStatus.item.id}`;

    if (lastKeyRef.current && key !== lastKeyRef.current) {
      setFlashBulletin(true);
      const t = setTimeout(() => setFlashBulletin(false), 1400);
      lastKeyRef.current = key;
      return () => clearTimeout(t);
    }

    lastKeyRef.current = key;
  }, [zoomStatus]);

  function openRangeSummary(
  title: string,
  startISO: string,
  endISO: string,
  cardKind: SummaryCardKind = null
) {
  let wO = 0;
  let lO = 0;
  let beO = 0;

  const sessTotals: Record<
    Session,
    {
      wins: number;
      losses: number;
      breakevens: number;
    }
  > = {
    tokyo: {
      wins: 0,
      losses: 0,
      breakevens: 0,
    },
    london: {
      wins: 0,
      losses: 0,
      breakevens: 0,
    },
    nyc: {
      wins: 0,
      losses: 0,
      breakevens: 0,
    },
  };

  const start = new Date(
    `${startISO}T00:00:00`
  );

  const end = new Date(
    `${endISO}T00:00:00`
  );

  for (
    let day = new Date(start);
    day <= end;
    day = addDays(day, 1)
  ) {
    if (isWeekendDate(day)) continue;

    const iso = toISODate(day);

    const overall = calendarMap.get(iso);

    if (overall) {
      wO += safeNum(overall.wins);
      lO += safeNum(overall.losses);
      beO += safeNum(overall.breakevens);
    }

    const sessions = sessionMap.get(iso);

    if (sessions) {
      (
        ["tokyo", "london", "nyc"] as Session[]
      ).forEach((session) => {
        const row = sessions.get(session);

        if (!row) return;

        sessTotals[session].wins += safeNum(
          row.wins
        );

        sessTotals[session].losses += safeNum(
          row.losses
        );

        sessTotals[
          session
        ].breakevens += safeNum(
          row.breakevens
        );
      });
    }
  }

  let cardUrl: string | null = null;

  if (cardKind === "weekly") {
    /*
     * endISO works whether the visible calendar
     * week ends Friday or Saturday. The API route
     * determines the correct Monday-based week.
     */
    const params = new URLSearchParams({
      date: endISO,
    });

    cardUrl =
      `/api/weekly-summary-card?` +
      params.toString();
  }

  if (cardKind === "monthly") {
    const params = new URLSearchParams({
      date: startISO,
    });

    cardUrl =
      `/api/monthly-summary-card?` +
      params.toString();
  }

  setSummaryTitle(title);

  setSummaryOverall({
    wins: wO,
    losses: lO,
    breakevens: beO,
  });

  setSummaryBySession(sessTotals);
  setSummaryCardUrl(cardUrl);
  setSummaryOpen(true);
}

  async function openFetchedRangeSummary(
  title: string,
  startISO: string,
  endISO: string
) {
  setSummaryCardUrl(null);
  setSummaryLoading(true);
  setSummaryTitle(title);
  setSummaryOverall(null);
  setSummaryBySession(null);
  setSummaryOpen(true);

  try {
    const [overallRes, sessRes] = await Promise.all([
      supabase
        .from("v_public_daily_overall")
        .select("date, wins, losses, breakevens")
        .gte("date", startISO)
        .lte("date", endISO),

      supabase
        .from("v_public_daily_outcomes")
        .select("date, session, wins, losses, breakevens")
        .gte("date", startISO)
        .lte("date", endISO),
    ]);

    if (overallRes.error) throw overallRes.error;
    if (sessRes.error) throw sessRes.error;

    let wO = 0;
    let lO = 0;
    let beO = 0;

    const sessTotals: Record<
      Session,
      { wins: number; losses: number; breakevens: number }
    > = {
      tokyo: { wins: 0, losses: 0, breakevens: 0 },
      london: { wins: 0, losses: 0, breakevens: 0 },
      nyc: { wins: 0, losses: 0, breakevens: 0 },
    };

    ((overallRes.data ?? []) as DailyOverallRow[]).forEach((r) => {
      wO += safeNum(r.wins);
      lO += safeNum(r.losses);
      beO += safeNum(r.breakevens);
    });

    ((sessRes.data ?? []) as DailySessionRow[]).forEach((r) => {
      const s = r.session;
      sessTotals[s].wins += safeNum(r.wins);
      sessTotals[s].losses += safeNum(r.losses);
      sessTotals[s].breakevens += safeNum(r.breakevens);
    });

    setSummaryOverall({
      wins: wO,
      losses: lO,
      breakevens: beO,
    });
    setSummaryBySession(sessTotals);
  } finally {
    setSummaryLoading(false);
  }
}

  const hotStreakMap = useMemo(
    () => getHotStreakMap(calendarMap),
    [calendarMap]
  );

  const sessionNoLossRunMaps = useMemo(
    () => getSessionNoLossRunMaps(sessionMap),
    [sessionMap]
  );

  const calendarRange = useMemo(() => {
    const start = startOfCalendarGrid(monthCursor);
    const end = endOfCalendarGrid(monthCursor);
    return {
      startISO: toISODate(start),
      endISO: toISODate(end),
    };
  }, [monthCursor]);

  const calendarDays = useMemo(() => {
    const start = new Date(calendarRange.startISO + "T00:00:00");
    const end = new Date(calendarRange.endISO + "T00:00:00");

    const days: Date[] = [];

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      days.push(new Date(d));
    }

    return days;
  }, [calendarRange.startISO, calendarRange.endISO]);

  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  const holidayMap = useMemo(() => {
    const visibleYears = new Set(
      calendarDays.map((day) => day.getFullYear())
    );

    const combined = new Map<string, string>();

    visibleYears.forEach((year) => {
      usFederalHolidayMap(year).forEach(
        (name, iso) => {
          combined.set(iso, name);
        }
      );
    });

    return combined;
  }, [calendarDays]);

  const mtd = useMemo(() => {
  const y = monthCursor.getFullYear();
  const m = monthCursor.getMonth();
  const start = new Date(y, m, 1);

  const now = new Date();
  const isCurrentMonth =
    y === now.getFullYear() && m === now.getMonth();

  const end = isCurrentMonth ? now : new Date(y, m + 1, 0);

  let tp = 0;
  let sl = 0;
  let be = 0;

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (isWeekendDate(d)) continue;

    const iso = toISODate(d);
    const row = calendarMap.get(iso);
    if (!row) continue;

    tp += safeNum(row.wins);
    sl += safeNum(row.losses);
    be += safeNum(row.breakevens);
  }

  const denom = tp + sl;
  const winRate = denom > 0 ? tp / denom : 0;
  const net = tp - sl;

  return { tp, sl, be, net, winRate };
}, [calendarMap, monthCursor]);

const momentumItems = useMemo(() => {
  const minRunToShow = 2;

  const items: Array<{
    key: "overall" | Session;
    label: string;
    value: number;
    color: string;
  }> = [];

  if (noLossRuns.overall >= minRunToShow) {
    items.push({
      key: "overall",
      label: "Overall",
      value: noLossRuns.overall,
      color: THEME.gold,
    });
  }

  (["tokyo", "london", "nyc"] as Session[]).forEach((s) => {
    const value = noLossRuns[s];

    if (value >= minRunToShow) {
      items.push({
        key: s,
        label: sessionMomentumLabel(s),
        value,
        color: sessionMomentumColor(s),
      });
    }
  });

  return items;
}, [noLossRuns]);

  const selectedDay = useMemo(() => {
    if (!selectedISO) return null;

    const overall = calendarMap.get(selectedISO) ?? null;
    const perSess = sessionMap.get(selectedISO) ?? null;

    return { overall, perSess };
  }, [calendarMap, sessionMap, selectedISO]);

  const selectedDayStats = useMemo(() => {
  if (!selectedDay?.overall) return null;

  const wins = safeNum(selectedDay.overall.wins);
  const losses = safeNum(selectedDay.overall.losses);
  const breakevens = safeNum(selectedDay.overall.breakevens);
  const net = wins - losses;
  const wr = winRatePct(wins, losses);
  const total = wins + losses + breakevens;

  const sessions: Array<{
    label: string;
    net: number;
    wins: number;
    losses: number;
  }> = (["tokyo", "london", "nyc"] as Session[]).map((s) => {
    const r = selectedDay.perSess?.get(s);
    return {
      label: s.toUpperCase(),
      net: safeNum(r?.wins) - safeNum(r?.losses),
      wins: safeNum(r?.wins),
      losses: safeNum(r?.losses),
    };
  });

  const bestSession = sessions.reduce((a, b) => (b.net > a.net ? b : a), sessions[0]);
  const worstSession = sessions.reduce((a, b) => (b.net < a.net ? b : a), sessions[0]);

return {
  wins,
  losses,
  breakevens,
  net,
  wr,
  total,
  bestSession,
  worstSession,
  hot: hotStreakMap.get(selectedISO ?? "") ?? 0,
};
}, [selectedDay, hotStreakMap, selectedISO]);

const summaryBestSession = useMemo(() => {
  if (!summaryBySession) return null;

  return (["tokyo", "london", "nyc"] as Session[])
    .map((s) => ({
      session: s,
      label: s.toUpperCase(),
      net: summaryBySession[s].wins - summaryBySession[s].losses,
    }))
    .reduce((a, b) => (b.net > a.net ? b : a));
}, [summaryBySession]);

  async function loadCalendarGrid() {
    setLoading(true);

    try {
      const [overallRes, sessRes] = await Promise.all([
        supabase
          .from("v_public_daily_overall")
          .select("date, wins, losses, breakevens")
          .gte("date", calendarRange.startISO)
          .lte("date", calendarRange.endISO),

        supabase
          .from("v_public_daily_outcomes")
          .select("date, session, wins, losses, breakevens")
          .gte("date", calendarRange.startISO)
          .lte("date", calendarRange.endISO),
      ]);

      if (overallRes.error) throw overallRes.error;
      if (sessRes.error) throw sessRes.error;

      const cmap = new Map<string, DailyOverallRow>();

      ((overallRes.data ?? []) as DailyOverallRow[]).forEach((r) => {
        const iso = String(r.date);

        cmap.set(iso, {
          date: iso,
          wins: safeNum(r.wins),
          losses: safeNum(r.losses),
          breakevens: safeNum(r.breakevens),
        });
      });

      const smap = new Map<string, Map<Session, DailySessionRow>>();

      ((sessRes.data ?? []) as DailySessionRow[]).forEach((r) => {
        const iso = String(r.date);
        const s = r.session;

        if (!smap.has(iso)) smap.set(iso, new Map());

        smap.get(iso)!.set(s, {
          date: iso,
          session: s,
          wins: safeNum(r.wins),
          losses: safeNum(r.losses),
          breakevens: safeNum(r.breakevens),
        });
      });

      setCalendarMap(cmap);
      setSessionMap(smap);
    } finally {
      setLoading(false);
    }
  }

  async function loadChart(tfLocal: TF) {
    const { startISO, endISO } = timeframeRange(tfLocal, monthCursor);

    const [overallRes, sessRes] = await Promise.all([
      supabase
        .from("v_public_daily_overall")
        .select("date, wins, losses, breakevens")
        .gte("date", startISO)
        .lte("date", endISO)
        .order("date", { ascending: true }),

      supabase
        .from("v_public_daily_outcomes")
        .select("date, session, wins, losses, breakevens")
        .gte("date", startISO)
        .lte("date", endISO)
        .order("date", { ascending: true }),
    ]);

    if (overallRes.error) throw overallRes.error;
    if (sessRes.error) throw sessRes.error;

    const overallRows: DailyOverallRow[] = ((overallRes.data ?? []) as DailyOverallRow[]).map((r) => ({
      date: String(r.date),
      wins: safeNum(r.wins),
      losses: safeNum(r.losses),
      breakevens: safeNum(r.breakevens),
    }));

    const sessionRows: DailySessionRow[] = ((sessRes.data ?? []) as DailySessionRow[]).map((r) => ({
      date: String(r.date),
      session: r.session,
      wins: safeNum(r.wins),
      losses: safeNum(r.losses),
      breakevens: safeNum(r.breakevens),
    }));

    setChartOverall(overallRows);
    setChartBySession(sessionRows);
    setTrackerHighlights(computeTrackerHighlightStats(overallRows));
  }

  async function loadStreakYtd() {
  const endISO = toISODate(new Date());

  // Use a long lookback so streaks can survive month/year boundaries.
  const startISO = "2000-01-01";

  const [overallRes, sessionRes] = await Promise.all([
    supabase
      .from("v_public_daily_overall")
      .select("date, wins, losses, breakevens")
      .gte("date", startISO)
      .lte("date", endISO)
      .order("date", { ascending: true }),

    supabase
      .from("v_public_daily_outcomes")
      .select("date, session, wins, losses, breakevens")
      .gte("date", startISO)
      .lte("date", endISO)
      .order("date", { ascending: true }),
  ]);

  if (overallRes.error) throw overallRes.error;
  if (sessionRes.error) throw sessionRes.error;

  const overallRows: DailyOverallRow[] = (
    (overallRes.data ?? []) as DailyOverallRow[]
  ).map((r) => ({
    date: String(r.date),
    wins: safeNum(r.wins),
    losses: safeNum(r.losses),
    breakevens: safeNum(r.breakevens),
  }));

  const sessionRows: DailySessionRow[] = (
    (sessionRes.data ?? []) as DailySessionRow[]
  ).map((r) => ({
    date: String(r.date),
    session: r.session,
    wins: safeNum(r.wins),
    losses: safeNum(r.losses),
    breakevens: safeNum(r.breakevens),
  }));

  const sessionRuns = getCurrentSessionNoLossRuns(sessionRows);

  const runs: NoLossRuns = {
    overall: getCurrentOverallNoLossRun(overallRows),
    tokyo: sessionRuns.tokyo,
    london: sessionRuns.london,
    nyc: sessionRuns.nyc,
  };

  setNoLossRuns(runs);

  // Keep this for any old UI references.
  setCurrentStreak(runs.overall);
}

  async function refreshAll() {
    await Promise.all([
      loadCalendarGrid(),
      loadChart(tf),
      loadStreakYtd(),
    ]);
  }

  useEffect(() => {
    refreshAll().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarRange.startISO, calendarRange.endISO]);

  useEffect(() => {
    loadChart(tf).catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tf, monthCursor]);
    const activeWeekRange = pinnedWeek ?? weekPreview;

  const chartRawOverallByDate = useMemo(() => {
    const m = new Map<string, DailyOverallRow>();
    chartOverall.forEach((r) => m.set(r.date, r));
    return m;
  }, [chartOverall]);

  const chartRawSessionByDate = useMemo(() => {
    const m = new Map<string, Map<Session, DailySessionRow>>();

    chartBySession.forEach((r) => {
      if (!m.has(r.date)) m.set(r.date, new Map());
      m.get(r.date)!.set(r.session, r);
    });

    return m;
  }, [chartBySession]);

  const chartAllDates = useMemo(() => {
  return Array.from(
    new Set([
      ...chartOverall.map((r) => r.date),
      ...chartBySession.map((r) => r.date),
    ])
  ).sort();
}, [chartOverall, chartBySession]);

  const chartSeries = useMemo(() => {
  if (activeWeekRange) {
    return buildSeriesFromMaps(
      {
        startISO: activeWeekRange.startISO,
        endISO: activeWeekRange.endISO,
      },
      calendarMap,
      sessionMap
    );
  }

  const dates = chartAllDates;

  const cum = {
    overall: [] as number[],
    tokyo: [] as number[],
    london: [] as number[],
    nyc: [] as number[],
  };

  let cO = 0;
  let cT = 0;
  let cL = 0;
  let cN = 0;

  dates.forEach((iso) => {
    const d = new Date(iso + "T00:00:00");
    if (isWeekendDate(d)) return;

    const o = chartRawOverallByDate.get(iso);
    cO += safeNum(o?.wins) - safeNum(o?.losses);

    const m = chartRawSessionByDate.get(iso);
    cT += safeNum(m?.get("tokyo")?.wins) - safeNum(m?.get("tokyo")?.losses);
    cL += safeNum(m?.get("london")?.wins) - safeNum(m?.get("london")?.losses);
    cN += safeNum(m?.get("nyc")?.wins) - safeNum(m?.get("nyc")?.losses);

    cum.overall.push(cO);
    cum.tokyo.push(cT);
    cum.london.push(cL);
    cum.nyc.push(cN);
  });

  return { dates, ...cum };
}, [
  activeWeekRange,
  calendarMap,
  sessionMap,
  chartOverall,
  chartBySession,
  chartRawOverallByDate,
  chartRawSessionByDate,
]);

const overlaySeries = useMemo<{
  dates: string[];
  overall: number[];
} | null>(() => {
  return null;
}, []);

  const chartModel = useMemo(() => {
    return buildChartModel(
      {
        dates: chartSeries.dates,
        overall: chartSeries.overall,
        tokyo: chartSeries.tokyo,
        london: chartSeries.london,
        nyc: chartSeries.nyc,
      },
      { w: 860, h: 180 }
    );
  }, [chartSeries]);

  const chartLineAnimKey = useMemo(() => {
  const mode = pinnedWeek
    ? `pin:${pinnedWeek.startISO}:${pinnedWeek.endISO}`
    : weekPreview
    ? `preview:${weekPreview.startISO}:${weekPreview.endISO}`
    : `tf:${tf}`;

  return `${mode}|${chartSeries.dates.length}|${
    chartSeries.overall[chartSeries.overall.length - 1] ?? 0
  }`;
}, [tf, pinnedWeek, weekPreview, chartSeries]);

useEffect(() => {
  setChartAnimProgress(0);

  const start = performance.now();
  const duration = 850;

  let frame = 0;

  const animate = (t: number) => {
    const progress = Math.min((t - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    setChartAnimProgress(eased);

    if (progress < 1) {
      frame = requestAnimationFrame(animate);
    }
  };

  frame = requestAnimationFrame(animate);

  return () => cancelAnimationFrame(frame);
}, [chartLineAnimKey]);

useEffect(() => {
  setHoverIdx(null);
  setFocusSeries(null);
}, [chartLineAnimKey, chartModel.x.length, chartModel.dates.length]);

const chartEnhancements = useMemo(() => {
  const linePaths: Record<SeriesKey, string> = {
    overall: smoothLinePath(chartModel.series.overall.pts),
    tokyo: smoothLinePath(chartModel.series.tokyo.pts),
    london: smoothLinePath(chartModel.series.london.pts),
    nyc: smoothLinePath(chartModel.series.nyc.pts),
  };

  return {
    drawdownPaths: [] as string[],
    bestRun: null as null | { startIdx: number; endIdx: number },
    peakDots: [] as { x: number; y: number; i: number; v: number }[],
    peakValue: null as number | null,
    currentValue:
      chartModel.series.overall.values.length
        ? chartModel.series.overall.values[
            chartModel.series.overall.values.length - 1
          ]
        : null,
    drawdownPct: 0,
    overlayPts: [] as { x: number; y: number }[],
    overlayPath: "",
    overlayBand: null as null | { x1: number; x2: number },
    linePaths,
  };
}, [chartModel]);

  const chartKpis = useMemo(() => {
    const o = chartSeries.overall;
    if (!o.length) return null;

    const net = o[o.length - 1] ?? 0;
    const tok = chartSeries.tokyo.length
      ? chartSeries.tokyo[chartSeries.tokyo.length - 1]
      : 0;
    const lon = chartSeries.london.length
      ? chartSeries.london[chartSeries.london.length - 1]
      : 0;
    const nyc = chartSeries.nyc.length
      ? chartSeries.nyc[chartSeries.nyc.length - 1]
      : 0;

    const entries = [
      ["Overall", net],
      ["Tokyo", tok],
      ["London", lon],
      ["NYC", nyc],
    ] as const;

    const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);

    const start = o[0] ?? 0;
    const change = net - start;

    return {
      net,
      change,
      best: { name: best[0], v: best[1] },
      peak: chartEnhancements.peakValue,
      drawdownPct: chartEnhancements.drawdownPct,
    };
  }, [chartSeries, chartEnhancements]);

  function openDay(iso: string) {
  if (isWeekendISO(iso)) return;

  setSelectedISO(iso);
  setModalOpen(true);
}

  function closeModal() {
    setModalOpen(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (modalOpen) setModalOpen(false);
        if (summaryOpen) setSummaryOpen(false);
        return;
      }

      if (isTypingTarget(e.target)) return;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, summaryOpen]);

  function openMonthSummaryFromMTD() {
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const startISO = toISODate(new Date(y, m, 1));

    const now = new Date();
    const isCurrentMonth =
      y === now.getFullYear() && m === now.getMonth();

    const endISO = toISODate(
      isCurrentMonth ? now : new Date(y, m + 1, 0)
    );

    openRangeSummary(
      `Month Summary (${monthLabel(monthCursor)})`,
        startISO,
        endISO,
      "monthly"
    );
  }

  function openGeneratedSummary(
    title: string,
    route: string,
    date: string
  ) {
    const params = new URLSearchParams({
      date,
    });

    setSummaryTitle(title);
    setSummaryOverall(null);
    setSummaryBySession(null);
    setSummaryLoading(false);
    setSummaryCardUrl(`${route}?${params.toString()}`);
    setSummaryOpen(true);
  }

  async function openYearSummaryYTD() {
    const now = new Date();
    const year = now.getFullYear();
    const date = toISODate(now);

    openGeneratedSummary(
      `Year Summary (${year} YTD)`,
      "/api/yearly-summary-card",
      date
    );
  }

  async function openAllTimeSummary() {
    const date = toISODate(new Date());

    openGeneratedSummary(
      "All-Time Summary",
      "/api/all-time-summary-card",
      date
    );
  }

  function toggleSeries(k: SeriesKey) {
    setVisibleSeries((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      const anyOn = (Object.keys(next) as SeriesKey[]).some((kk) => next[kk]);
      return anyOn ? next : prev;
    });
  }

  function togglePinnedWeek(range: {
    startISO: string;
    endISO: string;
    label: string;
  }) {
    setPinnedWeek((prev) => {
      if (
        prev &&
        prev.startISO === range.startISO &&
        prev.endISO === range.endISO
      ) {
        return null;
      }
      return range;
    });

    setTf("week");
  }

  function seriesOpacity(k: SeriesKey) {
  if (!visibleSeries[k]) return 0;
  if (!focusSeries) return k === "overall" ? 1 : 0.82;
  if (focusSeries === k) return 1;
  return k === "overall" ? 0.16 : 0.35;
}

  function seriesStrokeWidth(k: SeriesKey) {
  if (k === "overall") {
    return focusSeries === "overall" || !focusSeries ? 3.8 : 2.8;
  }

  return focusSeries === k ? 2.8 : focusSeries ? 1.3 : 1.9;
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

      {/* Top header */}
<div style={{ display: "grid", gap: 10, marginBottom: 12, }}>
  {/* Row 1: title + nav */}
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      flexWrap: "wrap",
    }}
  >
    <div style={{ minWidth: 320 }}>
      <h1 style={{ fontSize: 30, marginBottom: 6, lineHeight: "34px" }}>
        <span style={{ color: THEME.gold, fontWeight: 900 }}>
          The Kingdm
        </span>
        <div
            style={{
              marginTop: 6,
              opacity: 0.95,
              fontWeight: 900,
              letterSpacing: 0.2,
            }}
        >
            Trade Tracker Calendar
          </div>
      </h1>
      
    </div>

    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
                <TopNav currentPath="/public" />
    </div>
  </div>

  {/* Row 2: chips left, MTD right */}
  <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
    width: "100%",
  }}
>
    <div
  style={{
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    minWidth: 0,
    flex: "1 1 auto",
  }}
>
      {momentumItems.length > 0 && (
  <span
    style={{
      border: `1px solid rgba(215,177,74,0.24)`,
      background:
        "linear-gradient(135deg, rgba(215,177,74,0.10), rgba(255,255,255,0.025))",
      borderRadius: 999,
      padding: "7px 11px",
      fontWeight: 900,
      opacity: 0.98,
      display: "inline-flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
      boxShadow: "0 0 18px rgba(215,177,74,0.08)",
    }}
    title="Active no-loss runs. Break-evens do not break a run; any loss ends it."
  >
    <span style={{ color: THEME.gold }}>Momentum:</span>

{momentumItems.map((item) => {
  const flagCountry =
    item.key === "overall" ? null : sessionCountry(item.key);

  return (
    <span
      key={item.key}
      style={{
        color: item.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
      }}
    >
      {item.key === "overall" ? (
        <span>🔥</span>
      ) : flagCountry ? (
        <FlagIcon country={flagCountry} size={16} />
      ) : null}

      <span>{item.label}</span>

      <span style={{ color: THEME.gold }}>
        {item.key === "overall" ? (
          fmtInt(item.value)
        ) : (
          <>🔥 {fmtInt(item.value)}</>
        )}
      </span>
    </span>
  );
})}
  </span>
)}

      {trackerHighlights?.bestDay && (
        <span
          style={{
            border: `1px solid ${THEME.border}`,
            background: THEME.panel2,
            borderRadius: 999,
            padding: "7px 11px",
            fontWeight: 900,
            opacity: 0.95,
          }}
          title="Best single public day in the loaded chart data"
        >
          ⭐ Best Day:{" "}
          <span style={{ color: THEME.green }}>
            {shortDateLabel(trackerHighlights.bestDay.iso)}{" "}
            ({trackerHighlights.bestDay.net >= 0
              ? `+${trackerHighlights.bestDay.net}`
              : trackerHighlights.bestDay.net})
          </span>
        </span>
      )}
    </div>

    <div
  onClick={openMonthSummaryFromMTD}
  title="Open month summary"
  style={{
    border: `1px solid ${THEME.border}`,
    background: THEME.panel2,
    borderRadius: 999,
    padding: "7px 14px",
    fontWeight: 900,
    opacity: 0.98,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    whiteSpace: "nowrap",
    flexShrink: 0,
    marginLeft: "auto",
    boxShadow:
      mtd.net >= 0
        ? "0 0 18px rgba(85,255,138,0.08)"
        : "0 0 18px rgba(255,92,92,0.08)",
  }}
>
      <span
          style={{
            color: mtd.net >= 0 ? THEME.green : THEME.red,
            fontSize: 18,
            letterSpacing: "0.2px",
            textShadow:
              mtd.net >= 0
                ? "0 0 10px rgba(85,255,138,0.18)"
                : "0 0 10px rgba(255,92,92,0.18)",
              }}
      >
        MTD Stats: {mtd.net >= 0 ? `+${fmtInt(mtd.net)}` : fmtInt(mtd.net)}
      </span>

      <span style={{ color: THEME.green }}>
        • TP {fmtInt(mtd.tp)}
      </span>

      <span style={{ color: THEME.red }}>
        • SL {fmtInt(mtd.sl)}
      </span>

      <span style={{ color: THEME.gold }}>
        Win Rate: {fmtPct01(mtd.winRate)}
      </span>

    </div>
  </div>
</div>


      {/* Bulletin */}
      <div style={panelStyle()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={sectionHeader()}>
              📌 Bulletin
            </div>
            <div style={sectionSubtext()}>
              Live session announcements
            </div>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {!isClockReady ? (
        <div style={{ opacity: 0.8, fontWeight: 900 }}>
          Loading live session info...
        </div>
        ) : zoomStatus.mode === "none" ? (
          <div style={{ opacity: 0.8, fontWeight: 900 }}>
            No upcoming live sessions scheduled.
          </div>
        ) : zoomStatus.mode === "live" ? (
          (() => {
            const text = buildZoomTickerText(
              zoomStatus.item,
              zoomStatus.startUtcMs
            );
            const c = sessionCountry(zoomStatus.item.session);

            return (
              <NewsTickerBar
                key={`live:${zoomStatus.item.id}`}
                label="LIVE NOW"
                text={text}
                rightPill={fmtEndsIn(zoomStatus.endsUtcMs - nowUtc)}
                href={joinUrl}
                speedSec={calcTickerSpeedSec(text)}
                flash={flashBulletin}
                live={true}
                soon={false}
                flagCountry={c}
              />
            );
          })()
        ) : (
          (() => {
            const text = buildZoomTickerText(
              zoomStatus.item,
              zoomStatus.startUtcMs
            );
            const c = sessionCountry(zoomStatus.item.session);

            return (
              <NewsTickerBar
                key={`next:${zoomStatus.item.id}`}
                label="NEXT LIVE"
                text={text}
                rightPill={fmtCountdown(zoomStatus.startUtcMs - nowUtc)}
                href={joinUrl}
                speedSec={calcTickerSpeedSec(text)}
                flash={flashBulletin}
                live={false}
                soon={isSoon}
                soonLabel="SOON"
                flagCountry={c}
              />
            );
          })()
        )}
      </div>

      {/* Row: MTD + Economic News */}
      {false && (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignItems: "stretch",
        }}
      >

        {/* clickable MTD summary */}
<div
  style={{
    ...panel(),
    cursor: "pointer",
    height: "100%",
    padding: 16,
  }}
  onClick={openMonthSummaryFromMTD}
  title="Click to open month summary"
  onMouseDown={(e) => e.preventDefault()}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
      flexWrap: "wrap",
    }}
  >
    <div>
      <div
        style={{
          fontWeight: 950,
          fontSize: 18,
          color: THEME.gold,
          lineHeight: 1.1,
        }}
      >
        Month Summary
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 12,
          opacity: 0.75,
          marginTop: 4,
        }}
      >
        {monthLabel(monthCursor)}
      </div>
    </div>

    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        opacity: 0.72,
      }}
    >
      Click for session rates
    </div>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 12,
      marginBottom: 14,
    }}
  >
    <div style={miniPanel()}>
      <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>TP Hits</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 950,
          color: THEME.green,
          lineHeight: 1,
        }}
      >
        {fmtInt(mtd.tp)}
      </div>
    </div>

    <div style={miniPanel()}>
      <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>SL Hits</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 950,
          color: THEME.red,
          lineHeight: 1,
        }}
      >
        {fmtInt(mtd.sl)}
      </div>
    </div>

    <div style={miniPanel()}>
      <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>B/E</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 950,
          color: THEME.gold,
          lineHeight: 1,
        }}
      >
        {fmtInt(mtd.be)}
      </div>
    </div>

    <div style={miniPanel()}>
      <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>Win Rate</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 26,
          fontWeight: 950,
          color: "#fff",
          lineHeight: 1,
        }}
      >
        {(mtd.winRate * 100).toFixed(1)}%
      </div>
    </div>
  </div>

  <div
    style={{
      ...miniPanel(),
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 14px",
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        opacity: 0.72,
        textTransform: "uppercase",
      }}
    >
      Net
    </div>
    <div
      style={{
        fontSize: 24,
        fontWeight: 950,
        color: mtd.net >= 0 ? THEME.green : THEME.red,
        lineHeight: 1,
      }}
    >
      {mtd.net >= 0 ? `+${fmtInt(mtd.net)}` : fmtInt(mtd.net)}
    </div>
  </div>
</div>



        {/* Economic News */}
        <div
          style={{
            ...panel(),
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 950,
                  fontSize: 18,
                  color: THEME.gold,
                }}
              >
                Economic News
              </div>
              <div
                style={{
                  opacity: 0.75,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                USD priority • EUR / GBP / JPY secondary • All times ET
              </div>
            </div>

            <a
              href="https://www.forexfactory.com/calendar"
              target="_blank"
              rel="noreferrer"
              style={{
                ...btn(false),
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
              }}
              title="Open ForexFactory calendar in a new tab"
            >
              Source ↗
            </a>
          </div>

          <div style={{ height: 14 }} />

          {/* HERO EVENT */}
          <div
            style={{
              border: `1px solid rgba(255,92,92,0.20)`,
              borderRadius: 16,
              padding: 14,
              background:
                "linear-gradient(135deg, rgba(255,92,92,0.10), rgba(255,255,255,0.02))",
              boxShadow: "0 0 24px rgba(255,92,92,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "rgba(90,180,255,0.16)",
                      border: "1px solid rgba(90,180,255,0.22)",
                      fontSize: 11,
                      fontWeight: 950,
                      color: "rgba(90,180,255,0.95)",
                      letterSpacing: 0.3,
                    }}
                  >
                    USD
                  </span>

                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "rgba(255,92,92,0.14)",
                      border: "1px solid rgba(255,92,92,0.24)",
                      fontSize: 11,
                      fontWeight: 950,
                      color: THEME.red,
                      letterSpacing: 0.3,
                    }}
                  >
                    HIGH IMPACT
                  </span>
                </div>

                <div style={{ height: 10 }} />

                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 950,
                    lineHeight: "22px",
                  }}
                >
                  CPI m/m
                </div>

                <div
                  style={{
                    marginTop: 4,
                    opacity: 0.72,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Next major release
                </div>
              </div>

              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 950,
                    color: THEME.gold,
                  }}
                >
                  8:30 AM
                </div>

                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: `1px solid ${THEME.border}`,
                    background: "rgba(0,0,0,0.30)",
                    fontSize: 12,
                    fontWeight: 950,
                    boxShadow: "0 0 18px rgba(255,92,92,0.08)",
                  }}
                >
                  Upcoming
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                fontSize: 12,
              }}
            >
              <div style={newsMetricBox()}>
                <div style={newsMetricLabel()}>Forecast</div>
                <div style={newsMetricValue()}>0.3%</div>
              </div>

              <div style={newsMetricBox()}>
                <div style={newsMetricLabel()}>Previous</div>
                <div style={newsMetricValue()}>0.2%</div>
              </div>

              <div style={newsMetricBox()}>
                <div style={newsMetricLabel()}>Bias</div>
                <div style={{ ...newsMetricValue(), color: THEME.gold }}>
                  Volatile
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          {/* UPCOMING LIST */}
          <div
            style={{
              border: `1px solid ${THEME.border}`,
              borderRadius: 14,
              overflow: "hidden",
              background: THEME.panel2,
            }}
          >
            <NewsRow
              currency="EUR"
              event="ECB President Lagarde Speaks"
              time="9:15 AM"
              impact="medium"
              color="gold"
            />
            <NewsRow
              currency="USD"
              event="Core Retail Sales m/m"
              time="10:00 AM"
              impact="high"
              color="blue"
            />
            <NewsRow
              currency="GBP"
              event="GDP q/q"
              time="2:00 AM"
              impact="high"
              color="purple"
            />
            <NewsRow
              currency="JPY"
              event="BoJ Policy Statement"
              time="11:00 PM"
              impact="high"
              color="red"
              noBorder
            />
          </div>

          <div style={{ height: 12 }} />

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 11,
              opacity: 0.68,
              fontWeight: 800,
            }}
          >
            <span>Terminal-style placeholder widget</span>
            <span style={{ color: THEME.gold }}>
              Live feed later with a different provider
            </span>
          </div>
        </div>
      </div>
      )}

      <div style={{ height: 14 }} />

            {/* Progress (FULL WIDTH) */}
      <div style={panelStyle()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={sectionHeader()}>
                Progress (Win/Loss Tally)
            </div>
            <div style={sectionSubtext()}>
                Chart is <span style={{ color: THEME.gold }}>cumulative (Wins − Losses)</span>. Break-evens excluded.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => setTf("week")}
              style={chip(tf === "week")}
              title="Trading week / selected month rules"
            >
              Week
            </button>
            <button
              onClick={() => setTf("month")}
              style={chip(tf === "month")}
              title="Selected month progress"
            >
              Month
            </button>
            <button
              onClick={() => setTf("year")}
              style={chip(tf === "year")}
              title="Jan 1 → today"
            >
              Year
            </button>
            <button
              onClick={() => setTf("all")}
              style={chip(tf === "all")}
              title="All-time (as available)"
            >
              All
            </button>

          </div>
        </div>

        <div style={{ height: 10 }} />

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 12,
            background:
              "linear-gradient(180deg, rgba(12,12,14,0.92), rgba(18,18,22,0.90))",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.015)",
          }}
        >
          <div
            style={{
              minHeight: 58,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 260 }}>
              <div
                style={{
                  fontWeight: 950,
                  opacity: 0.95,
                  lineHeight: "16px",
                }}
              >
                Timeframe:{" "}
                <span style={{ color: THEME.gold }}>
                  {activeWeekRange ? `Week Preview` : rangeLabel(tf)}
                </span>
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  opacity: 0.72,
                  fontWeight: 800,
                  minHeight: 18,
                }}
              >
                {pinnedWeek ? (
                  <span>
                    Pinned:{" "}
                    <span style={{ color: THEME.blue }}>
                      {pinnedWeek.label}
                    </span>
                  </span>
                ) : weekPreview ? (
                  <span>
                    Hovering:{" "}
                    <span style={{ color: THEME.gold }}>
                      {weekPreview.label}
                    </span>
                  </span>
                ) : (
                  <span>Hover a calendar week to preview it</span>
                )}
              </div>
            </div>

            <div
               style={{
                display: "flex",
                gap: 10,  
                alignItems: "center",
                flexWrap: "nowrap",
                overflowX: "auto",
                padding: "6px 8px",
                maxWidth: "100%",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${THEME.border}`,
                  }}
              >
              <LegendDot
                label="Overall"
                color={THEME.gold}
                active={visibleSeries.overall}
                onClick={() => toggleSeries("overall")}
              />
              <LegendDot
                label="London"
                color={THEME.blue}
                active={visibleSeries.london}
                onClick={() => toggleSeries("london")}
              />
              <LegendDot
                label="NYC"
                color={THEME.purple}
                active={visibleSeries.nyc}
                onClick={() => toggleSeries("nyc")}
              />
              <LegendDot
                label="Tokyo"
                color={THEME.tokyoRed}
                active={visibleSeries.tokyo}
                onClick={() => toggleSeries("tokyo")}
              />
            </div>
          </div>

          <div style={{ height: 8 }} />

          {chartKpis && (
  <>
    <div
      style={{
        minHeight: 34,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.92,
      }}
    >
      <span style={kpiPill()}>
        Net:{" "}
        <span
          style={{
            color: chartKpis.net >= 0 ? THEME.green : THEME.red,
          }}
        >
          {chartKpis.net >= 0 ? `+${chartKpis.net}` : chartKpis.net}
        </span>
      </span>

      <span style={kpiPill()}>
        Tokyo:{" "}
        <span style={{ color: THEME.tokyoRed }}>
          {chartSeries.tokyo.length
            ? chartSeries.tokyo[chartSeries.tokyo.length - 1] >= 0
              ? `+${chartSeries.tokyo[chartSeries.tokyo.length - 1]}`
              : chartSeries.tokyo[chartSeries.tokyo.length - 1]
            : 0}
        </span>
      </span>

      <span style={kpiPill()}>
        London:{" "}
        <span style={{ color: THEME.blue }}>
          {chartSeries.london.length
            ? chartSeries.london[chartSeries.london.length - 1] >= 0
              ? `+${chartSeries.london[chartSeries.london.length - 1]}`
              : chartSeries.london[chartSeries.london.length - 1]
            : 0}
        </span>
      </span>

      <span style={kpiPill()}>
        NYC:{" "}
        <span style={{ color: THEME.purple }}>
          {chartSeries.nyc.length
            ? chartSeries.nyc[chartSeries.nyc.length - 1] >= 0
              ? `+${chartSeries.nyc[chartSeries.nyc.length - 1]}`
              : chartSeries.nyc[chartSeries.nyc.length - 1]
            : 0}
        </span>
      </span>

      {pinnedWeek && (
        <button
          type="button"
          onClick={() => setPinnedWeek(null)}
          style={{
            ...btn(false),
            padding: "6px 10px",
            borderRadius: 999,
            fontSize: 12,
          }}
          title="Clear pinned week"
        >
          Clear Pin
        </button>
      )}
    </div>

    <div style={{ height: 8 }} />
  </>
)}

{/*This is the Box for the Line graph*/}
          <div style={{ height: 220 }}>
            <svg
              width="100%"
              height="220"
              viewBox={`0 0 ${chartModel.w} ${chartModel.h}`}
              style={{
                display: "block",
                cursor: chartSeries.dates.length ? "crosshair" : "default",
              }}
              onMouseLeave={() => {
                setHoverIdx(null);
                setFocusSeries(null);
              }}
              onMouseMove={(e) => {
                if (!chartSeries.dates.length) return;

                const svg = e.currentTarget;
                const rect = svg.getBoundingClientRect();

                const mx =
                  ((e.clientX - rect.left) / rect.width) * chartModel.w;

                const my =
                  ((e.clientY - rect.top) / rect.height) * chartModel.h;

                const x0 = chartModel.padL;
                const x1 = chartModel.w - chartModel.padR;

                const clampedX = clamp(mx, x0, x1);

                let bestI = 0;
                let bestD = Infinity;

                for (let i = 0; i < chartModel.x.length; i++) {
                  const d = Math.abs(chartModel.x[i] - clampedX);
                  if (d < bestD) {
                    bestD = d;
                    bestI = i;
                  }
                }

                setHoverIdx(bestI);

                const candidates: { k: SeriesKey; dy: number }[] = (
                  ["overall", "london", "nyc", "tokyo"] as SeriesKey[]
                )
                  .filter(
                    (k) =>
                      visibleSeries[k] &&
                      chartModel.series[k].pts[bestI]
                  )
                  .map((k) => ({
                    k,
                    dy: Math.abs(
                      chartModel.series[k].pts[bestI].y - my
                    ),
                  }))
                  .sort((a, b) => a.dy - b.dy);

                setFocusSeries(candidates.length ? candidates[0].k : null);
              }}
            >
              <defs>
                <filter
                  id="lineGlow"
                  x="-30%"
                  y="-50%"
                  width="160%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="2.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient id="fillOverall" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(215,177,74,0.18)" />
                  <stop offset="100%" stopColor="rgba(215,177,74,0.00)" />
                </linearGradient>

                <linearGradient id="fillTokyo" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,92,92,0.16)" />
                  <stop offset="100%" stopColor="rgba(255,92,92,0.00)" />
                </linearGradient>

                <linearGradient id="fillLondon" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(90,180,255,0.16)" />
                  <stop offset="100%" stopColor="rgba(90,180,255,0.00)" />
                </linearGradient>

                <linearGradient id="fillNYC" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(170,110,255,0.16)" />
                  <stop offset="100%" stopColor="rgba(170,110,255,0.00)" />
                </linearGradient>

                <linearGradient id="goldShimmer" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.85)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>

                <mask id="goldLineMask">
                  <rect x="0" y="0" width={chartModel.w} height={chartModel.h} fill="black" />
                    <path
                      d={chartEnhancements.linePaths.overall}
                      fill="none"
                      stroke="white"
                      strokeWidth={seriesStrokeWidth("overall") + 2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                </mask>

              </defs>

              {chartModel.yTicks.map((t) => {
                const y = chartModel.yToPix(t);
                const isZero = Math.abs(t) < 1e-9;

                return (
                  <g key={t}>
                    <line
                      x1={chartModel.padL}
                      x2={chartModel.w - chartModel.padR}
                      y1={y}
                      y2={y}
                      stroke={
                        isZero
                          ? "rgba(255,255,255,0.20)"
                          : "rgba(255,255,255,0.07)"
                      }
                      strokeWidth={isZero ? 1.4 : 1}
                    />
                    <text
                      x={chartModel.padL - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="rgba(255,255,255,0.65)"
                      style={{ fontWeight: 800 }}
                    >
                      {t === 0 ? "0" : t > 0 ? `+${t}` : `${t}`}
                    </text>
                  </g>
                );
              })}

              {(() => {
                const n = chartModel.dates.length;
                if (n <= 1) return null;

                const marks = n <= 8 ? 3 : n <= 20 ? 4 : 5;
                const step = Math.max(1, Math.floor((n - 1) / marks));
                const idxs = new Set<number>([0, n - 1]);

                for (let i = 0; i < n; i += step) idxs.add(i);

                return Array.from(idxs)
                  .sort((a, b) => a - b)
                  .map((i) => (
                    <text
                       key={i}
                       x={chartModel.x[i]}
                       y={chartModel.h - 8}
                       textAnchor="middle"
                       fontSize="10"
                       fill="rgba(255,255,255,0.62)"
                       style={{ fontWeight: 900, letterSpacing: "0.15px" }}
                    >
                      {shortDateLabel(chartModel.dates[i])}
                    </text>
                  ));
              })()}

              {visibleSeries.overall && chartEnhancements.linePaths.overall && (
  <path
    key={chartLineAnimKey}
    d={chartEnhancements.linePaths.overall}
    fill="none"
    stroke={THEME.gold}
    strokeWidth={seriesStrokeWidth("overall")}
    filter={
      chartAnimProgress > 0.98 &&
      (focusSeries === "overall" || !focusSeries)
        ? "url(#lineGlow)"
        : undefined
    }
    opacity={seriesOpacity("overall")}
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - Math.min(chartAnimProgress * 1.15, 1)}
  />
              )}

              {visibleSeries.overall &&
                chartEnhancements.linePaths.overall &&
                (!focusSeries || focusSeries === "overall") &&
                chartAnimProgress > 0.98 && (
                <rect
                  x={chartModel.padL}
                  y={chartModel.padT}
                  width={chartModel.w - chartModel.padL - chartModel.padR}
                  height={chartModel.h - chartModel.padT - chartModel.padB}
                  fill="url(#goldShimmer)"
                  mask="url(#goldLineMask)"
                  opacity={0.55}
                >
                <animate
                  attributeName="x"
                  from={chartModel.padL - (chartModel.w - chartModel.padL - chartModel.padR)}
                  to={chartModel.w - chartModel.padR}
                  dur="3.6s"
                  repeatCount="indefinite"
                />
                </rect>
              )}

              {visibleSeries.tokyo && chartEnhancements.linePaths.tokyo && (
  <path
    d={chartEnhancements.linePaths.tokyo}
    fill="none"
    stroke={THEME.tokyoRed}
    strokeWidth={seriesStrokeWidth("tokyo")}
    opacity={seriesOpacity("tokyo")}
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - chartAnimProgress}
  />
              )}

              {visibleSeries.london && chartEnhancements.linePaths.london && (
  <path
    d={chartEnhancements.linePaths.london}
    fill="none"
    stroke={THEME.blue}
    strokeWidth={seriesStrokeWidth("london")}
    opacity={seriesOpacity("london")}
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - chartAnimProgress}
  />
              )}

              {visibleSeries.nyc && chartEnhancements.linePaths.nyc && (
  <path
    d={chartEnhancements.linePaths.nyc}
    fill="none"
    stroke={THEME.purple}
    strokeWidth={seriesStrokeWidth("nyc")}
    opacity={seriesOpacity("nyc")}
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - chartAnimProgress}
  />
              )}

                              {hoverIdx !== null &&
                (["overall", "tokyo", "london", "nyc"] as SeriesKey[]).map((k) => {
                  if (!visibleSeries[k]) return null;

                  const p = chartModel.series[k].pts[hoverIdx];
                  if (!p) return null;

                  const color =
                    k === "overall"
                      ? THEME.gold
                      : k === "tokyo"
                      ? THEME.tokyoRed
                      : k === "london"
                      ? THEME.blue
                      : THEME.purple;

                  return (
                      <g key={k}>
                  {/* Glow ring (only for active series) */}
                  {(focusSeries === k || !focusSeries) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6.5}
                    fill="none"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1.4}
                    style={{
                        animation: "pulse 1.6s ease-in-out infinite",
                      }}
                  />
                  )}

              {/* Main dot */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={focusSeries ? (focusSeries === k ? 5.2 : 2.0) : 4.0}
                    fill={color}
                    stroke={focusSeries === k || !focusSeries ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.55)"}
                    strokeWidth={focusSeries === k || !focusSeries ? 1.5 : 1.15}
                    opacity={seriesOpacity(k)}
                    style={{
                      transition: "r 120ms ease, opacity 120ms ease, stroke 120ms ease",
                      filter: focusSeries === k || !focusSeries ? "drop-shadow(0 0 8px rgba(255,255,255,0.18))" : "none",
                    }}
                  />
                </g>
              );
                })}

              {hoverIdx !== null &&
                (() => {
                  if (
                    hoverIdx < 0 ||
                    hoverIdx >= chartModel.x.length ||
                    hoverIdx >= chartModel.dates.length
                  ) {
                    return null;
                  }

                  const x = chartModel.x[hoverIdx];
                  const iso = chartModel.dates[hoverIdx];

                  if (!Number.isFinite(x) || !iso) {
                    return null;
                  }

                  const get = (k: SeriesKey) =>
                    chartModel.series[k].values[hoverIdx] ?? 0;

                  const prev = (k: SeriesKey) =>
                    hoverIdx > 0
                      ? chartModel.series[k].values[hoverIdx - 1] ?? 0
                      : 0;

                  const prev3 = (k: SeriesKey) =>
                    hoverIdx > 2
                      ? chartModel.series[k].values[hoverIdx - 3] ?? 0
                      : prev(k);

                  const vO = get("overall");
                  const vT = get("tokyo");
                  const vL = get("london");
                  const vN = get("nyc");

                  const dO = vO - prev("overall");
                  const dT = vT - prev("tokyo");
                  const dL = vL - prev("london");
                  const dN = vN - prev("nyc");

                  const mO = vO - prev3("overall");

                  const overlayIdx =
                    overlaySeries?.dates.findIndex((d) => d === iso) ?? -1;

                  const overlayOverall =
                    overlayIdx >= 0
                      ? overlaySeries?.overall[overlayIdx] ?? null
                      : null;

                  const overlayDelta =
                    overlayOverall !== null ? vO - overlayOverall : null;

                  const boxW = 260;
                  const boxH = overlayOverall !== null ? 154 : 132;

                  const bx = clamp(
                    x + 12,
                    chartModel.padL,
                    chartModel.w - chartModel.padR - boxW
                  );

                  const by = chartModel.padT + 6;
                  const row1 = by + 18;
                  const row2 = by + 38;
                  const row3 = by + 58;
                  const row4 = by + 78;

                  const fmt = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

                  const tooltipRows = [
                                        {
                                          key: "overall" as const,
                                          label: "Overall",
                                          value: vO,
                                          delta: dO,
                                          color: THEME.gold,
                                        },
                                        {
                                          key: "london" as const,
                                          label: "London",
                                          value: vL,
                                          delta: dL,
                                          color: THEME.blue,
                                        },
                                        {
                                          key: "nyc" as const,
                                          label: "NYC",
                                          value: vN,
                                          delta: dN,
                                          color: THEME.purple,
                                        },
                                        {
                                          key: "tokyo" as const,
                                          label: "Tokyo",
                                          value: vT,
                                          delta: dT,
                                          color: THEME.tokyoRed,
                                        },
                                      ] satisfies Array<{
                                        key: SeriesKey;
                                        label: string;
                                        value: number;
                                        delta: number;
                                        color: string;
                                        }>;

                  const orderedRows = (focusSeries
  ? [
      ...tooltipRows.filter((row) => row.key === focusSeries),
      ...tooltipRows.filter((row) => row.key !== focusSeries),
    ]
  : tooltipRows
).filter((row) => visibleSeries[row.key]);

                  return (
                    <g>
                      <line
                        x1={x}
                        x2={x}
                        y1={chartModel.padT}
                        y2={chartModel.h - chartModel.padB}
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth={1.2}
                        strokeDasharray="3 5"
                        style={{
                          filter: "blur(0.2px)",
                          }}
                      />

                      <rect
                        x={Number.isFinite(bx) ? bx : 0}
                        y={Number.isFinite(by) ? by : 0}
                        width={Number.isFinite(boxW) ? boxW : 0}
                        height={boxH}
                        rx={12}
                        fill="rgba(8,8,10,0.88)"
                        stroke="rgba(255,255,255,0.14)"
                        style={{
                          filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.28))",
                        }}
                      />

                      <rect
                        x={Number.isFinite(bx) ? bx : 0}
                        y={Number.isFinite(by) ? by : 0}
                        width={Number.isFinite(boxW) ? boxW : 0}
                        height={3}
                        rx={12}
                        fill={focusSeries === "tokyo"
                          ? THEME.tokyoRed
                          : focusSeries === "london"
                          ? THEME.blue
                          : focusSeries === "nyc"
                          ? THEME.purple
                          : THEME.gold}
                      />

                      <rect
                        x={chartModel.padL}
                        y={chartModel.padT}
                        width={chartModel.w - chartModel.padL - chartModel.padR}
                        height={chartModel.h - chartModel.padT - chartModel.padB}
                        rx={10}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={1}
                      />

                      <text
                        x={bx + 10}
                        y={row1}
                        fontSize="11"
                        fill="rgba(255,255,255,0.88)"
                        style={{ fontWeight: 950 }}
                      >
                        {shortDateLabel(iso)}
                      </text>

                      <text
                        x={bx + 10}
                        y={row2}
                        fontSize="11"
                        fill={THEME.gold}
                        style={{ fontWeight: 900 }}
                      >
                        Momentum:{" "}
                        <tspan fill={mO >= 0 ? THEME.green : THEME.red}>
                          {fmt(mO)}
                        </tspan>
                      </text>

                      {overlayOverall !== null && (
  <text
    x={bx + 10}
    y={row3}
    fontSize="10.5"
    fill={THEME.blue}
    style={{ fontWeight: 900 }}
  >
    Pinned: {fmt(overlayOverall)}{" "}
    <tspan fill="rgba(255,255,255,0.60)">Δ</tspan>{" "}
    <tspan
      fill={
        (overlayDelta ?? 0) >= 0
          ? THEME.green
          : THEME.red
      }
    >
      {fmt(overlayDelta ?? 0)}
    </tspan>
  </text>
)}

                    {orderedRows.map((row, idx) => {
  const yBase = overlayOverall !== null ? row4 : row3;
  const y = yBase + idx * 20;
  const isActive = focusSeries === row.key || !focusSeries;

  return (
    <text
      key={row.key}
      x={bx + 10}
      y={y}
      fontSize="10.5"
      fill={isActive ? row.color : "rgba(255,255,255,0.42)"}
      style={{ fontWeight: isActive ? 950 : 700 }}
      opacity={1}
    >
      {row.label}: {fmt(row.value)}{" "}
      <tspan fill="rgba(255,255,255,0.48)">Δ</tspan>{" "}
      <tspan fill={row.delta >= 0 ? THEME.green : THEME.red}>
        {fmt(row.delta)}
      </tspan>
    </text>
  );
})}  
                    </g>
                  );
                })()}
            </svg>

            {!chartSeries.dates.length && (
              <div
                style={{
                  opacity: 0.75,
                  fontWeight: 800,
                  padding: 10,
                }}
              >
                No public data yet for this timeframe.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              opacity: 0.62,
              fontWeight: 800,
            }}
          >
            Tip: Hover a week → preview • Click Pin Week → lock • Hover chart → focus line • Click legend → toggle series
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ ...panelStyle(), marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div style={sectionHeader()}>Calendar</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: THEME.gold,
              }}
            >
              {monthCursor.getFullYear()}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              marginLeft: "auto",
              paddingLeft: 18,
            }}
          >
            <button
  onClick={openMonthSummaryFromMTD}
  style={btnPrimary(false)}
  title="Open month summary"
>
  Month Summary
</button>

<button
  onClick={() => openYearSummaryYTD().catch((e) => console.error(e))}
  style={btnPrimary(false)}
  title="Open year-to-date summary"
>
  Year Summary
</button>

<button
  onClick={() => openAllTimeSummary().catch((e) => console.error(e))}
  style={btnPrimary(false)}
  title="Open all-time summary"
>
  All-Time Summary
</button>

            <button
              onClick={() =>
                setCalendarDensity((d) =>
                  d === "simple" ? "detailed" : "simple"
                )
              }
              style={btnPrimary(false)}
            >
              {calendarDensity === "simple"
                ? "Detailed View"
                : "Simple View"}
            </button>

            <div style={{ width: 10 }} />

            <button
              onClick={() =>
                setMonthCursor(
                  (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
                )
              }
              style={btnPrimary(false)}
              disabled={loading}
            >
              Prev
            </button>

            <div style={{ width: 8 }} />

            <div
              style={{
                fontWeight: 950,
                minWidth: 210,
                textAlign: "center",
                color: THEME.gold,
                fontSize: 20,
                letterSpacing: 0.45,
              }}
            >
              {monthLabel(monthCursor)}
            </div>

            <div style={{ width: 8 }} />

            <button
              onClick={() =>
                setMonthCursor(
                  (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
                )
              }
              style={btnPrimary(false)}
              disabled={loading}
            >
              Next
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              minWidth: 980,
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <th key={d} style={th()}>
                    {d}
                  </th>
                ))}
                <th style={{ ...th(), width: 170 }}>Week Summary</th>
              </tr>
            </thead>

            <tbody>
                            {weeks.map((row, wi) => {
                const first = row[0];
                const last = row[row.length - 1];

                const startISO = toISODate(first);
                const endISO = toISODate(last);

                const label = `${shortDateLabel(startISO)} → ${shortDateLabel(
                  endISO
                )}`;

                const range = { startISO, endISO, label };

                let w = 0;
                let l = 0;
                let be = 0;

                row.forEach((d) => {
                  if (isWeekendDate(d)) return;

                  const iso = toISODate(d);
                  const r = calendarMap.get(iso);

                  if (!r) return;

                  w += safeNum(r.wins);
                  l += safeNum(r.losses);
                  be += safeNum(r.breakevens);
                });

                const winRate = winRatePct(w, l);

                const isPreview =
                  weekPreview &&
                  weekPreview.startISO === startISO &&
                  weekPreview.endISO === endISO;

                const isPinned =
                  pinnedWeek &&
                  pinnedWeek.startISO === startISO &&
                  pinnedWeek.endISO === endISO;

                return (
                  <tr
                    key={wi}
                    onMouseEnter={() => setWeekPreview(range)}
                    onMouseLeave={() => { if (!isPinned) setWeekPreview(null);}}
                    style={{
                      background: isPinned
                        ? "rgba(90,180,255,0.08)"
                        : isPreview
                        ? "rgba(255,255,255,0.04)"
                        : undefined,
                    }}
                  >
                    {row.map((d) => {
                      const iso = toISODate(d);
                      const r = calendarMap.get(iso);

                      const wins = safeNum(r?.wins);
                      const losses = safeNum(r?.losses);
                      const be = safeNum(r?.breakevens);

                      const total = wins + losses + be;

                      const inMonth =
                        d.getMonth() === monthCursor.getMonth();

                      const bg = total
                        ? heatBgForDay(wins, losses, be)
                        : "transparent";

                      const hot = hotStreakMap.get(iso) ?? 0;
                      const holidayName =
                        holidayMap.get(iso) ?? null;
                      const isHoliday = Boolean(holidayName);

                      return (
  <td
    key={iso}
    style={{
      ...td(),
      background: "transparent",
      opacity: inMonth ? 1 : 0.42,
      padding: 8,
      position: "relative",
      verticalAlign: "top",
    }}
    onClick={() => openDay(iso)}
  >
      <div
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow =
        isHoliday
          ? "0 0 0 1px rgba(215,177,74,0.22) inset, 0 8px 22px rgba(215,177,74,0.12)"
          : hot > 1
          ? "0 0 0 1px rgba(215,177,74,0.18) inset, 0 8px 18px rgba(0,0,0,0.24)"
          : total > 0
          ? "0 0 0 1px rgba(255,255,255,0.02) inset, 0 8px 18px rgba(0,0,0,0.24)"
          : "0 8px 18px rgba(0,0,0,0.18)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0px)";
      e.currentTarget.style.boxShadow =
        isHoliday
          ? "0 0 0 1px rgba(215,177,74,0.16) inset"
          : hot > 1
          ? "0 0 0 1px rgba(215,177,74,0.18) inset"
          : total > 0
          ? "0 0 0 1px rgba(255,255,255,0.02) inset"
          : "none";
    }}
    style={{
      border: `1px solid ${
        isHoliday
          ? "rgba(215,177,74,0.38)"
          : hot > 1
          ? "rgba(215,177,74,0.55)"
          : total > 0
          ? "rgba(255,255,255,0.10)"
          : THEME.border
      }`,
      borderRadius: 16,
      background: isHoliday
        ? "linear-gradient(135deg, rgba(215,177,74,0.13), rgba(215,177,74,0.035))"
        : total > 0
        ? `linear-gradient(180deg, ${bg}, rgba(0,0,0,0.35))`
        : "rgba(255,255,255,0.01)",
      minHeight: 118,
      padding: 10,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow:
        isHoliday
          ? "0 0 0 1px rgba(215,177,74,0.16) inset"
          : hot > 1
          ? "0 0 0 1px rgba(215,177,74,0.18) inset"
          : total > 0
          ? "0 0 0 1px rgba(255,255,255,0.02) inset"
          : "none",
      cursor: "pointer",
      transition:
        "transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease",

    }}
      title={`${shortDateLabel(iso)}${
        holidayName
          ? ` • ${holidayName} • US Markets Closed`
          : ""
      }${
        total > 0
          ? ` • Net ${
              wins - losses >= 0 ? "+" : ""
            }${wins - losses}`
          : ""
      }`}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div
          style={{
            fontWeight: 950,
            fontSize: 13,
            opacity: inMonth ? 0.95 : 0.62,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {d.getDate()}
        </div>

      </div>

      {isHoliday && (
        <div
          title={`${holidayName} • US Markets Closed`}
          style={{
            marginTop: 8,
            paddingRight: hot > 1 ? 34 : 0,
            color: THEME.gold,
            fontSize: 11,
            fontWeight: 950,
            lineHeight: "14px",
            letterSpacing: 0.1,
          }}
        >
          {holidayName}
        </div>
      )}

      {calendarDensity === "detailed" ? (
  total > 0 ? (
    <div
      style={{
        marginTop: 14,
        display: "grid",
        gap: 10,
        alignContent: "center",
        minHeight: 66,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              color: THEME.green,
              fontWeight: 950,
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            {wins}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: THEME.gold,
              opacity: 0.9,
              fontWeight: 900,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            {be}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              color: THEME.red,
              fontWeight: 950,
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            {losses}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          alignItems: "start",
          fontSize: 10,
          fontWeight: 900,
          opacity: 0.84,
          letterSpacing: 0.2,
        }}
      >
        <div style={{ textAlign: "left" }}>TP</div>
        <div style={{ textAlign: "center" }}>BE</div>
        <div style={{ textAlign: "right" }}>SL</div>
      </div>
    </div>
  ) : (
    <div style={{ flex: 1 }} />
  )
) : (

        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 8,
            minHeight: 40,
          }}
        >
          <div
  style={{
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1,
    color:
      total <= 0
        ? "rgba(255,255,255,0.18)"
        : wins - losses >= 0
        ? THEME.green
        : THEME.red,
  }}
>
  {total > 0 ? (wins - losses >= 0 ? `+${wins - losses}` : `${wins - losses}`) : ""}
</div>
        </div>
      )}

      {hot > 1 && (
  <div
    title={`Hot streak: ${hot} days`}
    style={{
      position: "absolute",
      right: 10,
      top: 8,
      fontSize: 18,
      fontWeight: 950,
      color: THEME.gold,
      opacity: 0.95,
    }}
  >
    🔥{hot}
  </div>
)}
    </div>
  </td>
);
                    })}

<td
  style={{
    ...td(),
    background: "rgba(255,255,255,0.03)",
    padding: 8,
    verticalAlign: "top",
  }}
  onMouseEnter={() => setWeekPreview(range)}
  onMouseLeave={() => {
    if (!isPinned) setWeekPreview(null);
  }}
>
  <div
  onClick={() =>
  openRangeSummary(
    `Week Summary (${label})`,
    startISO,
    endISO,
    "weekly"
  )
}
  onMouseEnter={() => setWeekPreview(range)}
  onMouseLeave={() => {
    if (!isPinned) setWeekPreview(null);
  }}
  title="Click to open weekly stats"
  style={{
  border: `1px solid ${
  isPinned
    ? "rgba(90,180,255,0.28)"
    : isPreview
    ? "rgba(215,177,74,0.24)"
    : "rgba(255,255,255,0.07)"
}`,
  borderRadius: 18,
  background: isPinned
    ? "rgba(90,180,255,0.06)"
    : "rgba(255,255,255,0.02)",
  padding: "16px 16px 14px",
  cursor: "pointer",
  display: "grid",
  gap: 14,
  minHeight: 136,
  boxShadow: isPinned
    ? "0 0 0 1px rgba(90,180,255,0.12) inset"
    : isPreview
    ? "0 0 0 1px rgba(215,177,74,0.10) inset"
    : "none",
}}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        marginBottom: 2
      }}
    >
      <div
        style={{
          fontWeight: 950,
          color: THEME.gold,
          fontSize: 14,
          letterSpacing: 0.2,
          lineHeight: 1,
        }}
      >
        Week {w >= 30 ? " 👑" : ""}
      </div>

      <button
          style={{
            ...btn(false),
              padding: "7px 12px",
              borderRadius: 999,
              fontSize: 11,
              lineHeight: 1,
              minWidth: 72,
              background: isPinned
                ? "rgba(215,177,74,0.18)"
                : "rgba(255,255,255,0.06)",
              border: `1px solid ${
              isPinned ? "rgba(215,177,74,0.40)" : THEME.border
              }`,
            }}
          onClick={(e) => {
            e.stopPropagation();
              togglePinnedWeek(range);
              }}
        >
          {isPinned ? "Pinned ✓" : "Pin Week"}
        </button>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
        alignItems: "start",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ color: THEME.green, fontWeight: 950, fontSize: 11, opacity: 0.9, }}>W</div>
        <div style={{ color: THEME.green, fontWeight: 950, fontSize: 18, lineHeight: 1, }}>
          {w}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ color: THEME.gold, fontWeight: 950, fontSize: 11, opacity: 0.9, }}>BE</div>
        <div style={{ color: THEME.gold, fontWeight: 950, fontSize: 18, lineHeight: 1, }}>
          {be}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ color: THEME.red, fontWeight: 950, fontSize: 11, opacity: 0.9, }}>L</div>
        <div style={{ color: THEME.red, fontWeight: 950, fontSize: 18, lineHeight: 1, }}>
          {l}
        </div>
      </div>
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
        fontWeight: 900,
        paddingTop: 2,
      }}
    >
      <span style={{ opacity: 0.78, fontWeight: 900 }}>Win rate</span>
      <span style={{ color: THEME.gold, fontWeight: 800 }}>
        {fmtPct01(winRate)}
      </span>
    </div>
  </div>
</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            fontWeight: 800,
            opacity: 0.72,
          }}
        >
          US federal holidays use observed dates and are lightly shaded.
        </div>
      </div>
            {/* Day Modal */}
{/* Daily recap modal */}
{modalOpen && selectedISO && (
  <RecapImageModal
    src={
      `/api/daily-summary-card` +
      `?date=${encodeURIComponent(selectedISO)}`
    }
    alt={`Daily recap for ${selectedISO}`}
    onClose={closeModal}
    maxWidth={1000}
  />
)}

{/* Discord-matched Weekly / Monthly recap modal */}
{summaryOpen && summaryCardUrl && (
  <RecapImageModal
    src={summaryCardUrl}
    alt={summaryTitle}
    onClose={() => {
      setSummaryOpen(false);
      setSummaryCardUrl(null);
    }}
    maxWidth={1000}
  />
)}
      {/* Summary Modal */}
      {summaryOpen && !summaryCardUrl && (
        <div
          onClick={() => setSummaryOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 55,
            padding: 20,
            }}
        >
          <div
                onClick={(e) => e.stopPropagation()}
                  style={{
                      width: "min(780px, 100%)",
                      background:
                        "linear-gradient(135deg, rgba(25,25,30,0.95), rgba(10,10,12,0.95))",
                      borderRadius: 18,
                      padding: 18,
                      border: `1px solid ${THEME.border}`,
                      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                      animation: "fadeIn 0.18s ease-out",
                    }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>
                    Summary
                </div>
                
                <div style={{ fontSize: 22, fontWeight: 950, color: THEME.gold }}>
                  {summaryTitle}
                </div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800, marginTop: 4 }}>
                  Click outside or press Esc to close.
                </div>
              </div>

              <button onClick={() => setSummaryOpen(false)} style={btnPrimary(false)}>
                Close
              </button>
            </div>

            <div style={{ height: 14 }} />

{summaryLoading ? (
  <div
    style={{
      border: `1px solid ${THEME.border}`,
      borderRadius: 16,
      background: "rgba(255,255,255,0.02)",
      padding: 18,
      display: "grid",
      gap: 12,
    }}
  >
    <div
      style={{
        fontSize: 14,
        fontWeight: 950,
        color: THEME.gold,
      }}
    >
      Loading summary...
    </div>

    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        opacity: 0.72,
      }}
    >
      Pulling totals and session breakdowns for this range.
    </div>

    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "34%",
          height: "100%",
          borderRadius: 999,
          background:
            "linear-gradient(90deg, rgba(215,177,74,0.18), rgba(215,177,74,0.70), rgba(215,177,74,0.18))",
          animation: "summaryLoad 1.15s ease-in-out infinite",
        }}
      />
    </div>
  </div>
) : (
  <>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {[
        {
          title: "Wins",
          value: fmtInt(summaryOverall?.wins ?? 0),
          color: THEME.green,
          icon: "☑",
        },
        {
          title: "Losses",
          value: fmtInt(summaryOverall?.losses ?? 0),
          color: THEME.red,
          icon: "✕",
        },
        {
          title: "B/E",
          value: fmtInt(summaryOverall?.breakevens ?? 0),
          color: THEME.gold,
          icon: "■",
        },
        {
          title: "Win Rate",
          value: fmtPct01(
                 winRatePct(
            summaryOverall?.wins ?? 0,
            summaryOverall?.losses ?? 0
                  )
          ),
          color: "#d9e4ff",
          icon: "▰",
        },
      ].map((item) => (
        <div
          key={item.title}
          style={{
            border: `1px solid ${THEME.border}`,
            borderLeft: `3px solid ${item.color}`,
            borderRadius: 16,
            background: "rgba(255,255,255,0.02)",
            padding: 14,
            minHeight: 92,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: THEME.gold,
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 950,
                color: item.color,
                opacity: 0.95,
              }}
            >
              {item.icon}
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
              fontSize: 18,
              fontWeight: 950,
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  </>
)}

            <div style={{ height: 14 }} />

            <div>
  <div
    style={{
      fontSize: 13,
      fontWeight: 950,
      color: THEME.gold,
      marginBottom: 4,
    }}
  >
    Session Win Rates
  </div>
  <div
    style={{
      fontSize: 12,
      fontWeight: 800,
      opacity: 0.72,
      marginBottom: 12,
    }}
  >
    Tokyo • London • NYC
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 12,
    }}
  >
    {(["tokyo", "london", "nyc"] as Session[]).map((s) => {
      const r = summaryBySession?.[s] ?? {
        wins: 0,
        losses: 0,
        breakevens: 0,
      };

      const wr = winRatePct(r.wins, r.losses);
      const label = s.toUpperCase();

      return (
        <div
          key={s}
         style={{
  border:
    summaryBestSession?.label === label
      ? "1px solid rgba(215,177,74,0.42)"
      : `1px solid ${THEME.border}`,
  borderRadius: 16,
  background:
    summaryBestSession?.label === label
      ? "linear-gradient(180deg, rgba(215,177,74,0.08), rgba(255,255,255,0.02))"
      : "rgba(255,255,255,0.02)",
  padding: 14,
  boxShadow:
    summaryBestSession?.label === label
      ? "0 0 18px rgba(215,177,74,0.10)"
      : "none",
}}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontWeight: 950,
                fontSize: 16,
                color: THEME.gold,
                letterSpacing: 0.4,
              }}
            >
              {label}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                opacity: 0.82,
              }}
            >
              Reported
            </div>
          </div>

          <div style={{ height: 16 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ color: THEME.green, fontWeight: 950, fontSize: 26, lineHeight: 1 }}>
                {r.wins}
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ color: THEME.gold, fontWeight: 950, fontSize: 22, lineHeight: 1 }}>
                {r.breakevens}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ color: THEME.red, fontWeight: 950, fontSize: 26, lineHeight: 1 }}>
                {r.losses}
              </div>
            </div>
          </div>

          <div style={{ height: 8 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              fontSize: 11,
              fontWeight: 900,
              opacity: 0.85,
            }}
          >
            <div style={{ textAlign: "left" }}>TP</div>
            <div style={{ textAlign: "center" }}>BE</div>
            <div style={{ textAlign: "right" }}>SL</div>
          </div>

          <div style={{ height: 14 }} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            <span style={{ opacity: 0.8 }}>Win rate</span>
            <span style={{ color: THEME.gold }}>{fmtPct01(wr)}</span>
          </div>
          <div style={{ height: 10 }} />

<div
  style={{
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.72,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  }}
>
  <span>Net</span>
  <span style={{ color: r.wins - r.losses >= 0 ? THEME.green : THEME.red }}>
    {r.wins - r.losses >= 0 ? `+${r.wins - r.losses}` : r.wins - r.losses}
  </span>
</div>


        </div>
      );
    })}
  </div>

  <div
    style={{
      marginTop: 12,
      fontSize: 12,
      fontWeight: 800,
      opacity: 0.72,
    }}
  >
    Note: This is accuracy by outcomes (targets hit vs losses). It is not trade count.
  </div>
</div>
          </div>
        </div>
      )}
    </main>
  );
}

function RecapImageModal({
  src,
  alt,
  onClose,
  maxWidth = 1000,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  maxWidth?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        padding: 20,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,0.76)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width: `min(${maxWidth}px, 100%)`,
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          borderRadius: 18,
          border:
            "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(135deg, rgba(25,25,30,0.98), rgba(8,8,10,0.98))",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.72)",
          padding: 12,
          animation:
            "fadeIn 0.18s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={btnPrimary(false)}
          >
            Close
          </button>
        </div>

        <img
          src={src}
          alt={alt}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            borderRadius: 14,
          }}
        />
      </div>
    </div>
  );
}

function kpiPill(): React.CSSProperties {
  return {
    padding: "6px 10px",
    border: `1px solid ${THEME.border}`,
    borderRadius: 999,
    background: "rgba(0,0,0,0.22)",
    whiteSpace: "nowrap",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.015)",
    backdropFilter: "blur(3px)",
  };
}

function panelStyle(): React.CSSProperties {
  return {
    border: `1px solid rgba(255,255,255,0.07)`,
    borderRadius: 18,
    padding: 16,
    background: `
      linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.008)),
      radial-gradient(900px 420px at 12% 12%, rgba(140,95,255,0.10), rgba(0,0,0,0)),
      radial-gradient(900px 420px at 88% 10%, rgba(215,177,74,0.10), rgba(0,0,0,0)),
      rgba(10,10,12,0.94)
    `,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.015)",
  };
}

function btnPrimary(active = false): React.CSSProperties {
  return {
    padding: "7px 11px",
    borderRadius: 10,
    border: `1px solid ${active ? "rgba(215,177,74,0.34)" : "rgba(255,255,255,0.08)"}`,
    background: active
      ? "linear-gradient(180deg, rgba(215,177,74,0.16), rgba(255,255,255,0.05))"
      : "rgba(255,255,255,0.035)",
    color: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 800,
    fontSize: 12,
    lineHeight: 1.05,
    minHeight: 36,
    boxShadow: active ? "0 0 0 1px rgba(215,177,74,0.10) inset" : "none",
  };
}

function sectionHeader(): React.CSSProperties {
  return {
    fontSize: 17,
    fontWeight: 850,
    color: THEME.gold,
    letterSpacing: 0.2,
    lineHeight: 1.1,
  };
}

function sectionSubtext(): React.CSSProperties {
  return {
    opacity: 0.68,
    fontWeight: 600,
    fontSize: 11,
    lineHeight: 1.2,
  };
}

function primaryPanel(): React.CSSProperties {
  return {
    border: `1px solid rgba(215,177,74,0.35)`,
    borderRadius: 20,
    padding: 20,
    background: `
      radial-gradient(1200px 600px at 0% 0%, rgba(215,177,74,0.10), transparent),
      radial-gradient(800px 400px at 100% 0%, rgba(168,85,247,0.10), transparent),
      ${THEME.panel}
    `,
    boxShadow: "0 0 0 1px rgba(215,177,74,0.10), 0 20px 40px rgba(0,0,0,0.35)",
  };
}

function btn(primary = false): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${
      primary ? "rgba(215,177,74,0.28)" : THEME.border
    }`,
    background: primary
      ? `linear-gradient(135deg, rgba(215,177,74,0.18), rgba(255,255,255,0.06))`
      : "rgba(255,255,255,0.06)",
    color: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 900,
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

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${
      active ? "rgba(215,177,74,0.34)" : "rgba(255,255,255,0.08)"
    }`,
    background: active
      ? "linear-gradient(180deg, rgba(215,177,74,0.14), rgba(255,255,255,0.04))"
      : "rgba(255,255,255,0.03)",
    color: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 800,
    fontSize: 12,
    lineHeight: 1.05,
    minHeight: 34,
    boxShadow: "none",
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

function miniPanel(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    padding: 14,
    background: THEME.panel2,
  };
}

function th(): React.CSSProperties {
  return {
    textAlign: "left",
    borderBottom: `1px solid ${THEME.border}`,
    padding: 8,
    fontSize: 12,
    opacity: 0.9,
    fontWeight: 950,
    color: THEME.gold,
  };
}

function td(): React.CSSProperties {
  return {
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    padding: 8,
    verticalAlign: "top",
    height: 96,
    cursor: "pointer",
  };
}

type TickerRailStyle = React.CSSProperties & {
  ["--tkSpeed"]?: string;
};

function NewsTickerBar({
  label = "NEXT LIVE",
  text,
  rightPill,
  href,
  speedSec = 22,
  flash = false,
  live = false,
  soon = false,
  soonLabel = "SOON",
  flagCountry,
}: {
  label?: string;
  text: string;
  rightPill?: string;
  href: string;
  speedSec?: number;
  flash?: boolean;
  live?: boolean;
  soon?: boolean;
  soonLabel?: string;
  flagCountry?: "jp" | "gb" | "us" | null;
}) {
  const isLive = !!live;

  const railStyle: TickerRailStyle = {
    ["--tkSpeed"]: `${speedSec}s`,
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: rightPill ? "auto 1fr auto" : "auto 1fr",
        alignItems: "center",
        gap: 0,
        border: `1px solid ${THEME.border}`,
        background: "rgba(255,255,255,0.05)",
        borderRadius: 14,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
      }}
      className={["tkTicker", isLive ? "tkLive" : "", flash ? "tkFlash" : ""].join(" ")}
      title="Join Today!"
    >
      <div className="tkGoldSweep" aria-hidden="true" />

      {(isLive || soon) && (
        <div className={["tkSash", isLive ? "tkSashLive" : "tkSashSoon"].join(" ")}>
          {isLive ? "LIVE" : soonLabel}
        </div>
      )}

      <div
        className="tkLeftLabel"
        style={{
          background: isLive ? "rgba(255, 60, 60, 0.95)" : THEME.deepRed,
          color: "white",
          fontWeight: 950,
          letterSpacing: 0.6,
          padding: "10px 12px",
          fontSize: 12,
          textTransform: "uppercase",
          borderRight: `1px solid ${THEME.border}`,
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          position: "relative",
          zIndex: 6,
        }}
      >
        {isLive && (
          <span className="tkLiveDotWrap" aria-hidden="true">
            <span className="tkLiveDot" />
            <span className="tkLiveRing" />
          </span>
        )}
        {label}:
      </div>

      <div
        className="tkTickerViewport"
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "10px 12px",
          minWidth: 0,
          zIndex: 6,
        }}
      >
        <div className="tkTickerRail" style={railStyle} aria-label="Bulletin ticker">
          <div className="tkTickerCopy">
            {flagCountry && (
              <span style={{ marginRight: 8, display: "inline-flex", alignItems: "center" }}>
                <FlagIcon country={flagCountry} size={18} />
              </span>
            )}
            <span style={{ color: THEME.gold }}>{text}</span>
            <span style={{ padding: "0 46px", opacity: 0.35 }}>•</span>
          </div>

          <div className="tkTickerCopy" aria-hidden="true">
            {flagCountry && (
              <span style={{ marginRight: 8, display: "inline-flex", alignItems: "center" }}>
                <FlagIcon country={flagCountry} size={18} />
              </span>
            )}
            <span style={{ color: THEME.gold }}>{text}</span>
            <span style={{ padding: "0 46px", opacity: 0.35 }}>•</span>
          </div>
        </div>
      </div>

      <div style={{ paddingRight: 12, position: "relative", zIndex: 6 }}>
        {rightPill && (
          <div
            style={{
              border: `1px solid ${THEME.border}`,
              background: "rgba(0,0,0,0.28)",
              padding: "9px 14px",
              borderRadius: 999,
              fontWeight: 950,
              fontSize: 13,
              whiteSpace: "nowrap",
              boxShadow: `0 0 18px ${THEME.purpleSoft}`,
              opacity: 0.98,
            }}
          >
            {rightPill}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes tkTickerScroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
            }
          to {
            opacity: 1;
            transform: translateY(0px) scale(1);
            }
          }

        @keyframes summaryLoad {
          0% { transform: translateX(-120%); opacity: 0.35; }
          50% { opacity: 1; }
          100% { transform: translateX(320%); opacity: 0.35; }
        }

        @keyframes tkSlideIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0px); }
        }
        @keyframes tkFlashGlow {
          0% { box-shadow: 0 0 0 rgba(255,255,255,0); filter: brightness(1); }
          25% { box-shadow: 0 0 34px rgba(255,255,255,0.18); filter: brightness(1.18); }
          100% { box-shadow: 0 0 0 rgba(255,255,255,0); filter: brightness(1); }
        }
        @keyframes liveDotPulse {
          0% { transform: scale(0.92); opacity: 0.85; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.92); opacity: 0.85; }
        }
        @keyframes liveRing {
          0% { opacity: 0; transform: scale(0.65); }
          20% { opacity: 0.55; }
          100% { opacity: 0; transform: scale(1.25); }
        }
        @keyframes tkGoldSweepX {
          0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
          6% { opacity: 1; }
          18% { transform: translateX(140%) skewX(-18deg); opacity: 1; }
          22% { opacity: 0; }
          30% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
          36% { opacity: 1; }
          48% { transform: translateX(140%) skewX(-18deg); opacity: 1; }
          52% { opacity: 0; }
          100% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
        }
        @keyframes tkLiveLabelStrobe {
          0% { filter: brightness(1); }
          40% { filter: brightness(1.18); }
          100% { filter: brightness(1); }
        }

        @keyframes pulse {
           0% { opacity: 0.2; transform: scale(0.95); }
          50% { opacity: 0.5; transform: scale(1.05); }
          100% { opacity: 0.2; transform: scale(0.95); }
          }

        .tkTicker { animation: tkSlideIn 260ms ease-out both; }
        .tkFlash { animation: tkSlideIn 260ms ease-out both, tkFlashGlow 1.35s ease-out both; }

        .tkTickerRail {
          display: flex;
          width: max-content;
          white-space: nowrap;
          will-change: transform;
          font-weight: 700;
          letter-spacing: 0.15px;
          animation: tkTickerScroll var(--tkSpeed, 22s) linear infinite;
        }

        .tkTickerCopy {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          flex: 0 0 auto;
        }

        @media (hover: hover) and (pointer: fine) {
          .tkTicker:hover .tkTickerRail { animation-play-state: paused; }
        }

        .tkGoldSweep {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 4;
        }

        .tkGoldSweep::before {
          content: "";
          position: absolute;
          inset: -10px;
          transform: translateX(-140%) skewX(-18deg);
          opacity: 0;
          background: linear-gradient(
            110deg,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0) 54%,
            rgba(215, 177, 74, 0.08) 56%,
            rgba(215, 177, 74, 0.35) 58%,
            rgba(255, 255, 255, 0.95) 60%,
            rgba(215, 177, 74, 0.45) 62%,
            rgba(215, 177, 74, 0.1) 65%,
            rgba(0, 0, 0, 0) 72%,
            rgba(0, 0, 0, 0) 100%
          );
          filter: blur(0.9px) saturate(1.35);
          animation: tkGoldSweepX 7.2s ease-in-out infinite;
        }

        .tkSash {
          position: absolute;
          top: 10px;
          right: -44px;
          transform: rotate(35deg);
          width: 160px;
          text-align: center;
          padding: 6px 0;
          font-weight: 1000;
          letter-spacing: 1px;
          font-size: 11px;
          text-transform: uppercase;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          z-index: 7;
          pointer-events: none;
        }

        .tkSashLive { background: rgba(255, 60, 60, 0.95); color: white; }
        .tkSashSoon { background: rgba(215, 177, 74, 0.92); color: rgba(10, 10, 10, 0.95); }

        .tkLive .tkLiveDotWrap { position: relative; width: 10px; height: 10px; display: inline-block; }
        .tkLive .tkLiveDot {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.45);
          animation: liveDotPulse 1.05s ease-in-out infinite;
        }
        .tkLive .tkLiveRing {
          position: absolute;
          inset: -7px;
          border-radius: 999px;
          border: 2px solid rgba(255, 255, 255, 0.65);
          opacity: 0;
          transform: scale(0.65);
          animation: liveRing 1.05s ease-out infinite;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.35));
        }
        .tkLive .tkLeftLabel { animation: tkLiveLabelStrobe 1.1s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .tkTickerRail { animation-duration: calc(var(--tkSpeed, 22s) * 1.35) !important; }
          .tkLiveDot, .tkLiveRing {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </a>
  );
}

function LegendDot({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        fontSize: 12,
        fontWeight: 950,
        opacity: active ? 0.95 : 0.45,
        cursor: "pointer",
        border: `1px solid ${THEME.border}`,
        background: active ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.12)",
        padding: "6px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
      title={active ? "Click to hide" : "Click to show"}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          boxShadow: active ? "0 0 12px rgba(0,0,0,0.35)" : "none",
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </button>
  );
}

function newsMetricBox(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 10,
    background: "rgba(255,255,255,0.03)",
    minWidth: 0,
  };
}

function newsMetricLabel(): React.CSSProperties {
  return {
    fontSize: 11,
    opacity: 0.7,
    fontWeight: 800,
    marginBottom: 4,
  };
}

function newsMetricValue(): React.CSSProperties {
  return {
    fontSize: 15,
    fontWeight: 950,
  };
}

function NewsRow({
  currency,
  event,
  time,
  impact,
  color,
  noBorder = false,
}: {
  currency: string;
  event: string;
  time: string;
  impact: "high" | "medium" | "low";
  color: "blue" | "gold" | "purple" | "red";
  noBorder?: boolean;
}) {
  const currencyColor =
    color === "blue"
      ? "rgba(90,180,255,0.95)"
      : color === "purple"
      ? "rgba(170,110,255,0.95)"
      : color === "red"
      ? "rgba(255,92,92,0.95)"
      : THEME.gold;

  const currencyBg =
    color === "blue"
      ? "rgba(90,180,255,0.14)"
      : color === "purple"
      ? "rgba(170,110,255,0.14)"
      : color === "red"
      ? "rgba(255,92,92,0.14)"
      : "rgba(215,177,74,0.14)";

  const impactColor =
    impact === "high"
      ? THEME.red
      : impact === "medium"
      ? THEME.gold
      : "rgba(255,255,255,0.55)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr auto auto",
        gap: 10,
        alignItems: "center",
        padding: "11px 12px",
        borderBottom: noBorder ? "none" : `1px solid rgba(255,255,255,0.06)`,
      }}
    >
      <div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 52,
            padding: "4px 8px",
            borderRadius: 999,
            background: currencyBg,
            border: `1px solid ${THEME.border}`,
            color: currencyColor,
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: 0.3,
          }}
        >
          {currency}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 850,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {event}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          opacity: 0.82,
          whiteSpace: "nowrap",
        }}
      >
        {time}
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 950,
          color: impactColor,
          letterSpacing: 0.3,
          whiteSpace: "nowrap",
        }}
      >
        {impact.toUpperCase()}
      </div>
    </div>
  );
}
