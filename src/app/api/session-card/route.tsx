import { ImageResponse } from "next/og";

export const runtime = "edge";

const BASE_URL = "https://kingdm-tracker.vercel.app";

function sessionInfo(session: string) {
  const s = session.toLowerCase();

  if (s === "tokyo") {
    return {
      label: "TOKYO SESSION",
      flag: "🇯🇵",
      accent: "#ff4d5a",
      glow: "rgba(255,77,90,0.12)",
    };
  }

  if (s === "london") {
    return {
      label: "LONDON SESSION",
      flag: "🇬🇧",
      accent: "#2f7cff",
      glow: "rgba(47,124,255,0.12)",
    };
  }

  return {
    label: "NYC SESSION",
    flag: "🇺🇸",
    accent: "#9b4dff",
    glow: "rgba(155,77,255,0.12)",
  };
}

function fmtNet(n: number) {
  return n >= 0 ? `+${n}` : String(n);
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const session = url.searchParams.get("session") ?? "nyc";
  const date = url.searchParams.get("date") ?? "";
  const wins = Number(url.searchParams.get("wins") ?? 0);
  const losses = Number(url.searchParams.get("losses") ?? 0);
  const be = Number(url.searchParams.get("be") ?? 0);

  const tradesParam = url.searchParams.get("trades");
  const tradesTaken =
    tradesParam !== null && tradesParam.trim() !== ""
      ? Number(tradesParam)
      : null;

  const hasTradeCount =
    tradesTaken !== null &&
    Number.isInteger(tradesTaken) &&
    tradesTaken >= 1;

  const net = wins - losses;
  const positive = net >= 0;
  const info = sessionInfo(session);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "rgb(9,9,11)",
          backgroundImage:
            "radial-gradient(circle at 18% 14%, rgba(140,95,255,0.28), rgba(0,0,0,0) 34%), radial-gradient(circle at 88% 12%, rgba(215,177,74,0.22), rgba(0,0,0,0) 36%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          padding: "54px 60px",
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
              width="112"
              height="112"
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
                  lineHeight: 1.05,
                }}
              >
                The Kingdm
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 8,
                  fontSize: 58,
                  fontWeight: 900,
                  lineHeight: 1.0,
                }}
              >
                <span>{info.flag}</span>
                <span>{info.label}</span>
              </div>

                            <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: 10,
                  fontSize: 20,
                  opacity: 0.62,
                }}
              >
                <span>Official Session Results</span>

                {hasTradeCount && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        marginLeft: 10,
                        marginRight: 10,
                        color: "#D7B14A",
                        opacity: 0.45,
                      }}
                    >
                      •
                    </span>

                    <span
                      style={{
                        color: "#D7B14A",
                        opacity: 0.72,
                        fontWeight: 500,
                      }}
                    >
                      {tradesTaken}{" "}
                      {tradesTaken === 1
                        ? "trade taken"
                        : "trades taken"}
                    </span>
                  </span>
                )}
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

        {/* Stats row */}
        <div
          style={{
            marginTop: 34,
            display: "flex",
            gap: 24,
          }}
        >
          <Stat label="TP Hits" value={wins} color="#55FF8A" />
          <Stat label="SL Hits" value={losses} color="#ff5c5c" />
          <Stat label="Break Even" value={be} color="#D7B14A" />
        </div>

        {/* Net result pill */}
        <div
          style={{
            marginTop: 30,
            borderRadius: "30px",
            border: `2px solid ${info.accent}`,
            backgroundColor: info.glow,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 30px",
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
                letterSpacing: 0.4,
              }}
            >
              SESSION RESULT
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: 72,
                fontWeight: 900,
                color: positive ? "#55FF8A" : "#ff5c5c",
                lineHeight: 1,
              }}
            >
              {fmtNet(net)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "2px",
              height: "92px",
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 34,
            }}
          >
            <MiniStat label="TP" value={wins} color="#55FF8A" />
            <MiniStat label="SL" value={losses} color="#ff5c5c" />
            <MiniStat label="BE" value={be} color="#D7B14A" />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        width: "344px",
        height: "146px",
        borderRadius: "28px",
        border: `2px solid ${color}`,
        backgroundColor: "rgba(255,255,255,0.035)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "24px 28px",
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
          display: "flex",
          marginTop: 16,
          fontSize: 56,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: "58px",
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
          marginTop: 8,
          fontSize: 46,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}