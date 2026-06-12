import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const BASE_URL = "https://kingdm-tracker.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Session = "tokyo" | "london" | "nyc";

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

function sessionName(s: Session) {
  if (s === "tokyo") return "🇯🇵 Tokyo";
  if (s === "london") return "🇬🇧 London";
  return "🇺🇸 NYC";
}

function sessionColor(s: Session) {
  if (s === "tokyo") {
    return {
      border: "rgba(255,77,77,0.58)",
      accent: "#ff4d4d",
      bg: "rgba(255,77,77,0.035)",
    };
  }

  if (s === "london") {
    return {
      border: "rgba(59,130,246,0.62)",
      accent: "#3b82f6",
      bg: "rgba(59,130,246,0.035)",
    };
  }

  return {
    border: "rgba(168,85,247,0.62)",
    accent: "#a855f7",
    bg: "rgba(168,85,247,0.035)",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? iso(new Date());

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const targetDate = new Date(date + "T00:00:00");
  const weekStart = iso(mondayOf(targetDate));
  const monthStart = `${date.slice(0, 7)}-01`;

  const [dailyRes, weekRes, monthRes] = await Promise.all([
    supabase
      .from("v_public_daily_outcomes")
      .select("session,wins,losses,breakevens")
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
  ]);

  const bySession: Record<Session, { w: number; l: number; be: number }> = {
    tokyo: { w: 0, l: 0, be: 0 },
    london: { w: 0, l: 0, be: 0 },
    nyc: { w: 0, l: 0, be: 0 },
  };

  ((dailyRes.data ?? []) as Array<{
    session: Session;
    wins: number | null;
    losses: number | null;
    breakevens: number | null;
  }>).forEach((r) => {
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

  function sumRows(rows: unknown) {
    return ((rows ?? []) as Array<{
      wins: number | null;
      losses: number | null;
      breakevens: number | null;
    }>).reduce(
      (acc, r) => {
        acc.w += safeNum(r.wins);
        acc.l += safeNum(r.losses);
        acc.be += safeNum(r.breakevens);
        return acc;
      },
      { w: 0, l: 0, be: 0 }
    );
  }

  const week = sumRows(weekRes.data);
  const month = sumRows(monthRes.data);

  const dailyNet = daily.w - daily.l;
  const weekNet = week.w - week.l;
  const monthNet = month.w - month.l;

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={`${BASE_URL}/Kingdm-logo.png`} width="100" height="100" />

            <div style={{ display: "flex", flexDirection: "column" }}>
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
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                }}
              >
                Official Session Results
              </div>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 29, opacity: 0.72 }}>
            {date}
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            borderRadius: "28px",
            border: "2px solid rgba(215,177,74,0.55)",
            backgroundColor: "rgba(215,177,74,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 44px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 94,
              fontWeight: 900,
              lineHeight: 1,
              color: dailyNet >= 0 ? "#55FF8A" : "#ff5c5c",
            }}
          >
            {fmtNet(dailyNet)}
          </div>

          <div
            style={{
              display: "flex",
              width: "1px",
              height: "68px",
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          />

          <div style={{ display: "flex", gap: 38 }}>
            <MiniStat label="TP" value={daily.w} color="#55FF8A" />
            <MiniStat label="SL" value={daily.l} color="#ff5c5c" />
            <MiniStat label="BE" value={daily.be} color="#D7B14A" />
            <MiniStat
              label="WR"
              value={winRate(daily.w, daily.l)}
              color="#D7B14A"
            />
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 28 }}>
          {(["tokyo", "london", "nyc"] as Session[]).map((s) => {
            const r = bySession[s];
            const n = r.w - r.l;
            const c = sessionColor(s);

            return (
              <div
                key={s}
                style={{
                  flex: 1,
                  borderRadius: "20px",
                  border: `2px solid ${c.border}`,
                  backgroundColor: c.bg,
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: c.accent,
                    fontSize: 26,
                    fontWeight: 900,
                  }}
                >
                  {sessionName(s)}
                </div>

                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    fontSize: 22,
                  }}
                >
                  TP {r.w} • SL {r.l} • BE {r.be}
                </div>

                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    backgroundColor: c.border,
                  }}
                />

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    fontSize: 30,
                    fontWeight: 900,
                    color: n >= 0 ? "#55FF8A" : "#ff5c5c",
                  }}
                >
                  Net {fmtNet(n)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 28 }}>
          <TrendBox title="Week to Date" net={weekNet} w={week.w} l={week.l} />
          <TrendBox
            title="Month to Date"
            net={monthNet}
            w={month.w}
            l={month.l}
          />
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
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
      <div style={{ display: "flex", color, fontSize: 26, fontWeight: 900 }}>
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
        border: "1px solid rgba(215,177,74,0.55)",
        backgroundColor: "rgba(215,177,74,0.055)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 22px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
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
          TP {w} • SL {l} • WR {winRate(w, l)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: "1px",
          height: "48px",
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: 40,
          fontWeight: 900,
          color: net >= 0 ? "#55FF8A" : "#ff5c5c",
        }}
      >
        {fmtNet(net)}
      </div>
    </div>
  );
}