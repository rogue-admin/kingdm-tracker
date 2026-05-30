// src/app/api/economic-news/route.ts
import { NextResponse } from "next/server";

type RawEconomicEvent = {
  date?: string;
  time?: string;
  country?: string;
  currency?: string;
  event?: string;
  title?: string;
  impact?: string;
  actual?: string | number | null;
  previous?: string | number | null;
  forecast?: string | number | null;
  consensus?: string | number | null;
};

type NewsEvent = {
  id: string;
  currency: "USD" | "EUR" | "GBP" | "JPY";
  event: string;
  impact: "high" | "medium" | "low";
  dateTimeISO: string;
  timeLabel: string;
  actual: string;
  previous: string;
  forecast: string;
};

const IMPORTANT = new Set(["USD", "EUR", "GBP", "JPY"]);

function fmtVal(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function normalizeImpact(v: string | undefined): "high" | "medium" | "low" {
  const s = (v || "").toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("medium") || s.includes("med")) return "medium";
  return "low";
}

function currencyPriority(c: string) {
  if (c === "USD") return 0;
  if (c === "EUR") return 1;
  if (c === "GBP") return 2;
  if (c === "JPY") return 3;
  return 9;
}

function impactPriority(i: "high" | "medium" | "low") {
  if (i === "high") return 0;
  if (i === "medium") return 1;
  return 2;
}

function parseDateTime(dateStr?: string, timeStr?: string) {
  // FMP often returns date/time separately. We normalize into ET-local-ish ISO.
  // We keep it defensive because API payloads can vary.
  const rawDate = (dateStr || "").trim();
  const rawTime = (timeStr || "").trim();

  // Date-only fallback
  if (!rawDate) {
    const now = new Date();
    return {
      iso: now.toISOString(),
      timeLabel: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      ts: now.getTime(),
    };
  }

  // If date already includes time, let Date parse it.
  if (rawDate.includes("T") || rawDate.includes(":")) {
    const d = new Date(rawDate);
    return {
      iso: d.toISOString(),
      timeLabel: d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      ts: d.getTime(),
    };
  }

  // Build from separate date + time
  // Example date: 2026-03-06
  // Example time: 08:30
  const combined = rawTime ? `${rawDate}T${rawTime}:00` : `${rawDate}T00:00:00`;
  const d = new Date(combined);

  return {
    iso: d.toISOString(),
    timeLabel: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    ts: d.getTime(),
  };
}

export async function GET() {
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FMP_API_KEY in environment." },
      { status: 500 }
    );
  }

  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + 3);
  const to = toDate.toISOString().slice(0, 10);

  const url =
    `https://financialmodelingprep.com/stable/economic-calendar` +
    `?from=${from}&to=${to}&apikey=${apiKey}`;

  const res = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `FMP request failed with status ${res.status}` },
      { status: 502 }
    );
  }

  const raw = (await res.json()) as RawEconomicEvent[];

  const normalized: NewsEvent[] = (Array.isArray(raw) ? raw : [])
    .map((r, idx) => {
      const currency = String(r.currency || r.country || "").toUpperCase().trim();
      if (!IMPORTANT.has(currency)) return null;

      const event = String(r.event || r.title || "").trim();
      if (!event) return null;

      const impact = normalizeImpact(r.impact);
      const dt = parseDateTime(r.date, r.time);

      return {
        id: `${currency}-${event}-${dt.iso}-${idx}`,
        currency: currency as "USD" | "EUR" | "GBP" | "JPY",
        event,
        impact,
        dateTimeISO: dt.iso,
        timeLabel: dt.timeLabel,
        actual: fmtVal(r.actual),
        previous: fmtVal(r.previous),
        forecast: fmtVal(r.forecast ?? r.consensus),
      };
    })
    .filter((x): x is NewsEvent => Boolean(x))
    .filter((x) => new Date(x.dateTimeISO).getTime() >= now.getTime() - 60 * 60 * 1000)
    .sort((a, b) => {
      const impactCmp = impactPriority(a.impact) - impactPriority(b.impact);
      if (impactCmp !== 0) return impactCmp;

      const currencyCmp = currencyPriority(a.currency) - currencyPriority(b.currency);
      if (currencyCmp !== 0) return currencyCmp;

      return new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime();
    });

  const hero = normalized[0] ?? null;
  const upcoming = normalized.slice(1, 5);

  return NextResponse.json({
    hero,
    upcoming,
    fetchedAt: new Date().toISOString(),
  });
}