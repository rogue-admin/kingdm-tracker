import { ImageResponse } from "next/og";

export const runtime = "edge";

function sessionInfo(session: string) {
  const s = session.toLowerCase();

  if (s === "tokyo") return { label: "TOKYO SESSION", flag: "🇯🇵" };
  if (s === "london") return { label: "LONDON SESSION", flag: "🇬🇧" };
  return { label: "NYC SESSION", flag: "🇺🇸" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const session = url.searchParams.get("session") ?? "nyc";
  const date = url.searchParams.get("date") ?? "";
  const wins = Number(url.searchParams.get("wins") ?? 0);
  const losses = Number(url.searchParams.get("losses") ?? 0);
  const be = Number(url.searchParams.get("be") ?? 0);

  const net = wins - losses;
  const positive = net >= 0;
  const info = sessionInfo(session);

  return new ImageResponse(
    (
      <div
        style={{
  width: "1200px",
  height: "630px",
  backgroundColor: "rgb(9, 9, 11)",
  backgroundImage:
    "radial-gradient(circle at 20% 20%, rgba(140,95,255,0.35), rgba(0,0,0,0) 35%), radial-gradient(circle at 80% 20%, rgba(215,177,74,0.30), rgba(0,0,0,0) 35%)",
  color: "white",
  display: "flex",
  flexDirection: "column",
  padding: "64px",
  fontFamily: "Arial",
}}
      >
        <div style={{ color: "#D7B14A", display: "flex", fontSize: 52, fontWeight: 900 }}>
          The Kingdm
        </div>

        <div style={{ marginTop: 16, display: "flex", fontSize: 72, fontWeight: 900 }}>
          {info.flag} {info.label}
        </div>

        <div style={{ marginTop: 10, display: "flex", fontSize: 32, opacity: 0.75 }}>
          {date}
        </div>

        <div
          style={{
            marginTop: 52,
            display: "flex",
            gap: "28px",
          }}
        >
          <Stat label="TP Hits" value={wins} color="#55FF8A" />
          <Stat label="SL Hits" value={losses} color="#ff5c5c" />
          <Stat label="Break Even" value={be} color="#D7B14A" />
        </div>

        <div
          style={{
            marginTop: 40,
            display: "flex",
            fontSize: 54,
            fontWeight: 900,
            color: positive ? "#55FF8A" : "#ff5c5c",
          }}
        >
          Net Day Result: {positive ? `+${net}` : net}
        </div>

        <div style={{ marginTop: "auto", display: "flex", fontSize: 22, opacity: 0.55, paddingTop: 20, }}>
          Kingdm Trade Tracker Calendar • kingdm-tracker.vercel.app
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
  width: "300px",
  height: "150px",
  borderRadius: "28px",
  border: `2px solid ${color}`,
  backgroundColor: "rgba(255,255,255,0.04)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "28px",
}}
    >
      <div style={{ color, fontSize: 28, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 16, display: "flex", fontSize: 54, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}