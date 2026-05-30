"use client";

import React, { useEffect, useMemo, useState } from "react";

type Activity = {
  id: number;
  display_name: string;
  country: string | null;
  city: string | null;
  session: string;
  pnl: number;
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function locationLabel(row: Activity) {
  const city = (row.city ?? "").trim();
  const country = (row.country ?? "").trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return "Location unavailable";
}

function ToastCard({
  row,
  offsetY,
  scale,
  opacity,
  visible = true,
  blur = 0,
}: {
  row: Activity | null;
  offsetY: number;
  scale: number;
  opacity: number;
  visible?: boolean;
  blur?: number;
}) {
  if (!row) return null;

  const positive = row.pnl > 0;
  const neutral = row.pnl === 0;

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        bottom: offsetY,
        width: 280,
        borderRadius: 14,
        padding: "12px 14px",
        background: "rgba(15,15,18,0.95)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
        opacity: visible ? opacity : 0,
        transform: visible ? `scale(${scale})` : `translateY(6px) scale(${scale})`,
        transformOrigin: "bottom right",
        filter: blur ? `blur(${blur}px)` : "none",
        transition: "opacity 240ms ease, transform 240ms ease, filter 240ms ease",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13 }}>
        {neutral ? "🟡" : positive ? "🟢" : "🔴"} {row.display_name}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        {locationLabel(row)} • {row.session}
      </div>

      <div
        style={{
          marginTop: 6,
          fontWeight: 900,
          color: neutral ? "white" : positive ? "#55FF8A" : "#ff5c5c",
        }}
      >
        {row.pnl > 0 ? "+" : ""}
        {fmtMoney(row.pnl)}
      </div>
    </div>
  );
}

export default function LiveActivityToast({ rows }: { rows: Activity[] }) {
  const safeRows = useMemo(() => rows.filter(Boolean), [rows]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (safeRows.length <= 1) return;

    const interval = setInterval(() => {
      setVisible(false);

      const swapTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % safeRows.length);
        setVisible(true);
      }, 240);

      return () => clearTimeout(swapTimer);
    }, 3500);

    return () => clearInterval(interval);
  }, [safeRows]);

  if (!safeRows.length) return null;

  const safeIndex = index % safeRows.length;
  const current = safeRows[safeIndex] ?? null;
  const next = safeRows.length > 1 ? safeRows[(safeIndex + 1) % safeRows.length] ?? null : null;
  const third = safeRows.length > 2 ? safeRows[(safeIndex + 2) % safeRows.length] ?? null : null;

  if (!current) return null;

  const cardOffset = 0;
  const nextOffset = 18;
  const thirdOffset = 34;
  const pillBottom = third ? 126 : next ? 110 : 92;

  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        width: 300,
        height: third ? 170 : next ? 150 : 120,
        overflow: "visible",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: pillBottom,
          zIndex: 5,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(15,15,18,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
          backdropFilter: "blur(8px)",
          fontSize: 11,
          fontWeight: 900,
          color: "rgba(255,255,255,0.86)",
          letterSpacing: "0.02em",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#55FF8A",
            boxShadow: "0 0 12px rgba(85,255,138,0.7)",
            display: "inline-block",
          }}
        />
        Live Activity
      </div>

      {third && <ToastCard row={third} offsetY={thirdOffset} scale={0.93} opacity={0.22} blur={0.4} />}
      {next && <ToastCard row={next} offsetY={nextOffset} scale={0.965} opacity={0.46} />}
      <ToastCard row={current} offsetY={cardOffset} scale={1} opacity={1} visible={visible} />
    </div>
  );
}