// ─── Briefing Component ───
// Taeglich automatisierte Markt-Briefings: Morning (08:30, DAX/EU) und Afternoon (15:00, US)

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Sun, Moon, TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, BarChart3, Target, ArrowRight, Clock } from "lucide-react";

const PROXY_BASE = "https://ncapital-market-proxy.nils-noeller.workers.dev";

// ── Colors (gleich wie TradingJournal / Watchlist) ──
const C = {
  bg: "#0B0E11", card: "#141820", cardHover: "#1A1F2B",
  border: "#1E2433", borderLight: "#2A3144",
  text: "#E8ECF1", textMuted: "#8892A4", textDim: "#5A6478",
  accent: "#6C5CE7", accentLight: "#A29BFE",
  green: "#00D68F", red: "#FF6B6B", yellow: "#FDCB6E", orange: "#FFA502", blue: "#74B9FF",
};

function GlassCard({ children, style }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function SignalBadge({ signal, size = "normal" }) {
  const colorMap = {
    GIER: C.green, NEUTRAL: C.yellow, VORSICHT: C.orange, RISIKO: C.red,
    "RISK-ON": C.green, "RISK-OFF": C.red, EXPANSIV: C.green, RESTRIKTIV: C.red,
    "INFLATIONAER": C.red, "DEFLATIONAER": C.blue, INFO: C.blue,
  };
  const color = colorMap[signal] || C.textMuted;
  const bg = `${color}20`;
  const fontSize = size === "small" ? 10 : 12;
  return (
    <span style={{ fontSize, fontWeight: 700, color, background: bg, borderRadius: 6, padding: "2px 8px", display: "inline-block", textTransform: "uppercase", letterSpacing: 0.5 }}>
      {signal}
    </span>
  );
}

function ScoreBadge({ score, size = "normal" }) {
  const color = score >= 70 ? C.green : score >= 50 ? C.yellow : score >= 30 ? C.orange : C.textDim;
  const bg = score >= 70 ? `${C.green}15` : score >= 50 ? `${C.yellow}15` : score >= 30 ? `${C.orange}15` : "rgba(10,13,17,0.4)";
  const fontSize = size === "small" ? 11 : 14;
  const padding = size === "small" ? "2px 6px" : "4px 10px";
  return (
    <span style={{ fontSize, fontWeight: 700, color, background: bg, borderRadius: 6, padding, display: "inline-block", minWidth: 28, textAlign: "center" }}>
      {score}
    </span>
  );
}

function ChangeDisplay({ change, style }) {
  if (change == null || isNaN(change)) return <span style={{ color: C.textDim, ...style }}>-</span>;
  const color = change > 0.1 ? C.green : change < -0.1 ? C.red : C.textMuted;
  return <span style={{ color, fontWeight: 600, fontFamily: "monospace", ...style }}>{change > 0 ? "+" : ""}{change.toFixed(2)}%</span>;
}

function TrendIcon({ change }) {
  if (change > 0.1) return <TrendingUp size={14} color={C.green} />;
  if (change < -0.1) return <TrendingDown size={14} color={C.red} />;
  return <Minus size={14} color={C.textMuted} />;
}

// ─── Main Briefing Component ───

export default function Briefing({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  // Auto-select tab based on time: before 14:00 CET → morning, after → afternoon
  const getDefaultTab = () => {
    try {
      const cetHour = parseInt(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" }).format(new Date()));
      return cetHour >= 14 ? "afternoon" : "morning";
    } catch { return "morning"; }
  };
  const [activeTab, setActiveTab] = useState(getDefaultTab);

  const fetchBriefing = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // Check localStorage cache first (5 min freshness)
      if (!force) {
        try {
          const cached = localStorage.getItem("ncapital-briefing-cache");
          if (cached) {
            const { data: cachedData, ts } = JSON.parse(cached);
            if (Date.now() - ts < 5 * 60 * 1000) {
              setData(cachedData);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }

      const res = await fetch(`${PROXY_BASE}/api/briefing/latest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      localStorage.setItem("ncapital-briefing-cache", JSON.stringify({ data: json, ts: Date.now() }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBriefing(); }, [fetchBriefing]);

  const briefing = data?.[activeTab];

  // ─── Loading / Error ───
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
        <RefreshCw size={32} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ color: C.textMuted, fontSize: 14 }}>Briefing wird geladen...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard style={{ textAlign: "center", padding: 40 }}>
        <AlertTriangle size={32} color={C.orange} />
        <p style={{ color: C.text, marginTop: 12 }}>Fehler beim Laden: {error}</p>
        <button onClick={() => fetchBriefing(true)} style={{ marginTop: 12, padding: "8px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          Erneut versuchen
        </button>
      </GlassCard>
    );
  }

  const fmtTime = (iso) => {
    if (!iso) return "-";
    try { return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso.slice(0, 16).replace("T", " "); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Header ── */}
      <GlassCard style={{ padding: isMobile ? "16px" : "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{activeTab === "morning" ? "\u2600\uFE0F" : "\uD83C\uDF19"}</span>
            <div>
              <h2 style={{ margin: 0, color: C.text, fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>
                {activeTab === "morning" ? "Morning Briefing" : "Afternoon Briefing"}
              </h2>
              <span style={{ color: C.textMuted, fontSize: 12 }}>
                {activeTab === "morning" ? "08:30 \u2022 DAX & Europa" : "15:00 \u2022 Wall Street & US"}
                {briefing ? ` \u2022 Erstellt: ${fmtTime(briefing.generatedAt)}` : ""}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Tab Toggle */}
            <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
              {["morning", "afternoon"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .2s",
                  background: activeTab === tab ? C.accent : "transparent",
                  color: activeTab === tab ? "#fff" : C.textMuted,
                }}>
                  {tab === "morning" ? <Sun size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> : <Moon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />}
                  {tab === "morning" ? "Morning" : "Afternoon"}
                </button>
              ))}
            </div>
            <button onClick={() => fetchBriefing(true)} disabled={refreshing} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: `${C.accent}20`, color: C.accent, border: `1px solid ${C.accent}40`,
              borderRadius: 8, cursor: refreshing ? "wait" : "pointer", fontSize: 13, fontWeight: 600,
            }}>
              <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} /> Refresh
            </button>
          </div>
        </div>
      </GlassCard>

      {!briefing ? (
        <GlassCard style={{ textAlign: "center", padding: 40 }}>
          <Clock size={32} color={C.textMuted} />
          <p style={{ color: C.textMuted, marginTop: 12 }}>
            {activeTab === "morning" ? "Morning Briefing wird ab 08:30 Uhr generiert." : "Afternoon Briefing wird ab 15:00 Uhr generiert."}
          </p>
        </GlassCard>
      ) : (
        <>
          {/* ── Saisonale Einordnung ── */}
          <SeasonalSection seasonal={briefing.seasonalContext} isMobile={isMobile} />

          {/* ── Wirtschaftskalender ── */}
          <CalendarSection upcomingEvents={briefing.seasonalContext?.upcomingEvents} isMobile={isMobile} />

          {/* ── Makro-Ueberblick ── */}
          <MacroSection macro={briefing.macroOverview} vixHistory={briefing.vixHistory} isMobile={isMobile} />

          {/* ── Liquiditaet & Volumen ── */}
          <LiquiditySection volumeOverview={briefing.volumeOverview} aggregateLiquidity={briefing.aggregateLiquidity} isMobile={isMobile} />

          {/* ── Intermarket-Signale ── */}
          <IntermarketSection signals={briefing.intermarketSignals} isMobile={isMobile} />

          {/* ── Sektor-Rotation ── */}
          {briefing.sectorRotation?.length > 0 && (
            <SectorSection sectors={briefing.sectorRotation} regionFocus={briefing.regionFocus} isMobile={isMobile} />
          )}

          {/* ── Scanner Top-Hits ── */}
          {briefing.scannerHits?.length > 0 && (
            <ScannerHitsSection hits={briefing.scannerHits} isMobile={isMobile} onNavigate={onNavigate} />
          )}

          {/* ── Swing-Trade Setups ── */}
          {briefing.tradeSetups?.length > 0 && (
            <TradeSetupsSection setups={briefing.tradeSetups} isMobile={isMobile} onNavigate={onNavigate} />
          )}

          {/* ── Futures ── */}
          {briefing.futures && (
            <FuturesSection futures={briefing.futures} isMobile={isMobile} />
          )}
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ─── Seasonal Section ───
function SeasonalSection({ seasonal, isMobile }) {
  if (!seasonal) return null;
  const { monthName, monthPattern, presidentialCycle, midtermNote, upcomingEvents } = seasonal;

  // Color bar for monthly pattern
  const sp500Num = typeof monthPattern.sp500Avg === "string" ? parseFloat(monthPattern.sp500Avg) : monthPattern.sp500Avg;
  const daxNum = typeof monthPattern.daxAvg === "string" ? parseFloat(monthPattern.daxAvg) : monthPattern.daxAvg;
  const sp500Color = sp500Num > 0.5 ? C.green : sp500Num < -0.2 ? C.red : C.yellow;
  const daxColor = daxNum > 0.5 ? C.green : daxNum < -0.2 ? C.red : C.yellow;

  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Calendar size={18} color={C.accent} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Saisonale Einordnung</h3>
        <span style={{ color: C.textMuted, fontSize: 13, marginLeft: "auto" }}>{monthName} {seasonal.year}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: midtermNote ? 14 : 0 }}>
        {/* Monthly Pattern */}
        <div style={{ background: C.bg, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Monats-Saisonalitaet</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
            <div>
              <span style={{ color: C.textDim, fontSize: 11 }}>S&P 500 </span>
              <span style={{ color: sp500Color, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>
                {sp500Num > 0 ? "+" : ""}{typeof sp500Num === "number" ? sp500Num.toFixed(1) : sp500Num}%
              </span>
            </div>
            <div>
              <span style={{ color: C.textDim, fontSize: 11 }}>DAX </span>
              <span style={{ color: daxColor, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>
                {daxNum > 0 ? "+" : ""}{typeof daxNum === "number" ? daxNum.toFixed(1) : daxNum}%
              </span>
            </div>
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>{monthPattern.note}</div>
        </div>

        {/* Presidential Cycle */}
        <div style={{ background: C.bg, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>US-Wahlzyklus</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 15 }}>{presidentialCycle.name}</span>
            <span style={{ color: C.textDim, fontSize: 12 }}>Jahr {presidentialCycle.year}/4</span>
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.5 }}>{presidentialCycle.note}</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: C.textDim, fontSize: 11 }}>S&P-Avg </span>
            <span style={{ color: presidentialCycle.sp500Avg > 0 ? C.green : C.red, fontWeight: 600, fontSize: 13, fontFamily: "monospace" }}>
              {presidentialCycle.sp500Avg > 0 ? "+" : ""}{presidentialCycle.sp500Avg}%
            </span>
          </div>
        </div>
      </div>

      {/* Midterm Note */}
      {midtermNote && (
        <div style={{ background: `${C.orange}12`, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.orange}30` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} color={C.orange} />
            <span style={{ color: C.orange, fontSize: 13, fontWeight: 600 }}>{midtermNote}</span>
          </div>
        </div>
      )}

    </GlassCard>
  );
}

// ─── Calendar Section (Wirtschaftskalender mit Impact-Scoring) ───
function CalendarSection({ upcomingEvents, isMobile }) {
  if (!upcomingEvents?.length) return null;

  const typeColors = { fed: C.orange, options: C.red, earnings: C.blue, political: C.accent, data: C.yellow, ecb: C.blue, minutes: C.textMuted };
  const typeIcons = { fed: "\uD83C\uDFE6", options: "\uD83D\uDCCA", earnings: "\uD83D\uDCC8", political: "\uD83D\uDDF3\uFE0F", data: "\uD83D\uDCC9", ecb: "\uD83C\uDDEA\uD83C\uDDFA", minutes: "\uD83D\uDCDD" };
  const impactColors = { high: C.red, medium: C.orange, low: C.yellow };
  const impactLabels = { high: "Hoch", medium: "Mittel", low: "Niedrig" };

  const groups = [
    { label: "Diese Woche", events: upcomingEvents.filter(e => e.daysUntil <= 7) },
    { label: "Naechste Woche", events: upcomingEvents.filter(e => e.daysUntil > 7 && e.daysUntil <= 14) },
    { label: "Spaeter", events: upcomingEvents.filter(e => e.daysUntil > 14) },
  ].filter(g => g.events.length > 0);

  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Calendar size={18} color={C.accent} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Wirtschaftskalender</h3>
        <span style={{ color: C.textMuted, fontSize: 12 }}>Naechste 30 Tage</span>
      </div>
      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 14 }}>
          <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>{group.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {group.events.map((ev, i) => {
              const iColor = impactColors[ev.impact] || C.yellow;
              const icon = typeIcons[ev.type] || "\uD83D\uDCC5";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  background: C.bg, borderRadius: 10, padding: "10px 14px",
                  border: `1px solid ${C.border}`, borderLeft: `3px solid ${iColor}`,
                }}>
                  <div style={{ minWidth: 44, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.textDim }}>
                      {ev.daysUntil <= 0 ? "Heute" : ev.daysUntil === 1 ? "Morgen" : `In ${ev.daysUntil}d`}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: ev.daysUntil <= 1 ? C.accent : C.text }}>
                      {ev.day}.{ev.month}.
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{ev.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: iColor, background: `${iColor}20`, borderRadius: 4, padding: "1px 6px" }}>
                        {impactLabels[ev.impact] || ev.impact}
                      </span>
                    </div>
                    {ev.description && (!isMobile || ev.impact === "high") && (
                      <div style={{ color: C.textMuted, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{ev.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </GlassCard>
  );
}

// ─── Liquidity Section (Volumen-Analyse fuer Indizes) ───
function LiquiditySection({ volumeOverview, aggregateLiquidity, isMobile }) {
  if (!volumeOverview?.length) return null;

  const levelColors = { "Hoch": C.green, "Normal": C.yellow, "Unterdurchschnittlich": C.orange, "Niedrig": C.red };

  function formatVol(n) {
    if (!n) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(0) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return n.toString();
  }

  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <BarChart3 size={18} color={C.accent} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Liquiditaet & Volumen</h3>
        {aggregateLiquidity && (
          <span style={{
            fontSize: 11, fontWeight: 700, marginLeft: "auto",
            color: levelColors[aggregateLiquidity.level] || C.textMuted,
            background: `${(levelColors[aggregateLiquidity.level] || C.textMuted)}20`,
            borderRadius: 6, padding: "2px 8px",
          }}>
            {"\u00D8"} {aggregateLiquidity.avgRatio}x ({aggregateLiquidity.level})
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
        {volumeOverview.map(v => {
          const color = levelColors[v.level] || C.textMuted;
          const barWidth = Math.min(100, Math.max(5, v.ratio * 50));
          return (
            <div key={v.symbol} style={{ background: C.bg, borderRadius: 12, padding: 12, border: `1px solid ${C.border}` }}>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{v.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "monospace" }}>{v.ratio}x</span>
                <span style={{ fontSize: 10, color: C.textDim }}>{v.level}</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 6, position: "relative" }}>
                <div style={{ height: "100%", width: `${barWidth}%`, background: color, borderRadius: 3, transition: "width .5s" }} />
                {/* 1.0x reference line */}
                <div style={{ position: "absolute", left: "50%", top: -1, width: 1, height: 8, background: C.textDim }} />
              </div>
              <div style={{ fontSize: 10, color: C.textDim }}>
                Vol: {formatVol(v.current)} / {"\u00D8"} {formatVol(v.avg5d)}
              </div>
              {v.longTermRatio != null && (
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                  vs. Jahres-{"\u00D8"}: <span style={{ color: v.longTermRatio >= 1 ? C.green : C.red, fontWeight: 600 }}>{v.longTermRatio}x</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─── Macro Section ───
// VIX classification helper
function getVixLevel(price) {
  if (price < 12) return { label: "Sehr niedrig", color: C.green, desc: "Extreme Sorglosigkeit, oft vor Korrekturen" };
  if (price < 16) return { label: "Niedrig", color: C.green, desc: "Ruhiger Markt, geringes Absicherungsbedürfnis" };
  if (price < 20) return { label: "Normal", color: C.yellow, desc: "Markt im Gleichgewicht, moderate Schwankungen" };
  if (price < 25) return { label: "Erhöht", color: C.orange, desc: "Steigende Unsicherheit, Absicherung nimmt zu" };
  if (price < 30) return { label: "Hoch", color: C.orange, desc: "Deutliche Angst im Markt, erhöhte Volatilitaet" };
  if (price < 40) return { label: "Sehr hoch", color: C.red, desc: "Panik-Modus, starke Schwankungen erwartet" };
  return { label: "Extrem", color: C.red, desc: "Crash-Niveau, historisch seltene Extremwerte" };
}

const VIX_SCALE = [
  { max: 12, label: "<12 Sehr niedrig", color: C.green },
  { max: 16, label: "12-16 Niedrig", color: C.green },
  { max: 20, label: "16-20 Normal", color: C.yellow },
  { max: 25, label: "20-25 Erhöht", color: C.orange },
  { max: 30, label: "25-30 Hoch", color: C.orange },
  { max: 40, label: "30-40 Sehr hoch", color: C.red },
  { max: 100, label: ">40 Extrem", color: C.red },
];

function VixTooltip({ price, vixHistory, isMobile }) {
  const [show, setShow] = useState(false);
  const level = getVixLevel(price);

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(s => !s)}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, color: level.color, background: `${level.color}20`,
        borderRadius: 4, padding: "1px 6px", cursor: "pointer", borderBottom: `1px dashed ${level.color}60`,
      }}>
        {level.label}
      </span>

      {show && (
        <div style={{
          position: "absolute", top: "100%", left: isMobile ? -60 : 0, zIndex: 100, marginTop: 6,
          background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 14,
          width: isMobile ? 280 : 300, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {/* Current classification */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: level.color, marginBottom: 4 }}>
              VIX {price?.toFixed(2)} — {level.label}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{level.desc}</div>
          </div>

          {/* Scale */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Einordnung</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {VIX_SCALE.map((s, i) => {
                const active = (i === 0 && price < s.max) ||
                  (i > 0 && price >= VIX_SCALE[i - 1].max && price < s.max) ||
                  (i === VIX_SCALE.length - 1 && price >= VIX_SCALE[i - 1].max);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "2px 6px", borderRadius: 4,
                    background: active ? `${s.color}20` : "transparent",
                    border: active ? `1px solid ${s.color}40` : "1px solid transparent",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, opacity: active ? 1 : 0.4 }} />
                    <span style={{ fontSize: 11, color: active ? s.color : C.textDim, fontWeight: active ? 700 : 400 }}>
                      {s.label}
                    </span>
                    {active && <span style={{ fontSize: 10, color: s.color, marginLeft: "auto" }}>{"\u25C0"}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historical comparison */}
          {vixHistory && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Historischer Vergleich</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "1 Woche", val: vixHistory.week?.close, chg: vixHistory.week?.change, avg: vixHistory.week?.avg },
                  { label: "1 Monat", val: vixHistory.month?.close, chg: vixHistory.month?.change, avg: vixHistory.month?.avg },
                  { label: "YTD", val: vixHistory.ytd?.open, chg: vixHistory.ytd?.change, avg: vixHistory.ytd?.avg },
                ].map((h, i) => (
                  <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3 }}>{h.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: h.chg > 0 ? C.red : C.green, fontFamily: "monospace" }}>
                      {h.chg != null ? `${h.chg > 0 ? "+" : ""}${h.chg.toFixed(1)}%` : "-"}
                    </div>
                    {h.avg != null && (
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                        {"\u00D8"} {h.avg.toFixed(1)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {vixHistory.ytd && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: C.textDim }}>
                  <span>YTD Low: <span style={{ color: C.green, fontWeight: 600 }}>{vixHistory.ytd.low?.toFixed(1)}</span></span>
                  <span>YTD High: <span style={{ color: C.red, fontWeight: 600 }}>{vixHistory.ytd.high?.toFixed(1)}</span></span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 52-Week Range Tooltip for all macro values
function RangeTooltip({ item, isMobile }) {
  const [show, setShow] = useState(false);
  const w52 = item.w52;
  if (!w52) return null;

  const pos = Math.max(0, Math.min(100, w52.rangePosition || 0));
  // Color based on position: near low = red, near high = green (inverted for VIX)
  const isVix = item.symbol === "^VIX";
  const posColor = isVix
    ? (pos > 75 ? C.red : pos > 50 ? C.orange : pos > 25 ? C.yellow : C.green)
    : (pos > 75 ? C.green : pos > 50 ? C.yellow : pos > 25 ? C.orange : C.red);

  const fmtPrice = (p) => {
    if (p == null) return "-";
    return p.toLocaleString("de-DE", { maximumFractionDigits: p > 100 ? 0 : p > 10 ? 1 : 2 });
  };

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(s => !s)}
    >
      {/* Mini range bar always visible */}
      <div style={{ width: 40, height: 4, background: C.border, borderRadius: 2, position: "relative" }}>
        <div style={{ position: "absolute", left: `${pos}%`, top: -1, width: 5, height: 6, background: posColor, borderRadius: 1, transform: "translateX(-50%)" }} />
      </div>
      <span style={{ fontSize: 9, color: C.textDim }}>{pos}%</span>

      {show && (
        <div style={{
          position: "absolute", top: "100%", left: isMobile ? -80 : -20, zIndex: 100, marginTop: 6,
          background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 12, padding: 14,
          width: isMobile ? 250 : 270, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>
            {item.name} — 52W Range
          </div>

          {/* Visual range bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>Low {fmtPrice(w52.low)}</span>
              <span style={{ fontSize: 10, color: C.green, fontWeight: 600 }}>High {fmtPrice(w52.high)}</span>
            </div>
            <div style={{ height: 10, background: C.bg, borderRadius: 5, position: "relative", border: `1px solid ${C.border}` }}>
              {/* Gradient bar */}
              <div style={{
                position: "absolute", inset: 1, borderRadius: 4,
                background: `linear-gradient(to right, ${C.red}60, ${C.yellow}60, ${C.green}60)`,
              }} />
              {/* Current price marker */}
              <div style={{
                position: "absolute", left: `${pos}%`, top: -3, width: 4, height: 16,
                background: C.text, borderRadius: 2, transform: "translateX(-50%)",
                boxShadow: "0 0 6px rgba(255,255,255,0.4)",
              }} />
            </div>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: posColor, fontWeight: 700 }}>
                Aktuell: {fmtPrice(item.price)} ({pos}% der Range)
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ background: C.bg, borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 10, color: C.textDim }}>Abstand 52W-High</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: w52.pctFromHigh < -10 ? C.red : w52.pctFromHigh < -3 ? C.orange : C.green, fontFamily: "monospace" }}>
                {w52.pctFromHigh != null ? `${w52.pctFromHigh > 0 ? "+" : ""}${w52.pctFromHigh.toFixed(1)}%` : "-"}
              </div>
            </div>
            <div style={{ background: C.bg, borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 10, color: C.textDim }}>Abstand 52W-Low</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, fontFamily: "monospace" }}>
                {w52.pctFromLow != null ? `+${w52.pctFromLow.toFixed(1)}%` : "-"}
              </div>
            </div>
            <div style={{ background: C.bg, borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 10, color: C.textDim }}>{"\u00D8"} 52W</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>{fmtPrice(w52.avg)}</div>
            </div>
            <div style={{ background: C.bg, borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 10, color: C.textDim }}>5d Trend</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.trend5d > 0 ? C.green : item.trend5d < 0 ? C.red : C.textDim, fontFamily: "monospace" }}>
                {item.trend5d != null ? `${item.trend5d > 0 ? "+" : ""}${item.trend5d.toFixed(1)}%` : "-"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroSection({ macro, vixHistory, isMobile }) {
  if (!macro?.length) return null;

  // Category display names + icons
  const categoryMeta = {
    indices: { label: "Indizes", icon: "\uD83D\uDCC8" },
    volatility: { label: "Volatilitaet", icon: "\u26A1" },
    bonds: { label: "Anleihen", icon: "\uD83C\uDFE6" },
    commodities: { label: "Rohstoffe", icon: "\uD83E\uDD47" },
    crypto: { label: "Krypto", icon: "\u20BF" },
    currencies: { label: "Waehrungen", icon: "\uD83D\uDCB1" },
    futures: { label: "Futures", icon: "\uD83D\uDD2E" },
  };

  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <BarChart3 size={18} color={C.accent} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Makro-Ueberblick</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
        {macro.flatMap(group => group.items.map(item => {
          const isVix = item.symbol === "^VIX";
          // VIX special color logic
          let priceColor = C.text;
          if (isVix) {
            priceColor = item.price >= 30 ? C.red : item.price >= 20 ? C.orange : item.price >= 15 ? C.yellow : C.green;
          }
          return (
            <div key={item.symbol} style={{ background: C.bg, borderRadius: 12, padding: isMobile ? 10 : 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </span>
                <TrendIcon change={item.change} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: priceColor, fontSize: isMobile ? 15 : 17, fontWeight: 700, fontFamily: "monospace" }}>
                  {item.price?.toLocaleString("de-DE", { maximumFractionDigits: item.price > 100 ? 0 : 2 })}
                </span>
                <ChangeDisplay change={item.change} style={{ fontSize: 12 }} />
              </div>
              {/* VIX: special classification + history tooltip */}
              {isVix && item.price > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <VixTooltip price={item.price} vixHistory={vixHistory} isMobile={isMobile} />
                  {item.w52 && <RangeTooltip item={item} isMobile={isMobile} />}
                </div>
              )}
              {/* All others: 52W range bar */}
              {!isVix && (
                <div style={{ marginTop: 4 }}>
                  {item.w52 ? (
                    <RangeTooltip item={item} isMobile={isMobile} />
                  ) : item.trend5d != null ? (
                    <div style={{ fontSize: 10, color: C.textDim }}>
                      5d: <span style={{ color: item.trend5d > 0 ? C.green : item.trend5d < 0 ? C.red : C.textDim }}>{item.trend5d > 0 ? "+" : ""}{item.trend5d.toFixed(1)}%</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        }))}
      </div>
    </GlassCard>
  );
}

// ─── Intermarket Signals Section ───
function IntermarketSection({ signals, isMobile }) {
  if (!signals?.length) return null;
  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={18} color={C.accent} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Intermarket-Signale</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
        {signals.map((sig, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{sig.indicator}</div>
              <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{sig.interpretation}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {sig.value != null && (
                <span style={{ color: C.textDim, fontSize: 12, fontFamily: "monospace" }}>
                  {typeof sig.value === "number" ? sig.value.toFixed(2) : sig.value}
                </span>
              )}
              <SignalBadge signal={sig.signal} />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Sector Rotation Section ───
function SectorSection({ sectors, regionFocus, isMobile }) {
  const maxHits = Math.max(...sectors.map(s => s.hitCount), 1);

  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <BarChart3 size={18} color={C.accent} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Sektor-Rotation</h3>
        <span style={{ color: C.textMuted, fontSize: 12 }}>{regionFocus === "EU" ? "\uD83C\uDDE9\uD83C\uDDEA DAX" : "\uD83C\uDDFA\uD83C\uDDF8 US"}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sectors.map((sector, i) => {
          const barWidth = Math.max(8, (sector.hitCount / maxHits) * 100);
          const barColor = sector.hitCount >= 3 ? C.green : sector.hitCount >= 2 ? C.yellow : C.textDim;
          const topNames = (sector.topSymbols || []).map(s => typeof s === "object" ? s.symbol : s).slice(0, 3);

          return (
            <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{sector.sector}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.textMuted, fontSize: 11 }}>Avg Swing: <span style={{ color: C.text, fontWeight: 600 }}>{Math.round(sector.avgSwingScore || 0)}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{sector.hitCount}</span>
                </div>
              </div>
              <div style={{ height: 6, background: `${C.border}`, borderRadius: 3, marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${barWidth}%`, background: barColor, borderRadius: 3, transition: "width .5s" }} />
              </div>
              {topNames.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {topNames.map(sym => (
                    <span key={sym} style={{ fontSize: 11, color: C.accent, background: `${C.accent}15`, borderRadius: 6, padding: "2px 8px" }}>{sym}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─── Scanner Hits Section ───
function ScannerHitsSection({ hits, isMobile, onNavigate }) {
  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={18} color={C.accent} />
          <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Scanner Top-Hits</h3>
          <span style={{ color: C.textMuted, fontSize: 12 }}>({hits.length})</span>
        </div>
        {onNavigate && (
          <button onClick={() => onNavigate("watchlist")} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", background: `${C.accent}20`, color: C.accent,
            border: `1px solid ${C.accent}40`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
          }}>
            Watchlist <ArrowRight size={12} />
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: "left", color: C.textMuted, fontSize: 11, fontWeight: 600, padding: "6px 8px" }}>Symbol</th>
              <th style={{ textAlign: "right", color: C.textMuted, fontSize: 11, fontWeight: 600, padding: "6px 8px" }}>Kurs</th>
              <th style={{ textAlign: "right", color: C.textMuted, fontSize: 11, fontWeight: 600, padding: "6px 8px" }}>Chg%</th>
              {!isMobile && <th style={{ textAlign: "center", color: C.textMuted, fontSize: 11, fontWeight: 600, padding: "6px 8px" }}>Swing</th>}
              <th style={{ textAlign: "center", color: C.textMuted, fontSize: 11, fontWeight: 600, padding: "6px 8px" }}>Score</th>
              {!isMobile && <th style={{ textAlign: "left", color: C.textMuted, fontSize: 11, fontWeight: 600, padding: "6px 8px" }}>Signale</th>}
            </tr>
          </thead>
          <tbody>
            {hits.map((h, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}40` }}>
                <td style={{ padding: "8px", color: C.text, fontWeight: 700 }}>
                  {h.symbol}
                  {h.currency && <span style={{ color: C.textDim, fontSize: 10, marginLeft: 4 }}>{h.currency}</span>}
                </td>
                <td style={{ padding: "8px", textAlign: "right", color: C.text, fontFamily: "monospace" }}>
                  {h.price?.toLocaleString("de-DE", { maximumFractionDigits: h.price > 100 ? 0 : 2 })}
                </td>
                <td style={{ padding: "8px", textAlign: "right" }}><ChangeDisplay change={h.change} /></td>
                {!isMobile && <td style={{ padding: "8px", textAlign: "center" }}><ScoreBadge score={h.swingScore} size="small" /></td>}
                <td style={{ padding: "8px", textAlign: "center" }}><ScoreBadge score={h.combinedScore} /></td>
                {!isMobile && (
                  <td style={{ padding: "8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(h.signals || []).slice(0, 2).map((s, j) => (
                        <span key={j} style={{ fontSize: 10, color: C.textMuted, background: `${C.border}`, borderRadius: 4, padding: "2px 6px" }}>{s}</span>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

// ─── Trade Setups Section ───
function TradeSetupsSection({ setups, isMobile, onNavigate }) {
  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Target size={18} color={C.green} />
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Swing-Trade Setups</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {setups.map((setup, i) => {
          const range = setup.target - setup.stop;
          const entryPos = ((setup.entry - setup.stop) / range) * 100;

          return (
            <div key={i} style={{ background: C.bg, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <span style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>{setup.symbol}</span>
                  <span style={{ color: C.textDim, fontSize: 11, marginLeft: 6 }}>{setup.currency}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ScoreBadge score={setup.swingScore} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green, background: `${C.green}15`, padding: "3px 10px", borderRadius: 6 }}>
                    CRV {setup.crv}
                  </span>
                </div>
              </div>

              {/* Entry / Stop / Target Bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>Stop {setup.stop?.toFixed(2)}</span>
                  <span style={{ fontSize: 11, color: C.blue, fontWeight: 600 }}>Entry {setup.entry?.toFixed(2)}</span>
                  <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>Target {setup.target?.toFixed(2)}</span>
                </div>
                <div style={{ height: 8, background: C.border, borderRadius: 4, position: "relative" }}>
                  {/* Red zone (stop) */}
                  <div style={{ position: "absolute", left: 0, height: "100%", width: `${entryPos}%`, background: `${C.red}40`, borderRadius: "4px 0 0 4px" }} />
                  {/* Green zone (target) */}
                  <div style={{ position: "absolute", left: `${entryPos}%`, height: "100%", width: `${100 - entryPos}%`, background: `${C.green}40`, borderRadius: "0 4px 4px 0" }} />
                  {/* Entry marker */}
                  <div style={{ position: "absolute", left: `${entryPos}%`, top: -3, width: 3, height: 14, background: C.blue, borderRadius: 2, transform: "translateX(-50%)" }} />
                </div>
              </div>

              {/* Signals */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {(setup.signals || []).map((sig, j) => (
                  <span key={j} style={{ fontSize: 11, color: C.textMuted, background: `${C.accent}12`, borderRadius: 6, padding: "3px 8px", border: `1px solid ${C.accent}20` }}>
                    {sig}
                  </span>
                ))}
              </div>

              {/* Trade Check Button */}
              {onNavigate && (
                <button onClick={() => onNavigate("check")} style={{
                  width: "100%", padding: "8px 0", background: `${C.accent}15`, color: C.accent,
                  border: `1px solid ${C.accent}30`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}>
                  Trade Check starten {"\u2192"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─── Futures Section ───
function FuturesSection({ futures, isMobile }) {
  const items = [
    { key: "es", label: "S&P 500 Futures", data: futures.es },
    { key: "nq", label: "Nasdaq Futures", data: futures.nq },
  ].filter(f => f.data);

  if (items.length === 0) return null;

  return (
    <GlassCard>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{"\uD83D\uDD2E"}</span>
        <h3 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 700 }}>Pre-Market Futures</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        {items.map(({ key, label, data }) => (
          <div key={key} style={{ background: C.bg, borderRadius: 12, padding: 14, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600 }}>{label}</div>
              <div style={{ color: C.text, fontSize: 18, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>
                {data.price?.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <ChangeDisplay change={data.change} style={{ fontSize: 15 }} />
              <div style={{ marginTop: 4 }}><TrendIcon change={data.change} /></div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
