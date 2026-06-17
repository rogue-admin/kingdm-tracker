import { ImageResponse } from "next/og";

export const runtime = "edge";

const BASE_URL = "https://kingdm-tracker.vercel.app";

function sessionMeta(session: string) {
  const s = session.toLowerCase();

  if (s === "tokyo") {
    return {
      label: "Tokyo Session",
      flag: "🇯🇵",
      accent: "#ff5c5c",
    };
  }

  if (s === "london") {
    return {
      label: "London Session",
      flag: "🇬🇧",
      accent: "#4ea3ff",
    };
  }

  return {
    label: "NYC Session",
    flag: "🇺🇸",
    accent: "#a855f7",
  };
}

function formatMoney(value: number) {
  const absolute = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return value >= 0 ? `+$${absolute}` : `-$${absolute}`;
}

function getInitial(name: string) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const member = url.searchParams.get("member") ?? "Kingdm Trader";
  const tier = url.searchParams.get("tier") ?? "Knight";
  const session = url.searchParams.get("session") ?? "nyc";
  const amount = Number(url.searchParams.get("amount") ?? 0);
  const date = url.searchParams.get("date") ?? "";
  const avatarUrl = url.searchParams.get("avatarUrl") ?? "";

  const meta = sessionMeta(session);
  const money = formatMoney(amount);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "500px",
          backgroundColor: "rgb(9,9,11)",
          backgroundImage:
            "radial-gradient(circle at 16% 14%, rgba(140,95,255,0.30), rgba(0,0,0,0) 34%), radial-gradient(circle at 86% 12%, rgba(215,177,74,0.24), rgba(0,0,0,0) 36%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          padding: "34px 44px 24px",
          fontFamily: "Arial",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
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
              width="92"
              height="92"
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
                  marginTop: 6,
                  fontSize: 56,
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
              fontSize: 24,
              opacity: 0.75,
              paddingTop: 4,
            }}
          >
            {date}
          </div>
        </div>

        {/* Main Card */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 28,
            border: `2px solid ${meta.accent}`,
            backgroundColor: "rgba(255,255,255,0.03)",
            padding: "22px 28px",
            flex: 1,
          }}
        >
          {/* Left side */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "52%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                width: "100%",
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  width="90"
                  height="90"
                  style={{
                    display: "flex",
                    borderRadius: "999px",
                    border: `2px solid ${meta.accent}`,
                    objectFit: "cover",
                    backgroundColor: "#111827",
                  }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    width: 90,
                    height: 90,
                    borderRadius: 999,
                    border: `2px solid ${meta.accent}`,
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                    fontWeight: 900,
                    backgroundColor: "#111827",
                  }}
                >
                  {getInitial(member)}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignSelf: "flex-start",
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(215,177,74,0.32)",
                    backgroundColor: "rgba(215,177,74,0.08)",
                    color: "#D7B14A",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {tier}
                </div>

                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    fontWeight: 900,
                    lineHeight: 1.05,
                  }}
                >
                  {member}
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: 1,
              height: 88,
              backgroundColor: "rgba(255,255,255,0.16)",
            }}
          />

          {/* Right side */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "center",
              width: "38%",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                color: meta.accent,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {meta.flag} {meta.label}
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 58,
                fontWeight: 900,
                color: amount >= 0 ? "#55FF8A" : "#ff5c5c",
                lineHeight: 1,
              }}
            >
              {money}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 500,
    }
  );
}