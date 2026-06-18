import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const BASE_URL = "https://kingdm-tracker.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Session = "tokyo" | "london" | "nyc";

type SessionTotals = {
  w: number;
  l: number;
  be: number;
  reported: boolean;
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
  const denominator = wins + losses;

  return denominator > 0
    ? `${((wins / denominator) * 100).toFixed(1)}%`
    : "0.0%";
}

function mondayOf(date: Date) {
  const day = date.getDay();
  const difference = day === 0 ? 6 : day - 1;
  const result = new Date(date);

  result.setDate(result.getDate() - difference);

  return result;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sessionName(session: Session) {
  if (session === "tokyo") return "🇯🇵 Tokyo";
  if (session === "london") return "🇬🇧 London";

  return "🇺🇸 NYC";
}

function sessionColor(session: Session) {
  if (session === "tokyo") {
    return {
      border: "rgba(255,77,77,0.58)",
      accent: "#ff4d4d",
      background: "rgba(255,77,77,0.035)",
    };
  }

  if (session === "london") {
    return {
      border: "rgba(59,130,246,0.62)",
      accent: "#3b82f6",
      background: "rgba(59,130,246,0.035)",
    };
  }

  return {
    border: "rgba(168,85,247,0.62)",
    accent: "#a855f7",
    background: "rgba(168,85,247,0.035)",
  };
}

function hasReportedOutcome(
  wins: number,
  losses: number,
  breakevens: number
) {
  return wins + losses + breakevens > 0;
}

function calculateSessionStreak(
  rows: DailySessionRow[],
  session: Session
) {
  const sessionRows = rows
    .filter((row) => row.session === session)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;

  for (const row of sessionRows) {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);
    const breakevens = safeNum(row.breakevens);

    // Ignore dates where this session was not reported.
    if (!hasReportedOutcome(wins, losses, breakevens)) {
      continue;
    }

    // Any loss immediately ends the no-loss run.
    if (losses > 0) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const date =
    url.searchParams.get("date") ?? iso(new Date());

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const targetDate = new Date(`${date}T00:00:00`);
  const weekStart = iso(mondayOf(targetDate));
  const monthStart = `${date.slice(0, 7)}-01`;

  const streakStartDate = new Date(targetDate);
  streakStartDate.setDate(
    streakStartDate.getDate() - 365
  );

  const streakStart = iso(streakStartDate);

  const [
    dailyRes,
    weekRes,
    monthRes,
    streakRes,
  ] = await Promise.all([
    supabase
      .from("v_public_daily_outcomes")
      .select(
        "date,session,wins,losses,breakevens"
      )
      .eq("date", date),

    supabase
      .from("v_public_daily_overall")
      .select("wins,losses,breakevens")
      .gte("date", weekStart)
      .lte("date", date),

    supabase
      .from("v_public_daily_overall")
      .select("wins,losses,breakevens")
      .gte("date", monthStart)
      .lte("date", date),

    supabase
      .from("v_public_daily_outcomes")
      .select(
        "date,session,wins,losses,breakevens"
      )
      .gte("date", streakStart)
      .lte("date", date),
  ]);

  if (dailyRes.error) {
    throw dailyRes.error;
  }

  if (weekRes.error) {
    throw weekRes.error;
  }

  if (monthRes.error) {
    throw monthRes.error;
  }

  if (streakRes.error) {
    throw streakRes.error;
  }

  const dailyRows =
    (dailyRes.data ?? []) as DailySessionRow[];

  const streakRows =
    (streakRes.data ?? []) as DailySessionRow[];

  const bySession: Record<
    Session,
    SessionTotals
  > = {
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

  dailyRows.forEach((row) => {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);
    const breakevens = safeNum(
      row.breakevens
    );

    bySession[row.session] = {
      w: wins,
      l: losses,
      be: breakevens,
      reported: hasReportedOutcome(
        wins,
        losses,
        breakevens
      ),
    };
  });

  const daily = {
    w:
      bySession.tokyo.w +
      bySession.london.w +
      bySession.nyc.w,

    l:
      bySession.tokyo.l +
      bySession.london.l +
      bySession.nyc.l,

    be:
      bySession.tokyo.be +
      bySession.london.be +
      bySession.nyc.be,
  };

  function sumRows(rows: unknown) {
    return (
      (rows ?? []) as Array<{
        wins: number | null;
        losses: number | null;
        breakevens: number | null;
      }>
    ).reduce(
      (total, row) => {
        total.w += safeNum(row.wins);
        total.l += safeNum(row.losses);
        total.be += safeNum(
          row.breakevens
        );

        return total;
      },
      {
        w: 0,
        l: 0,
        be: 0,
      }
    );
  }

  const week = sumRows(weekRes.data);
  const month = sumRows(monthRes.data);

  const dailyNet = daily.w - daily.l;
  const weekNet = week.w - week.l;
  const monthNet = month.w - month.l;

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
      .sort(
        (a, b) =>
          b.net - a.net || b.w - a.w
      )[0] ?? null;

  const sessionStreaks: Record<
    Session,
    number
  > = {
    tokyo: calculateSessionStreak(
      streakRows,
      "tokyo"
    ),

    london: calculateSessionStreak(
      streakRows,
      "london"
    ),

    nyc: calculateSessionStreak(
      streakRows,
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
          padding: "18px 58px 26px 58px",
          fontFamily: "Arial",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <img
              src={`${BASE_URL}/Kingdm-logo.png`}
              width="112"
              height="112"
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
                }}
              >
                The Kingdm
              </div>

              <div
                style={{
                  display: "flex",
                  fontSize: 42,
                  fontWeight: 900,
                }}
              >
                Daily Recap
              </div>

              <div
                style={{
                  marginTop: 0,
                  display: "flex",
                  fontSize: 17,
                  color:
                    "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                }}
              >
                Official Session Results
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 29,
              opacity: 0.72,
            }}
          >
            {date}
          </div>
        </div>

        {/* Daily total */}
        <div
          style={{
            marginTop: 8,
            borderRadius: "28px",
            border:
              "2px solid rgba(215,177,74,0.55)",
            backgroundColor:
              "rgba(215,177,74,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            padding: "16px 44px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 94,
              fontWeight: 900,
              lineHeight: 1,
              color:
                dailyNet >= 0
                  ? "#55FF8A"
                  : "#ff5c5c",
            }}
          >
            {fmtNet(dailyNet)}
          </div>

          <div
            style={{
              display: "flex",
              width: "1px",
              height: "68px",
              backgroundColor:
                "rgba(255,255,255,0.18)",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 38,
            }}
          >
            <MiniStat
              label="TP"
              value={daily.w}
              color="#55FF8A"
            />

            <MiniStat
              label="SL"
              value={daily.l}
              color="#ff5c5c"
            />

            <MiniStat
              label="BE"
              value={daily.be}
              color="#D7B14A"
            />

            <MiniStat
              label="WR"
              value={winRate(
                daily.w,
                daily.l
              )}
              color="#D7B14A"
            />
          </div>
        </div>

        {/* Session cards */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 28,
          }}
        >
          {sessionResults.map((result) => {
            const colors = sessionColor(
              result.session
            );

            const isBest =
              bestSession?.session ===
              result.session;

            const borderColor = isBest
              ? "rgba(215,177,74,0.95)"
              : colors.border;

            const titleColor = isBest
              ? "#f0c75a"
              : colors.accent;

            const backgroundColor = isBest
              ? "rgba(215,177,74,0.10)"
              : colors.background;

            const cardShadow = isBest
              ? "0 0 22px rgba(215,177,74,0.18), 0 0 40px rgba(215,177,74,0.08), inset 0 0 18px rgba(215,177,74,0.05)"
              : "none";

            const streak =
              sessionStreaks[
                result.session
              ];

            return (
              <div
                key={result.session}
                style={{
                  flex: 1,
                  borderRadius: "20px",
                  border: `2px solid ${borderColor}`,
                  backgroundColor,
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 18px",
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
                      fontSize: 26,
                      fontWeight: 900,
                      textShadow: isBest
                        ? "0 0 10px rgba(215,177,74,0.22)"
                        : "none",
                    }}
                  >
                    {sessionName(
                      result.session
                    )}
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
                      <div
                        style={{
                          display: "flex",
                        }}
                      >
                        🔥
                      </div>

                      <div
                        style={{
                          display: "flex",
                        }}
                      >
                        {streak}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    fontSize: 22,
                  }}
                >
                  TP {result.w} • SL{" "}
                  {result.l} • BE{" "}
                  {result.be}
                </div>

                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundColor:
                      borderColor,
                  }}
                />

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    fontSize: 30,
                    fontWeight: 900,
                    color:
                      result.net >= 0
                        ? "#55FF8A"
                        : "#ff5c5c",
                  }}
                >
                  Net {fmtNet(result.net)}
                </div>
              </div>
            );
          })}
        </div>

        {/* WTD and MTD */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 28,
          }}
        >
          <TrendBox
            title="Week to Date"
            net={weekNet}
            w={week.w}
            l={week.l}
          />

          <TrendBox
            title="Month to Date"
            net={monthNet}
            w={month.w}
            l={month.l}
          />
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
      }}
    >
      <div
        style={{
          display: "flex",
          color,
          fontSize: 26,
          fontWeight: 900,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          display: "flex",
          fontSize: 40,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TrendBox({
  title,
  net,
  w,
  l,
}: {
  title: string;
  net: number;
  w: number;
  l: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: "20px",
        border:
          "1px solid rgba(215,177,74,0.55)",
        backgroundColor:
          "rgba(215,177,74,0.055)",
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        padding: "12px 22px",
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
            fontSize: 25,
            fontWeight: 900,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 5,
            display: "flex",
            fontSize: 20,
            opacity: 0.72,
          }}
        >
          TP {w} • SL {l} • WR{" "}
          {winRate(w, l)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: "1px",
          height: "48px",
          backgroundColor:
            "rgba(255,255,255,0.18)",
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: 40,
          fontWeight: 900,
          color:
            net >= 0
              ? "#55FF8A"
              : "#ff5c5c",
        }}
      >
        {fmtNet(net)}
      </div>
    </div>
  );
}