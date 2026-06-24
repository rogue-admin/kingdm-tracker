import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const BASE_URL = "https://kingdm-tracker.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Session = "tokyo" | "london" | "nyc";

type DailyOutcomeRow = {
  date: string;
  session: Session;
  wins: number | null;
  losses: number | null;
  breakevens: number | null;
};

type DailyOverallRow = {
  wins: number | null;
  losses: number | null;
  breakevens: number | null;
};

function safeNum(v: unknown) {
  return Number(v ?? 0);
}

function fmtNet(n: number) {
  return n >= 0 ? `+${n}` : String(n);
}

function winRate(w: number, l: number) {
  const denom = w + l;
  return denom > 0 ? `${((w / denom) * 100).toFixed(1)}%` : "0.0%";
}

function mondayOf(d: Date) {
  const dow = d.getDay();
  const diff = dow === 0 ? 6 : dow - 1;
  const x = new Date(d);
  x.setDate(x.getDate() - diff);
  return x;
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function sessionName(session: Session) {
  if (session === "tokyo") return "Tokyo";
  if (session === "london") return "London";
  return "NYC";
}

function sessionFlag(session: Session) {
  if (session === "tokyo") return "🇯🇵";
  if (session === "london") return "🇬🇧";
  return "🇺🇸";
}

function sessionAccent(session: Session) {
  if (session === "tokyo") return "#ff5c5c";
  if (session === "london") return "#4ea3ff";
  return "#a855f7";
}

function sumRows(rows: DailyOverallRow[] | null | undefined) {
  return (rows ?? []).reduce(
    (acc, r) => {
      acc.w += safeNum(r.wins);
      acc.l += safeNum(r.losses);
      acc.be += safeNum(r.breakevens);
      return acc;
    },
    { w: 0, l: 0, be: 0 }
  );
}

async function getSessionStreak(
  supabase: any,
  session: Session,
  date: string
) {
  const { data } = await supabase
    .from("v_public_daily_outcomes")
    .select("date,session,wins,losses,breakevens")
    .eq("session", session)
    .lte("date", date)
    .order("date", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as DailyOutcomeRow[];

  let streak = 0;

  for (const row of rows) {
    const wins = safeNum(row.wins);
    const losses = safeNum(row.losses);

    if (wins > losses) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? iso(new Date());

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const targetDate = new Date(`${date}T00:00:00`);
  const weekStart = iso(mondayOf(targetDate));
  const monthStart = `${date.slice(0, 7)}-01`;

  const [
    dailyRes,
    weekRes,
    monthRes,
    tokyoStreak,
    londonStreak,
    nycStreak,
  ] = await Promise.all([
    supabase
      .from("v_public_daily_outcomes")
      .select("date,session,wins,losses,breakevens")
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

    getSessionStreak(supabase, "tokyo", date),
    getSessionStreak(supabase, "london", date),
    getSessionStreak(supabase, "nyc", date),
  ]);

  const streaks: Record<Session, number> = {
    tokyo: tokyoStreak,
    london: londonStreak,
    nyc: nycStreak,
  };

  const bySession: Record<Session, { w: number; l: number; be: number }> = {
    tokyo: { w: 0, l: 0, be: 0 },
    london: { w: 0, l: 0, be: 0 },
    nyc: { w: 0, l: 0, be: 0 },
  };

  ((dailyRes.data ?? []) as DailyOutcomeRow[]).forEach((r) => {
    bySession[r.session] = {
      w: safeNum(r.wins),
      l: safeNum(r.losses),
      be: safeNum(r.breakevens),
    };
  });

  const daily = {
    w: bySession.tokyo.w + bySession.london.w + bySession.nyc.w,
    l: bySession.tokyo.l + bySession.london.l + bySession.nyc.l,
    be: bySession.tokyo.be + bySession.london.be + bySession.nyc.be,
  };

  const week = sumRows((weekRes.data ?? []) as DailyOverallRow[]);
  const month = sumRows((monthRes.data ?? []) as DailyOverallRow[]);

  const dailyNet = daily.w - daily.l;
  const weekNet = week.w - week.l;
  const monthNet = month.w - month.l;

  const sessionCards = (["tokyo", "london", "nyc"] as Session[]).map(
    (session) => {
      const row = bySession[session];
      const net = row.w - row.l;

      return {
        session,
        label: sessionName(session),
        flag: sessionFlag(session),
        accent: sessionAccent(session),
        w: row.w,
        l: row.l,
        be: row.be,
        net,
        streak: streaks[session] ?? 0,
      };
    }
  );

  const bestNet = Math.max(...sessionCards.map((s) => s.net));
  const winners =
    bestNet > 0
      ? sessionCards.filter((s) => s.net === bestNet).map((s) => s.session)
      : [];

  const winnerSet = new Set<Session>(winners);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "680px",
          backgroundColor: "rgb(9,9,11)",
          backgroundImage:
            "radial-gradient(circle at 18% 16%, rgba(140,95,255,0.32), rgba(0,0,0,0) 34%), radial-gradient(circle at 86% 10%, rgba(215,177,74,0.28), rgba(0,0,0,0) 36%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          padding: "44px 54px",
          fontFamily: "Arial",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <img
              src={`${BASE_URL}/Kingdm-logo.png`}
              width="96"
              height="96"
              style={{ display: "flex" }}
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
                Daily Recap
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 18,
                  color: "rgba(255,255,255,0.72)",
                  lineHeight: 1,
                }}
              >
                Official Session Results
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              opacity: 0.78,
              paddingTop: 8,
            }}
          >
            {date}
          </div>
        </div>

        {/* Total Day Result */}
        <div
          style={{
            marginTop: 18,
            borderRadius: 28,
            border: "2px solid rgba(215,177,74,0.42)",
            background:
              "linear-gradient(135deg, rgba(140,95,255,0.10), rgba(215,177,74,0.10))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 30px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "55%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#D7B14A",
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: 0.6,
                }}
              >
                TOTAL DAY RESULT
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 84,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: dailyNet >= 0 ? "#55FF8A" : "#ff5c5c",
                }}
              >
                {fmtNet(dailyNet)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                width: 1,
                height: 70,
                backgroundColor: "rgba(255,255,255,0.16)",
                marginRight: 8,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 34,
              alignItems: "center",
            }}
          >
            <MiniStat label="TP" value={daily.w} color="#55FF8A" />
            <MiniStat label="SL" value={daily.l} color="#ff5c5c" />
            <MiniStat label="BE" value={daily.be} color="#D7B14A" />
            <MiniStat label="WR" value={winRate(daily.w, daily.l)} color="#D7B14A" />
          </div>
        </div>

        {/* Session Cards */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 22,
          }}
        >
          {sessionCards.map((s) => {
            const isWinner = winnerSet.has(s.session);
            const headerColor = isWinner ? "#D7B14A" : s.accent;
            const lineColor = isWinner
              ? "rgba(215,177,74,0.72)"
              : `${s.accent}99`;

            return (
              <div
                key={s.session}
                style={{
                  flex: 1,
                  borderRadius: 22,
                  border: isWinner
                    ? "2px solid rgba(215,177,74,0.72)"
                    : `2px solid ${s.accent}cc`,
                  background: isWinner
                    ? "linear-gradient(135deg, rgba(215,177,74,0.16), rgba(255,255,255,0.04))"
                    : "rgba(255,255,255,0.03)",
                  boxShadow: isWinner
                    ? "0 0 24px rgba(215,177,74,0.16)"
                    : "none",
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 20px 16px",
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
                      color: headerColor,
                      fontSize: 24,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {s.flag} {s.label}
                  </div>

                  {s.streak >= 2 ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(215,177,74,0.35)",
                        backgroundColor: "rgba(215,177,74,0.10)",
                        color: "#D7B14A",
                        fontSize: 14,
                        fontWeight: 800,
                        lineHeight: 1,
                      }}
                    >
                      🔥 {s.streak}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    fontSize: 20,
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  TP {s.w} • SL {s.l} • BE {s.be}
                </div>

                <div
                  style={{
                    display: "flex",
                    marginTop: 12,
                    height: 1,
                    width: "100%",
                    backgroundColor: lineColor,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    marginTop: 16,
                    fontSize: 34,
                    fontWeight: 900,
                    lineHeight: 1,
                    color: s.net >= 0 ? "#55FF8A" : "#ff5c5c",
                  }}
                >
                  Net {fmtNet(s.net)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom row */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 22,
          }}
        >
          <TrendBox title="Week to Date" net={weekNet} w={week.w} l={week.l} />
          <TrendBox title="Month to Date" net={monthNet} w={month.w} l={month.l} />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 680,
      headers: {
        "Cache-Control": "no-store, max-age=0",
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
        minWidth: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          color,
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 10,
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1,
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
        borderRadius: 20,
        border: "1px solid rgba(215,177,74,0.32)",
        backgroundColor: "rgba(215,177,74,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "62%",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#D7B14A",
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 18,
            color: "rgba(255,255,255,0.70)",
          }}
        >
          TP {w} • SL {l} • WR {winRate(w, l)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: 1,
          height: 50,
          backgroundColor: "rgba(255,255,255,0.14)",
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: 38,
          fontWeight: 900,
          lineHeight: 1,
          color: net >= 0 ? "#55FF8A" : "#ff5c5c",
        }}
      >
        {fmtNet(net)}
      </div>
    </div>
  );
}