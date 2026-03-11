// Default trading configuration — matches backtested BEAR_HALFRISK on SP250
// 15J CAGR 12.7%, MaxDD 13.0%, PF 1.41, 2381 Trades

export const DEFAULT_CONFIG = {
  mode: "CONFIRMATION",       // "CONFIRMATION" | "FULL_AUTO"
  enabled: true,
  portfolioEquity: 45000,
  currency: "EUR",
  minCRV: 1.5,
  maxHoldingDays: 30,
  maxOrdersPerDay: 3,
  maxDailyDrawdownPct: 10,    // Kill-Switch bei 10% Tagesverlust
  minADX: 20,
  maxPositionPct: 0.25,       // Max 25% Depot pro Position
  entryTolerance: 0.02,       // 2% Limit-Toleranz
  regimeParams: {
    STRONG_BULL:   { scoreMin: 6.3, maxPos: 7, riskPct: 0.015 },
    MODERATE_BULL: { scoreMin: 6.5, maxPos: 5, riskPct: 0.010 },
    TRANSITION:    { scoreMin: 7.0, maxPos: 2, riskPct: 0.007 },
    MODERATE_BEAR: { scoreMin: 7.0, maxPos: 2, riskPct: 0.005 },
    CRISIS:        { scoreMin: 7.0, maxPos: 1, riskPct: 0.005 },
  },
};

export const KV_KEYS = {
  CONFIG:    "at:config",
  STATE:     "at:state",
  POSITIONS: "at:positions",
  ORDERS:    "at:orders",
  HISTORY:   "at:history",
  PORTFOLIO: "at:portfolio",
  KILLSWITCH: "at:killswitch",
  dailyLog:  (date) => `at:daily-log:${date}`,
  signalSeen: (sym, date) => `at:signal-seen:${sym}:${date}`,
};

export const ORDER_STATUS = {
  PENDING_APPROVAL: "PENDING_APPROVAL",  // Wartet auf Telegram-Bestaetigung
  PENDING:          "PENDING",           // Limit-Order platziert, wartet auf Fill
  FILLED:           "FILLED",            // Ausgefuehrt
  CANCELLED:        "CANCELLED",         // Manuell storniert
  EXPIRED:          "EXPIRED",           // Tagesgueltig abgelaufen
  REJECTED:         "REJECTED",          // Abgelehnt via Telegram
};

export const EXIT_REASON = {
  STOP:   "STOP",
  TARGET: "TARGET",
  TIME:   "TIME",
  MANUAL: "MANUAL",
  KILLSWITCH: "KILLSWITCH",
  EARNINGS_CLOSE: "EARNINGS_CLOSE",
};

// ─── Time Helpers ───
// US Eastern Time (handles EST/EDT automatically)
const TZ_US = "America/New_York";
const TZ_DE = "Europe/Berlin";

function getHour(tz) {
  return parseInt(new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
}

function getMinute(tz) {
  return parseInt(new Intl.DateTimeFormat("en", { minute: "numeric", timeZone: tz }).format(new Date()));
}

export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/**
 * US Regular Session: 9:30 - 16:00 ET (Mo-Fr)
 * We start checking from 9:30 ET and run until 16:10 ET
 * (extra 10 min for final candle processing after close)
 */
export function isMarketHours() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const etHour = getHour(TZ_US);
  const etMin = getMinute(TZ_US);
  const etTime = etHour * 60 + etMin; // Minutes since midnight
  // 9:30 ET (570 min) to 16:10 ET (970 min)
  return etTime >= 570 && etTime <= 970;
}

/**
 * Daily summary: 22:05 CET/CEST (after all US markets closed)
 */
export function isDailySummaryTime() {
  const cetHour = getHour(TZ_DE);
  const cetMin = getMinute(TZ_DE);
  return cetHour === 22 && cetMin >= 0 && cetMin <= 9;
}

/**
 * Check if US market is currently open (for signal scanning)
 * Stricter than isMarketHours — only during actual trading: 9:30-16:00 ET
 */
export function isUSMarketOpen() {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const etHour = getHour(TZ_US);
  const etMin = getMinute(TZ_US);
  const etTime = etHour * 60 + etMin;
  return etTime >= 570 && etTime <= 960; // 9:30 - 16:00
}
