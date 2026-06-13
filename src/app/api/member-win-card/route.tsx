import { ImageResponse } from "next/og";

export const runtime = "edge";

type Session = "tokyo" | "london" | "nyc";

function safeNumber(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  const absolute = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (value > 0) return `+$${absolute}`;
  if (value < 0) return `-$${absolute}`;

  return "$0.00";
}

function getSessionInfo(value: string) {
  const session = value.toLowerCase() as Session;

  if (session === "tokyo") {
    return {
      label: "Tokyo",
      flag: "🇯🇵",
      accent: "#ff5c5c",
      border: "rgba(255,92,92,0.52)",
      background: "rgba(255,92,92,0.055)",
    };
  }

  if (session === "london") {
    return {
      label: "London",
      flag: "🇬🇧",
      accent: "#5ab4ff",
      border: "rgba(90,180,255,0.52)",
      background: "rgba(90,180,255,0.055)",
    };
  }

  return {
    label: "NYC",
    flag: "🇺🇸",
    accent: "#aa6eff",
    border: "rgba(170,110,255,0.52)",
    background: "rgba(170,110,255,0.055)",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const displayName = (
    url.searchParams.get("name") ?? "Kingdm Trader"
  ).slice(0, 48);

  const tier =
    url.searchParams.get("tier") === "Elite Knight"
      ? "Elite Knight"
      : "Knight";

  const date = url.searchParams.get("date") ?? "";
  const amount = safeNumber(url.searchParams.get("amount"));
  const sessionInfo = getSessionInfo(
    url.searchParams.get("session") ?? "nyc"
  );

  const origin = url.origin;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "420px",
          padding: "42px 58px",
          backgroundColor: "rgb(9,9,11)",
          backgroundImage:
            "radial-gradient(circle at 17% 12%, rgba(140,95,255,0.30), rgba(0,0,0,0) 38%), radial-gradient(circle at 86% 8%, rgba(215,177,74,0.27), rgba(0,0,0,0) 40%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
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
              gap: 17,
            }}
          >
            <img
              src={`${origin}/Kingdm-logo.png`}
              width="108"
              height="108"
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
                  marginTop: 3,
                  display: "flex",
                  fontSize: 46,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                Member Win
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              opacity: 0.72,
            }}
          >
            {date}
          </div>
        </div>

        {/* Member win panel */}
        <div
          style={{
            marginTop: 25,
            flex: 1,
            borderRadius: "27px",
            border: `2px solid ${sessionInfo.border}`,
            background:
              `linear-gradient(135deg, rgba(140,95,255,0.08), ${sessionInfo.background})`,
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Member */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              width: "48%",
            }}
          >
            <div
              style={{
                alignSelf: "flex-start",
                display: "flex",
                borderRadius: "999px",
                border: "1px solid rgba(215,177,74,0.34)",
                backgroundColor: "rgba(215,177,74,0.09)",
                color:
                  tier === "Elite Knight"
                    ? "#D7B14A"
                    : "#C7CDD8",
                fontSize: 18,
                fontWeight: 900,
                padding: "6px 12px",
              }}
            >
              {tier}
            </div>

            <div
              style={{
                marginTop: 13,
                display: "flex",
                fontSize: 44,
                fontWeight: 900,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: "1px",
              height: "105px",
              backgroundColor: "rgba(255,255,255,0.14)",
            }}
          />

          {/* Session result */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              width: "42%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: sessionInfo.accent,
                fontSize: 27,
                fontWeight: 900,
              }}
            >
              <div style={{ display: "flex" }}>
                {sessionInfo.flag}
              </div>

              <div style={{ display: "flex" }}>
                {sessionInfo.label} Session
              </div>
            </div>

            <div
              style={{
                marginTop: 15,
                display: "flex",
                color: amount >= 0 ? "#55FF8A" : "#ff5c5c",
                fontSize: 62,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {formatMoney(amount)}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 420,
    }
  );
}