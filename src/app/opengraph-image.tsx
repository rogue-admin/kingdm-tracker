import { ImageResponse } from "next/og";

export const alt =
  "The Kingdm Trade Tracker — Built by Rogue Tech";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const BASE_URL = "https://kingdm-tracker.vercel.app";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 70px",
          color: "white",
          backgroundColor: "rgb(9,9,11)",
          backgroundImage:
            "radial-gradient(circle at 17% 18%, rgba(140,95,255,0.34), rgba(0,0,0,0) 36%), radial-gradient(circle at 86% 12%, rgba(215,177,74,0.30), rgba(0,0,0,0) 38%)",
          fontFamily: "Arial",
        }}
      >
        {/* Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <img
            src={`${BASE_URL}/Kingdm-logo.png`}
            width="138"
            height="138"
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
                fontSize: 48,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              The Kingdm
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 14,
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              Trade Tracker
            </div>
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "30px 34px",
            borderRadius: 28,
            border: "2px solid rgba(215,177,74,0.42)",
            backgroundColor: "rgba(255,255,255,0.035)",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#D7B14A",
              fontSize: 25,
              fontWeight: 900,
              letterSpacing: 0.4,
            }}
          >
            COMMUNITY TRADING PERFORMANCE
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 35,
              fontWeight: 700,
              lineHeight: 1.25,
            }}
          >
            Official session results, community leaderboards,
            performance calendars, and trading recaps.
          </div>
        </div>

        {/* Signature */}
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
              fontSize: 23,
              opacity: 0.64,
            }}
          >
            kingdm-tracker.vercel.app
          </div>

          <div
            style={{
              display: "flex",
              color: "#D7B14A",
              fontSize: 23,
              fontWeight: 700,
            }}
          >
            Built by Rogue Tech for The Kingdm
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}