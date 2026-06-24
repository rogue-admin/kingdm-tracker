import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const BASE_URL = "https://kingdm-tracker.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Session = "tokyo" | "london" | "nyc";

type SessionTotals = {
  w: number;
  l: number;
  be: number;
  reported: boolean;
};

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

function safeNum(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtNet(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function winRate(wins: number, losses: number) {
  const total = wins + losses;
  return total > 0 ? `${((wins / total) * 100).toFixed(1)}%` : "0.0%";
}

function parseISODate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function yearStartOf(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function monthStartOf(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthEndOf(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sessionMeta(session: Session) {
  if (session === "tokyo") {
    return {
      fullLabel: "🇯🇵 Tokyo",
      accent: "#ff5c5c",
    };
  }

  if (session === "london") {
    return {
      fullLabel: "🇬🇧 London",
      accent: "#4ea3ff",
    };
  }

  return {
    fullLabel: "🇺🇸 NYC",
    accent: "#a855f7",
  };
}

function hasReportedOutcome(
  wins: number,
  losses: number,
  breakevens: number
) {
  return wins + losses + breakevens > 0;
}

function sumOverallRows(rows: DailyOverallRow[]) {
  return rows.reduce(
    (total, row) => {
      total.w += safeNum(row.wins);
      total.l += safeNum(row.losses);
      total.be += safeNum(row.breakevens);
      return total;
    },
    { w: 0, l: 0, be: 0 }
  );
}

function calcSessionStreak(rows: DailySessionRow[], session: Session) {
  const filtered = rows
    .filter((row) => row.session === session)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;

  for (const row of filtered) {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);
    const breakevens = safeNum(row.breakevens);

    // Empty days do not count and do not break the no-loss run.
    if (!hasReportedOutcome(wins, losses, breakevens)) continue;

    // Any reported loss ends the run.
    if (losses > 0) break;

    streak += 1;
  }

  return streak;
}

function getBestMonth(rows: DailyOverallRow[]) {
  const months = new Map<
    string,
    {
      start: Date;
      end: Date;
      wins: number;
      losses: number;
      breakevens: number;
      net: number;
    }
  >();

  for (const row of rows) {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);
    const breakevens = safeNum(row.breakevens);

    if (!hasReportedOutcome(wins, losses, breakevens)) continue;

    const rowDate = parseISODate(row.date);
    const start = monthStartOf(rowDate);
    const end = monthEndOf(rowDate);
    const key = iso(start);

    const existing = months.get(key) ?? {
      start,
      end,
      wins: 0,
      losses: 0,
      breakevens: 0,
      net: 0,
    };

    existing.wins += wins;
    existing.losses += losses;
    existing.breakevens += breakevens;
    existing.net = existing.wins - existing.losses;

    months.set(key, existing);
  }

  return (
    Array.from(months.values()).sort(
      (a, b) => b.net - a.net || b.wins - a.wins
    )[0] ?? null
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? iso(new Date());

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const targetDate = parseISODate(date);
  const yearStartDate = yearStartOf(targetDate);
  const yearStart = iso(yearStartDate);
  const yearEnd = date;

  // Look back far enough for streaks that began in the previous year.
  const streakStartDate = new Date(targetDate);
  streakStartDate.setUTCDate(streakStartDate.getUTCDate() - 400);
  const streakStart = iso(streakStartDate);

  const [yearSessionRes, yearOverallRes, streakSessionRes] =
    await Promise.all([
      supabase
        .from("v_public_daily_outcomes")
        .select("date,session,wins,losses,breakevens")
        .gte("date", yearStart)
        .lte("date", yearEnd),

      supabase
        .from("v_public_daily_overall")
        .select("date,wins,losses,breakevens")
        .gte("date", yearStart)
        .lte("date", yearEnd),

      supabase
        .from("v_public_daily_outcomes")
        .select("date,session,wins,losses,breakevens")
        .gte("date", streakStart)
        .lte("date", yearEnd),
    ]);

  if (yearSessionRes.error) throw yearSessionRes.error;
  if (yearOverallRes.error) throw yearOverallRes.error;
  if (streakSessionRes.error) throw streakSessionRes.error;

  const yearSessionRows =
    (yearSessionRes.data ?? []) as DailySessionRow[];
  const yearOverallRows =
    (yearOverallRes.data ?? []) as DailyOverallRow[];
  const streakSessionRows =
    (streakSessionRes.data ?? []) as DailySessionRow[];

  const bySession: Record<Session, SessionTotals> = {
    tokyo: { w: 0, l: 0, be: 0, reported: false },
    london: { w: 0, l: 0, be: 0, reported: false },
    nyc: { w: 0, l: 0, be: 0, reported: false },
  };

  yearSessionRows.forEach((row) => {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);
    const breakevens = safeNum(row.breakevens);

    bySession[row.session].w += wins;
    bySession[row.session].l += losses;
    bySession[row.session].be += breakevens;

    if (hasReportedOutcome(wins, losses, breakevens)) {
      bySession[row.session].reported = true;
    }
  });

  const yearly = sumOverallRows(yearOverallRows);
  const yearlyNet = yearly.w - yearly.l;

  const bestDay =
    yearOverallRows
      .map((row) => {
        const wins = safeNum(row.wins);
        const losses = safeNum(row.losses);
        const breakevens = safeNum(row.breakevens);

        return {
          date: row.date,
          net: wins - losses,
          wins,
          reported: hasReportedOutcome(wins, losses, breakevens),
        };
      })
      .filter((row) => row.reported)
      .sort((a, b) => b.net - a.net || b.wins - a.wins)[0] ?? null;

  const bestMonth = getBestMonth(yearOverallRows);

  const sessionResults = (['tokyo', 'london', 'nyc'] as Session[]).map(
    (session) => {
      const totals = bySession[session];

      return {
        session,
        ...totals,
        net: totals.w - totals.l,
      };
    }
  );

  const reportedSessionResults = sessionResults.filter(
    (result) => result.reported
  );

  const bestSessionNet =
    reportedSessionResults.length > 0
      ? Math.max(...reportedSessionResults.map((result) => result.net))
      : null;

  const sessionStreaks: Record<Session, number> = {
    tokyo: calcSessionStreak(streakSessionRows, "tokyo"),
    london: calcSessionStreak(streakSessionRows, "london"),
    nyc: calcSessionStreak(streakSessionRows, "nyc"),
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "rgb(9,9,11)",
          backgroundImage:
            "radial-gradient(circle at 18% 16%, rgba(140,95,255,0.32), rgba(0,0,0,0) 34%), radial-gradient(circle at 86% 10%, rgba(215,177,74,0.28), rgba(0,0,0,0) 36%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          padding: "32px 48px",
          fontFamily: "Arial",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <img
              src={`${BASE_URL}/Kingdm-logo.png`}
              width="96"
              height="96"
              style={{ display: "flex" }}
            />

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  color: "#D7B14A",
                  fontSize: 34,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                The Kingdm
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 54,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                Yearly Recap
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              opacity: 0.76,
              paddingTop: 6,
            }}
          >
            {targetDate.getUTCFullYear()} YTD
          </div>
        </div>

        {/* Total year result */}
        <div
          style={{
            marginTop: 18,
            borderRadius: 28,
            border: "2px solid rgba(215,177,74,0.45)",
            backgroundColor: "rgba(215,177,74,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "#D7B14A",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              TOTAL YEAR RESULT
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 5,
                fontSize: 76,
                fontWeight: 900,
                lineHeight: 1,
                color: yearlyNet >= 0 ? "#55FF8A" : "#ff5c5c",
              }}
            >
              {fmtNet(yearlyNet)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 28 }}>
            <MiniStat label="TP" value={yearly.w} color="#55FF8A" />
            <MiniStat label="SL" value={yearly.l} color="#ff5c5c" />
            <MiniStat label="BE" value={yearly.be} color="#D7B14A" />
            <MiniStat
              label="WR"
              value={winRate(yearly.w, yearly.l)}
              color="#D7B14A"
            />
          </div>
        </div>

        {/* Session cards */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 16,
          }}
        >
          {sessionResults.map((result) => {
            const meta = sessionMeta(result.session);
            const isBest =
              bestSessionNet !== null &&
              result.reported &&
              result.net === bestSessionNet;

            return (
              <SessionCard
                key={result.session}
                title={meta.fullLabel}
                sessionColor={meta.accent}
                wins={result.w}
                losses={result.l}
                be={result.be}
                net={result.net}
                streak={sessionStreaks[result.session]}
                isBest={isBest}
              />
            );
          })}
        </div>

        {/* Highlights */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 16,
          }}
        >
          <HighlightBox
            label="Best Day"
            value={
              bestDay
                ? `${new Date(`${bestDay.date}T00:00:00Z`).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }
                  )} • ${fmtNet(bestDay.net)}`
                : "No reported results"
            }
            positive={bestDay ? bestDay.net >= 0 : true}
          />

          <HighlightBox
            label="Best Month"
            value={
              bestMonth
                ? `${monthLabel(bestMonth.start)} • ${fmtNet(bestMonth.net)}`
                : "No reported results"
            }
            positive={bestMonth ? bestMonth.net >= 0 : true}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 74,
      }}
    >
      <div
        style={{
          display: "flex",
          color,
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 4,
          fontSize: 36,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SessionCard({
  title,
  sessionColor,
  wins,
  losses,
  be,
  net,
  streak,
  isBest,
}: {
  title: string;
  sessionColor: string;
  wins: number;
  losses: number;
  be: number;
  net: number;
  streak: number;
  isBest: boolean;
}) {
  const borderColor = isBest
    ? "rgba(215,177,74,0.95)"
    : `${sessionColor}66`;

  const titleColor = isBest ? "#f0c75a" : sessionColor;

  const cardBackground = isBest
    ? "linear-gradient(135deg, rgba(215,177,74,0.16), rgba(255,255,255,0.04))"
    : "rgba(255,255,255,0.04)";

  const cardShadow = isBest
    ? "0 0 22px rgba(215,177,74,0.18), 0 0 40px rgba(215,177,74,0.08), inset 0 0 18px rgba(215,177,74,0.05)"
    : "none";

  return (
    <div
      style={{
        flex: 1,
        borderRadius: 20,
        border: `2px solid ${borderColor}`,
        background: cardBackground,
        display: "flex",
        flexDirection: "column",
        padding: "15px 18px",
        boxShadow: cardShadow,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            color: titleColor,
            fontSize: 24,
            fontWeight: 900,
            textShadow: isBest
              ? "0 0 10px rgba(215,177,74,0.22)"
              : "none",
          }}
        >
          {title}
        </div>

        {streak >= 2 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              borderRadius: 999,
              border: "1px solid rgba(215,177,74,0.28)",
              backgroundColor: "rgba(215,177,74,0.08)",
              padding: "4px 8px",
              color: "#D7B14A",
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            <div style={{ display: "flex" }}>🔥</div>
            <div style={{ display: "flex" }}>{streak}</div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 9,
          fontSize: 21,
          opacity: 0.86,
        }}
      >
        TP {wins} • SL {losses} • BE {be}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 14,
          marginTop: 9,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 900,
            lineHeight: 1,
            color: net >= 0 ? "#55FF8A" : "#ff5c5c",
          }}
        >
          Net {fmtNet(net)}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#D7B14A",
              fontSize: 14,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            WR
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 5,
              color: "rgba(255,255,255,0.92)",
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {winRate(wins, losses)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightBox({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 18,
        border: "1px solid rgba(215,177,74,0.28)",
        backgroundColor: "rgba(215,177,74,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#D7B14A",
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 23,
          fontWeight: 900,
          color: positive ? "white" : "#ff5c5c",
        }}
      >
        {value}
      </div>
    </div>
  );
}
