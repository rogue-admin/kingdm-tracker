"use client";

import React, { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

type CountryHeatRow = {
  country: string;
  session?: string;
  traders: number;
  total_pnl: number;
  avg_pnl_per_trader?: number;
  wins: number;
  losses: number;
  breakevens: number;
  total_trades: number;
  avg_win_rate: number;
};

type CountryPresenceRow = {
  country: string;
  subscribers: number;
  visible_leaderboard_subscribers: number;
};

type GeoFeature = {
  rsmKey: string;
  id: string | number;
  properties: {
    name?: string;
  };
};

type MapRegion = "world" | "north_america";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const THEME = {
  gold: "#D7B14A",
  green: "#55FF8A",
  red: "#ff5c5c",
  land: "rgba(255,255,255,0.055)",
  landStroke: "rgba(255,255,255,0.16)",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.22)",
  panel: "rgba(8,8,12,0.72)",
};

function canonicalCountryName(name: string) {
  const n = String(name ?? "").trim().toLowerCase();
  if (["united states of america", "usa", "us"].includes(n)) return "united states";
  if (["united kingdom of great britain and northern ireland", "great britain", "uk"].includes(n)) return "united kingdom";
  if (n === "uae") return "united arab emirates";
  return n;
}

function displayCountryName(name: string) {
  const key = canonicalCountryName(name);
  if (key === "united states") return "United States";
  if (key === "united kingdom") return "United Kingdom";
  if (key === "united arab emirates") return "United Arab Emirates";
  return String(name ?? "");
}

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(n);
  }
}

function fmtPct(n: number) {
  return `${Number(n).toFixed(1)}%`;
}

function alphaFromActivity(count: number, maxCount: number) {
  if (maxCount <= 0) return 0.34;
  const ratio = Math.max(0, Math.min(1, count / maxCount));
  const eased = Math.pow(ratio, 0.62);
  return 0.36 + eased * 0.46;
}

function projectionConfigForRegion(region: MapRegion) {
  if (region === "north_america") {
    return { scale: 340, center: [-96, 40] as [number, number] };
  }
  return { scale: 158, center: [5, 12] as [number, number] };
}

function initialCenterForRegion(region: MapRegion): [number, number] {
  return region === "north_america" ? [-96, 40] : [5, 12];
}

function zoomBtn(): React.CSSProperties {
  return {
    minWidth: 36,
    height: 32,
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.075)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 8px 18px rgba(0,0,0,0.24)",
  };
}

export default function CountryHeatMap({
  rows = [],
  presenceRows = [],
  region = "world",
}: {
  rows?: CountryHeatRow[];
  presenceRows?: CountryPresenceRow[];
  region?: MapRegion;
}) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenterForRegion(region));

  const projectionConfig = projectionConfigForRegion(region);

  const presenceMap = useMemo(() => {
    const map = new Map<string, CountryPresenceRow>();

    presenceRows.forEach((row) => {
      const key = canonicalCountryName(row.country);
      if (!key) return;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          country: displayCountryName(row.country),
          subscribers: Number(row.subscribers ?? 0),
          visible_leaderboard_subscribers: Number(row.visible_leaderboard_subscribers ?? 0),
        });
      } else {
        existing.subscribers += Number(row.subscribers ?? 0);
        existing.visible_leaderboard_subscribers += Number(row.visible_leaderboard_subscribers ?? 0);
      }
    });

    return map;
  }, [presenceRows]);

  const performanceMap = useMemo(() => {
    const map = new Map<string, CountryHeatRow>();

    rows.forEach((row) => {
      const key = canonicalCountryName(row.country);
      if (!key) return;

      const existing = map.get(key);
      const traders = Number(row.traders ?? 0);
      const wins = Number(row.wins ?? 0);
      const losses = Number(row.losses ?? 0);
      const breakevens = Number(row.breakevens ?? 0);
      const totalTrades = Number(row.total_trades ?? 0);
      const pnl = Number(row.total_pnl ?? 0);

      if (!existing) {
        map.set(key, {
          country: displayCountryName(row.country),
          session: row.session,
          traders,
          total_pnl: pnl,
          avg_pnl_per_trader: Number(row.avg_pnl_per_trader ?? 0),
          wins,
          losses,
          breakevens,
          total_trades: totalTrades,
          avg_win_rate: Number(row.avg_win_rate ?? 0),
        });
      } else {
        existing.traders = Math.max(Number(existing.traders ?? 0), traders);
        existing.total_pnl = Number(existing.total_pnl ?? 0) + pnl;
        existing.wins = Number(existing.wins ?? 0) + wins;
        existing.losses = Number(existing.losses ?? 0) + losses;
        existing.breakevens = Number(existing.breakevens ?? 0) + breakevens;
        existing.total_trades = Number(existing.total_trades ?? 0) + totalTrades;
      }
    });

    for (const value of map.values()) {
      const traders = Math.max(1, Number(value.traders ?? 0));
      value.avg_pnl_per_trader = Number(value.total_pnl ?? 0) / traders;
      const decided = Number(value.wins ?? 0) + Number(value.losses ?? 0);
      value.avg_win_rate = decided > 0 ? (Number(value.wins ?? 0) / decided) * 100 : 0;
    }

    return map;
  }, [rows]);

  const activeCountries = useMemo(() => {
    return Array.from(performanceMap.values())
      .filter((row) => Number(row.total_trades ?? 0) > 0)
      .sort((a, b) => Math.abs(Number(b.total_pnl ?? 0)) - Math.abs(Number(a.total_pnl ?? 0)))
      .slice(0, 12);
  }, [performanceMap]);

  const maxActivity = useMemo(() => {
    return Math.max(1, ...Array.from(performanceMap.values()).map((row) => Number(row.total_trades ?? 0)));
  }, [performanceMap]);

  const hoveredKey = hoveredCountry ? canonicalCountryName(hoveredCountry) : "";
  const hoveredPresence = hoveredKey ? presenceMap.get(hoveredKey) : null;
  const hoveredPerformance = hoveredKey ? performanceMap.get(hoveredKey) : null;

  function fillForCountry(geoName: string) {
    const key = canonicalCountryName(geoName);
    const presence = presenceMap.get(key);
    const performance = performanceMap.get(key);
    const hasPerformance = !!performance && Number(performance.total_trades ?? 0) > 0;

    if (!presence && !hasPerformance) return THEME.land;

    if (!hasPerformance) {
      return "rgba(215,177,74,0.30)";
    }

    const alpha = alphaFromActivity(Number(performance.total_trades ?? 0), maxActivity);
    const pnl = Number(performance.total_pnl ?? 0);

    if (pnl > 0) return `rgba(85,255,138,${Math.max(alpha, 0.42)})`;
    if (pnl < 0) return `rgba(255,92,92,${Math.max(alpha, 0.42)})`;
    return `rgba(215,177,74,${Math.max(alpha, 0.34)})`;
  }

  function resetMapView() {
    setZoom(1);
    setMapCenter(initialCenterForRegion(region));
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: region === "north_america" ? 520 : 560,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "radial-gradient(900px 420px at 16% 18%, rgba(140,95,255,0.18), rgba(0,0,0,0) 58%), linear-gradient(135deg, rgba(13,10,28,0.96), rgba(8,8,10,0.98))",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.025), 0 20px 50px rgba(0,0,0,0.34)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(12,8,32,0.45), rgba(0,0,0,0) 34%, rgba(0,0,0,0.62) 78%), linear-gradient(180deg, rgba(0,0,0,0) 58%, rgba(0,0,0,0.72))",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <ComposableMap projection="geoMercator" projectionConfig={projectionConfig} style={{ width: "100%", height: "100%" }}>
          <ZoomableGroup
            center={mapCenter}
            zoom={zoom}
            onMove={(position: { zoom: number }) => setZoom(position.zoom)}
            onMoveEnd={(position: { coordinates: [number, number]; zoom: number }) => {
              setMapCenter(position.coordinates);
              setZoom(position.zoom);
            }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: GeoFeature[] }) =>
                geographies.map((geo) => {
                  const geoName = String(geo.properties.name || "");
                  const key = canonicalCountryName(geoName);
                  const presence = presenceMap.get(key);
                  const performance = performanceMap.get(key);
                  const hasPerformance = !!performance && Number(performance.total_trades ?? 0) > 0;
                  const isInteractive = !!presence || hasPerformance;
                  const pnl = Number(performance?.total_pnl ?? 0);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHoveredCountry(isInteractive ? displayCountryName(geoName) : null)}
                      onMouseLeave={() => setHoveredCountry(null)}
                      style={{
                        default: {
                          fill: fillForCountry(geoName),
                          stroke: hasPerformance ? "rgba(255,255,255,0.30)" : THEME.landStroke,
                          strokeWidth: hasPerformance ? 1.05 : 0.75,
                          outline: "none",
                          filter: hasPerformance
                            ? pnl >= 0
                              ? "drop-shadow(0 0 5px rgba(85,255,138,0.28))"
                              : "drop-shadow(0 0 5px rgba(255,92,92,0.22))"
                            : "none",
                        },
                        hover: {
                          fill: isInteractive ? THEME.gold : THEME.land,
                          stroke: THEME.borderStrong,
                          strokeWidth: 1.55,
                          outline: "none",
                          cursor: isInteractive ? "pointer" : "default",
                          filter: isInteractive ? "drop-shadow(0 0 8px rgba(215,177,74,0.38))" : "none",
                        },
                        pressed: {
                          fill: isInteractive ? THEME.gold : THEME.land,
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <div style={{ position: "absolute", top: 12, right: 14, zIndex: 6, display: "flex", gap: 7, alignItems: "center" }}>
        <button style={zoomBtn()} onClick={() => setZoom((z) => Math.min(6, Number((z * 1.2).toFixed(2))))}>+</button>
        <button style={zoomBtn()} onClick={() => setZoom((z) => Math.max(1, Number((z / 1.2).toFixed(2))))}>-</button>
        <div style={{ ...zoomBtn(), display: "grid", placeItems: "center", cursor: "default", padding: "0 10px" }}>{zoom.toFixed(1)}x</div>
        <button style={zoomBtn()} onClick={resetMapView}>Reset</button>
      </div>

      <div
        style={{
          position: "absolute",
          right: 14,
          top: 62,
          bottom: 14,
          width: 300,
          zIndex: 5,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "linear-gradient(180deg, rgba(20,20,24,0.86), rgba(7,7,10,0.90))",
          backdropFilter: "blur(10px)",
          boxShadow: "0 22px 55px rgba(0,0,0,0.38), inset 0 0 0 1px rgba(255,255,255,0.025)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          {hoveredCountry && (hoveredPresence || hoveredPerformance) ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 950 }}>{hoveredCountry}</div>
              <div style={{ marginTop: 7, fontSize: 12, lineHeight: "17px", opacity: 0.74 }}>
                {hoveredPresence ? `${hoveredPresence.subscribers} subscribers • ${hoveredPresence.visible_leaderboard_subscribers} on leaderboard` : "Performance-only location"}
                {hoveredPerformance && Number(hoveredPerformance.total_trades ?? 0) > 0 ? (
                  <>
                    <br />
                    {hoveredPerformance.total_trades} submissions • {hoveredPerformance.traders} active members
                    <br />
                    {fmtPct(hoveredPerformance.avg_win_rate)} win rate
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, lineHeight: "18px", opacity: 0.78 }}>
              Hover a country to see subscriber presence and recent activity.
            </div>
          )}
        </div>

        <div style={{ padding: "14px 16px 10px", color: THEME.gold, fontSize: 13, fontWeight: 950 }}>
          Active Countries
        </div>

        <div
          style={{
            padding: "0 10px 14px 16px",
            display: "grid",
            gap: 8,
            maxHeight: "calc(100% - 118px)",
            overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(215,177,74,0.45) rgba(255,255,255,0.06)",
          }}
        >
          {activeCountries.length === 0 ? (
            <div style={{ opacity: 0.72, fontSize: 13 }}>No countries with recent activity yet.</div>
          ) : (
            activeCountries.map((row) => {
              const pnl = Number(row.total_pnl ?? 0);
              return (
                <div
                  key={canonicalCountryName(row.country)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.country}</div>
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.68 }}>
                      {row.total_trades} submissions • {row.traders} active member{Number(row.traders) === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ fontWeight: 950, color: pnl > 0 ? THEME.green : pnl < 0 ? THEME.red : "white", whiteSpace: "nowrap", textShadow: pnl > 0 ? "0 0 12px rgba(85,255,138,0.25)" : pnl < 0 ? "0 0 10px rgba(255,92,92,0.22)" : "none" }}>
                    {fmtMoney(pnl)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ position: "absolute", left: 16, bottom: 16, zIndex: 5, display: "grid", gap: 6, fontSize: 11, opacity: 0.88 }}>
        <LegendItem color={THEME.gold} label="Gold = subscriber presence" />
        <LegendItem color={THEME.green} label="Green = positive recent average performance" />
        <LegendItem color={THEME.red} label="Red = negative recent average performance" />
        <LegendItem color="rgba(255,255,255,0.82)" label="Brighter = more active members" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 4, height: 17, borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}` }} />
      <span>{label}</span>
    </div>
  );
}
