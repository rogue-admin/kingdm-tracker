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

  return total > 0
    ? `${((wins / total) * 100).toFixed(1)}%`
    : "0.0%";
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - difference);
  result.setHours(0, 0, 0, 0);

  return result;
}

function sundayOf(date: Date) {
  const result = mondayOf(date);

  result.setDate(result.getDate() + 6);
  result.setHours(0, 0, 0, 0);

  return result;
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dateRangeLabel(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth =
    sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", {
      month: "short",
    })} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (sameYear) {
    return `${shortDate(start)} – ${shortDate(
      end
    )}, ${end.getFullYear()}`;
  }

  return `${shortDate(start)}, ${start.getFullYear()} – ${shortDate(
    end
  )}, ${end.getFullYear()}`;
}

function sessionMeta(session: Session) {
  if (session === "tokyo") {
    return {
      label: "Tokyo",
      fullLabel: "🇯🇵 Tokyo",
      accent: "#ff5c5c",
    };
  }

  if (session === "london") {
    return {
      label: "London",
      fullLabel: "🇬🇧 London",
      accent: "#4ea3ff",
    };
  }

  return {
    label: "NYC",
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
    {
      w: 0,
      l: 0,
      be: 0,
    }
  );
}

function calcSessionStreak(
  rows: DailySessionRow[],
  session: Session
) {
  const filtered = rows
    .filter((row) => row.session === session)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;

  for (const row of filtered) {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);
    const breakevens = safeNum(row.breakevens);

    // Empty or unreported rows do not count and do not end a run.
    if (!hasReportedOutcome(wins, losses, breakevens)) {
      continue;
    }

    // Any loss ends the run.
    if (losses > 0) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? iso(new Date());

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const targetDate = new Date(`${date}T00:00:00`);
  const weekStartDate = mondayOf(targetDate);
  const weekEndDate = sundayOf(targetDate);

  const weekStart = iso(weekStartDate);
  const weekEnd = iso(weekEndDate);

  const streakStartDate = new Date(targetDate);
  streakStartDate.setDate(streakStartDate.getDate() - 120);

  const streakStart = iso(streakStartDate);

  const [
    weekSessionRes,
    weekOverallRes,
    streakSessionRes,
  ] = await Promise.all([
    supabase
      .from("v_public_daily_outcomes")
      .select("date,session,wins,losses,breakevens")
      .gte("date", weekStart)
      .lte("date", weekEnd),

    supabase
      .from("v_public_daily_overall")
      .select("date,wins,losses,breakevens")
      .gte("date", weekStart)
      .lte("date", weekEnd),

    supabase
      .from("v_public_daily_outcomes")
      .select("date,session,wins,losses,breakevens")
      .gte("date", streakStart)
      .lte("date", date),
  ]);

  if (weekSessionRes.error) {
    throw weekSessionRes.error;
  }

  if (weekOverallRes.error) {
    throw weekOverallRes.error;
  }

  if (streakSessionRes.error) {
    throw streakSessionRes.error;
  }

  const weekSessionRows =
    (weekSessionRes.data ?? []) as DailySessionRow[];

  const weekOverallRows =
    (weekOverallRes.data ?? []) as DailyOverallRow[];

  const streakSessionRows =
    (streakSessionRes.data ?? []) as DailySessionRow[];

  const bySession: Record<Session, SessionTotals> = {
    tokyo: {
      w: 0,
      l: 0,
      be: 0,
      reported: false,
    },
    london: {
      w: 0,
      l: 0,
      be: 0,
      reported: false,
    },
    nyc: {
      w: 0,
      l: 0,
      be: 0,
      reported: false,
    },
  };

  weekSessionRows.forEach((row) => {
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

  const weekly = sumOverallRows(weekOverallRows);
  const weeklyNet = weekly.w - weekly.l;

  const bestDay =
    weekOverallRows
      .map((row) => {
        const wins = safeNum(row.wins);
        const losses = safeNum(row.losses);
        const breakevens = safeNum(row.breakevens);

        return {
          date: row.date,
          wins,
          losses,
          breakevens,
          net: wins - losses,
          reported: hasReportedOutcome(
            wins,
            losses,
            breakevens
          ),
        };
      })
      .filter((row) => row.reported)
      .sort((a, b) => b.net - a.net)[0] ?? null;

  const sessionResults = (
    ["tokyo", "london", "nyc"] as Session[]
  ).map((session) => {
    const totals = bySession[session];

    return {
      session,
      ...totals,
      net: totals.w - totals.l,
    };
  });

  const bestSession =
    sessionResults
      .filter((result) => result.reported)
      .sort((a, b) => b.net - a.net)[0] ?? null;

  const sessionStreaks: Record<Session, number> = {
    tokyo: calcSessionStreak(
      streakSessionRows,
      "tokyo"
    ),
    london: calcSessionStreak(
      streakSessionRows,
      "london"
    ),
    nyc: calcSessionStreak(
      streakSessionRows,
      "nyc"
    ),
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
          padding: "34px 48px",
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
              style={{
                display: "flex",
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
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
                Weekly Recap
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              opacity: 0.76,
              paddingTop: 6,
            }}
          >
            {dateRangeLabel(
              weekStartDate,
              weekEndDate
            )}
          </div>
        </div>

        {/* Weekly total */}
        <div
          style={{
            marginTop: 20,
            borderRadius: 28,
            border:
              "2px solid rgba(215,177,74,0.45)",
            backgroundColor:
              "rgba(215,177,74,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "17px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
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
              TOTAL WEEK RESULT
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 5,
                fontSize: 78,
                fontWeight: 900,
                lineHeight: 1,
                color:
                  weeklyNet >= 0
                    ? "#55FF8A"
                    : "#ff5c5c",
              }}
            >
              {fmtNet(weeklyNet)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 28,
            }}
          >
            <MiniStat
              label="TP"
              value={weekly.w}
              color="#55FF8A"
            />

            <MiniStat
              label="SL"
              value={weekly.l}
              color="#ff5c5c"
            />

            <MiniStat
              label="BE"
              value={weekly.be}
              color="#D7B14A"
            />

            <MiniStat
              label="WR"
              value={winRate(weekly.w, weekly.l)}
              color="#D7B14A"
            />
          </div>
        </div>

        {/* Session cards */}
        <div
          style={{
            marginTop: 17,
            display: "flex",
            gap: 16,
          }}
        >
          {sessionResults.map((result) => {
            const meta = sessionMeta(result.session);

            return (
              <SessionCard
                key={result.session}
                title={meta.fullLabel}
                sessionColor={meta.accent}
                wins={result.w}
                losses={result.l}
                be={result.be}
                net={result.net}
                streak={
                  sessionStreaks[result.session]
                }
                isBest={
                  bestSession?.session ===
                  result.session
                }
              />
            );
          })}
        </div>

        {/* Best day */}
        <div
          style={{
            marginTop: 17,
            borderRadius: 18,
            border:
              "1px solid rgba(215,177,74,0.28)",
            backgroundColor:
              "rgba(215,177,74,0.06)",
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
            Best Day
          </div>

          {bestDay ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              <div
                style={{
                  display: "flex",
                }}
              >
                {new Date(
                  `${bestDay.date}T00:00:00`
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  opacity: 0.48,
                }}
              >
                •
              </div>

              <div
                style={{
                  display: "flex",
                  color:
                    bestDay.net >= 0
                      ? "#55FF8A"
                      : "#ff5c5c",
                }}
              >
                {fmtNet(bestDay.net)}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                fontSize: 22,
                opacity: 0.65,
              }}
            >
              No reported results
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
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

  const titleColor = isBest
    ? "#f0c75a"
    : sessionColor;

  const backgroundColor = isBest
    ? "linear-gradient(135deg, rgba(215,177,74,0.11), rgba(215,177,74,0.04))"
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
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px",
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
              border:
                "1px solid rgba(215,177,74,0.28)",
              backgroundColor:
                "rgba(215,177,74,0.08)",
              padding: "4px 8px",
              color: "#D7B14A",
              fontSize: 16,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            <div style={{ display: "flex" }}>
              🔥
            </div>

            <div style={{ display: "flex" }}>
              {streak}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 10,
          fontSize: 21,
          opacity: 0.86,
        }}
      >
        TP {wins} • SL {losses} • BE {be}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 10,
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1,
          color:
            net >= 0 ? "#55FF8A" : "#ff5c5c",
        }}
      >
        Net {fmtNet(net)}
      </div>
    </div>
  );
}