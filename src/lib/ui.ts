export const THEME = {
  // base
  bg: "#050507",
  panel: "rgba(12,12,16,0.82)",
  panelSoft: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.08)",

  // brand
  gold: "#d7b14a",
  purple: "#b58cff",

  // sessions
  tokyoRed: "#ff5c5c",
  londonBlue: "#6aa9ff",
  nycPurple: "#b58cff",

  // outcomes
  green: "#55ff8a",
  red: "#ff5c5c",

  // text
  text: "#ffffff",
  textDim: "rgba(255,255,255,0.65)",
};

export function panelStyle(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 14,
    background: THEME.panel,
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  };
}

export function panelSoft(): React.CSSProperties {
  return {
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    background: THEME.panelSoft,
  };
}

export function btnPrimary(active = false): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${THEME.border}`,
    background: active
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.25)",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    letterSpacing: "0.3px",
  };
}

export function chipStyle(): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: `1px solid ${THEME.border}`,
    background: "rgba(0,0,0,0.25)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

export function sectionHeader(): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 900,
    color: THEME.gold,
    letterSpacing: "0.4px",
    textTransform: "uppercase",
  };
}