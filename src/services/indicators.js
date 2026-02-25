// ─── Merkmalliste-basierte Indikator-Auswertung ───
// Berechnet fuer jeden autoKey der Merkmalliste: { value: boolean, confidence: number, detail: string }

import { RSI, EMA, SMA, BollingerBands } from "technicalindicators";

// ── Hilfsfunktionen ──

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return 0;
  let atrSum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const prev = candles[i - 1];
    const c = candles[i];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    atrSum += tr;
  }
  return atrSum / period;
}

function findSwingLows(candles, window = 2) {
  const lows = [];
  for (let i = window; i < candles.length - window; i++) {
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i].low > candles[i - j].low || candles[i].low > candles[i + j].low) { isLow = false; break; }
    }
    if (isLow) lows.push({ idx: i, price: candles[i].low });
  }
  return lows;
}

function findSwingHighs(candles, window = 2) {
  const highs = [];
  for (let i = window; i < candles.length - window; i++) {
    let isHigh = true;
    for (let j = 1; j <= window; j++) {
      if (candles[i].high < candles[i - j].high || candles[i].high < candles[i + j].high) { isHigh = false; break; }
    }
    if (isHigh) highs.push({ idx: i, price: candles[i].high });
  }
  return highs;
}

function isInsideBar(prev, curr) {
  return curr.high <= prev.high && curr.low >= prev.low;
}

function isHammer(c) {
  const body = Math.abs(c.close - c.open);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const totalRange = c.high - c.low;
  const upperWickSmall = (c.high - Math.max(c.open, c.close)) <= body * 0.5;
  return totalRange > 0 && lowerWick >= body * 2 && upperWickSmall;
}

function isBullishEngulfing(prev, curr) {
  return prev.close < prev.open && curr.close > curr.open && curr.open <= prev.close && curr.close >= prev.open;
}

// ── Hauptfunktion ──

/**
 * Berechnet alle autoKeys fuer die Merkmalliste.
 * @param {Array} candles - OHLCV Kerzen (mind. 30, ideal 200+)
 * @param {number} entryPrice - Geplanter Einstiegskurs
 * @param {Array|null} indexCandles - Leitindex-Kerzen (optional)
 * @returns {{ [autoKey: string]: { value: boolean, confidence: number, detail: string } }}
 */
export function evaluateMerkmalliste(candles, entryPrice, indexCandles = null) {
  if (!candles || candles.length < 30) return {};

  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  // ── Technische Indikatoren berechnen ──
  const ema20Arr = EMA.calculate({ values: closes, period: 20 });
  const ema50Arr = EMA.calculate({ values: closes, period: 50 });
  const sma50Arr = SMA.calculate({ values: closes, period: 50 });
  const sma200Arr = closes.length >= 200 ? SMA.calculate({ values: closes, period: 200 }) : [];
  const rsiArr = RSI.calculate({ values: closes, period: 14 });
  const bbArr = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });

  const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : null;
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : null;
  const sma50 = sma50Arr.length > 0 ? sma50Arr[sma50Arr.length - 1] : null;
  const sma200 = sma200Arr.length > 0 ? sma200Arr[sma200Arr.length - 1] : null;
  const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : null;
  const bb = bbArr.length > 0 ? bbArr[bbArr.length - 1] : null;
  const bbPrev = bbArr.length > 5 ? bbArr[bbArr.length - 6] : null;

  const atr = calcATR(candles);
  const atr10ago = candles.length > 24 ? calcATR(candles.slice(0, -10)) : atr;

  const swingHighs = findSwingHighs(candles.slice(-60));
  const swingLows = findSwingLows(candles.slice(-60));

  const recentHigh = candles.slice(-20).reduce((m, c) => Math.max(m, c.high), 0);

  const results = {};

  // ════════════════════════════════════════════════════════
  // TREND-PULLBACK Kriterien
  // ════════════════════════════════════════════════════════

  // aboveSMA50: Kurs > SMA50
  results.aboveSMA50 = {
    value: sma50 != null && currentPrice > sma50,
    confidence: sma50 != null ? 0.95 : 0.3,
    detail: sma50 != null ? `Kurs ${currentPrice.toFixed(2)} ${currentPrice > sma50 ? ">" : "<"} SMA50 ${sma50.toFixed(2)}` : "SMA50 nicht verfuegbar",
  };

  // aboveSMA200: Kurs > SMA200
  results.aboveSMA200 = {
    value: sma200 != null && currentPrice > sma200,
    confidence: sma200 != null ? 0.95 : 0.3,
    detail: sma200 != null ? `Kurs ${currentPrice.toFixed(2)} ${currentPrice > sma200 ? ">" : "<"} SMA200 ${sma200.toFixed(2)}` : "SMA200 nicht verfuegbar (< 200 Kerzen)",
  };

  // pullbackRange: Pullback 0.5-1.5 ATR vom Hoch
  const pullbackATR = atr > 0 ? (recentHigh - currentPrice) / atr : 0;
  results.pullbackRange = {
    value: pullbackATR >= 0.5 && pullbackATR <= 1.5,
    confidence: atr > 0 ? 0.85 : 0.3,
    detail: `Pullback ${pullbackATR.toFixed(2)} ATR vom 20-Tage-Hoch (ideal: 0.5–1.5)`,
  };

  // nearEMA20: Nahe EMA20 (innerhalb 2%)
  const distToEma20 = ema20 ? Math.abs(currentPrice - ema20) / ema20 * 100 : 99;
  results.nearEMA20 = {
    value: distToEma20 < 2,
    confidence: ema20 ? 0.9 : 0.3,
    detail: ema20 ? `Abstand zu EMA20: ${distToEma20.toFixed(1)}% (${currentPrice > ema20 ? "darueber" : "darunter"})` : "EMA20 nicht verfuegbar",
  };

  // insideBar: Letzte Kerze innerhalb der vorherigen
  results.insideBar = {
    value: isInsideBar(prev, last),
    confidence: 0.95,
    detail: isInsideBar(prev, last) ? "Inside Bar erkannt (Konsolidierung)" : "Kein Inside Bar",
  };

  // higherLow: Letztes Swing-Low hoeher als vorletztes
  const recentSwingLows = swingLows.slice(-3);
  const hasHigherLow = recentSwingLows.length >= 2 && recentSwingLows[recentSwingLows.length - 1].price > recentSwingLows[recentSwingLows.length - 2].price;
  results.higherLow = {
    value: hasHigherLow,
    confidence: recentSwingLows.length >= 2 ? 0.85 : 0.4,
    detail: hasHigherLow ? "Hoeheres Tief bestätigt" : (recentSwingLows.length < 2 ? "Nicht genug Swing-Tiefs" : "Kein hoeheres Tief"),
  };

  // ema20Reclaim: Kurs hat EMA20 von unten durchbrochen in letzten 3 Bars
  let ema20Reclaim = false;
  if (ema20Arr.length >= 4) {
    for (let i = ema20Arr.length - 3; i < ema20Arr.length; i++) {
      const candleIdx = closes.length - ema20Arr.length + i;
      const prevIdx = candleIdx - 1;
      if (candleIdx > 0 && prevIdx >= 0) {
        const emaVal = ema20Arr[i];
        const emaPrev = ema20Arr[i - 1];
        if (closes[prevIdx] < emaPrev && closes[candleIdx] > emaVal) ema20Reclaim = true;
      }
    }
  }
  results.ema20Reclaim = {
    value: ema20Reclaim,
    confidence: ema20Arr.length >= 4 ? 0.85 : 0.3,
    detail: ema20Reclaim ? "EMA20 von unten durchbrochen" : "Kein EMA20-Reclaim in letzten 3 Kerzen",
  };

  // breakPullbackHigh: Bruch des Pullback-Hochs (letzte Kerze bricht Hoch der letzten 3)
  const prev3High = Math.max(...candles.slice(-4, -1).map(c => c.high));
  results.breakPullbackHigh = {
    value: last.close > prev3High,
    confidence: 0.85,
    detail: last.close > prev3High ? `Close ${last.close.toFixed(2)} > Pullback-Hoch ${prev3High.toFixed(2)}` : `Close ${last.close.toFixed(2)} noch unter Pullback-Hoch ${prev3High.toFixed(2)}`,
  };

  // ════════════════════════════════════════════════════════
  // BREAKOUT Kriterien
  // ════════════════════════════════════════════════════════

  // multipleTests: Mehrere Tests am Widerstand (mind. 2 Swing-Highs in aehnlichem Bereich)
  const recentSwingHighs = swingHighs.slice(-5);
  let testsNearResistance = 0;
  if (recentSwingHighs.length >= 2) {
    const topHigh = Math.max(...recentSwingHighs.map(h => h.price));
    const tolerance = topHigh * 0.02;
    testsNearResistance = recentSwingHighs.filter(h => h.price >= topHigh - tolerance).length;
  }
  results.multipleTests = {
    value: testsNearResistance >= 2,
    confidence: recentSwingHighs.length >= 2 ? 0.8 : 0.3,
    detail: `${testsNearResistance} Tests nahe Widerstand erkannt`,
  };

  // compressionNearHigh: BB Squeeze oder Kurs nahe Hoch
  const isSqueeze = bb && bbPrev && (bb.upper - bb.lower) < (bbPrev.upper - bbPrev.lower) * 0.6;
  const nearHigh = recentHigh > 0 && (recentHigh - currentPrice) / recentHigh < 0.03;
  results.compressionNearHigh = {
    value: isSqueeze || nearHigh,
    confidence: bb ? 0.85 : 0.4,
    detail: isSqueeze ? "Bollinger Squeeze erkannt" : nearHigh ? "Kurs nahe 20-Tage-Hoch (< 3%)" : "Keine Kompression",
  };

  // higherLows (fuer Breakout): Aufsteigende Tiefs in letzten Swing-Lows
  const last3Lows = swingLows.slice(-3);
  const ascendingLows = last3Lows.length >= 2 && last3Lows.every((l, i) => i === 0 || l.price >= last3Lows[i - 1].price);
  results.higherLows = {
    value: ascendingLows,
    confidence: last3Lows.length >= 2 ? 0.8 : 0.3,
    detail: ascendingLows ? "Aufsteigende Tiefs bestaetigt" : "Keine aufsteigenden Tiefs",
  };

  // bigGreenCandle: Letzte Kerze ist grosse gruene Kerze (Body > 1.5x Durchschnitts-Body)
  const avgBody = candles.slice(-20).reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 20;
  const lastBody = last.close - last.open;
  const isBigGreen = lastBody > 0 && lastBody > avgBody * 1.5;
  results.bigGreenCandle = {
    value: isBigGreen,
    confidence: 0.9,
    detail: isBigGreen ? `Grosse gruene Kerze (Body ${lastBody.toFixed(2)} > ${(avgBody * 1.5).toFixed(2)} Schwelle)` : "Keine grosse gruene Kerze",
  };

  // closeNearDayHigh: Close > 90% der Tagesrange
  const dayRange = last.high - last.low;
  const closeRelative = dayRange > 0 ? (last.close - last.low) / dayRange : 0.5;
  results.closeNearDayHigh = {
    value: closeRelative > 0.9,
    confidence: 0.95,
    detail: `Close bei ${(closeRelative * 100).toFixed(0)}% der Tagesrange`,
  };

  // atrIncreasing: ATR nimmt zu (aktuell > 10 Bars ago)
  results.atrIncreasing = {
    value: atr > atr10ago * 1.1,
    confidence: 0.8,
    detail: `ATR aktuell ${atr.toFixed(2)} vs. ${atr10ago.toFixed(2)} vor 10 Bars`,
  };

  // ════════════════════════════════════════════════════════
  // RANGE Kriterien
  // ════════════════════════════════════════════════════════

  // flatSMAs: SMA50/SMA200 Spread < 1.5%
  const smaSpread = sma50 && sma200 ? Math.abs(sma50 - sma200) / sma200 * 100 : (sma50 && ema50 ? Math.abs(sma50 - ema50) / ema50 * 100 : 99);
  results.flatSMAs = {
    value: smaSpread < 1.5,
    confidence: sma50 ? 0.85 : 0.3,
    detail: `SMA-Spread: ${smaSpread.toFixed(1)}% (flach < 1.5%)`,
  };

  // directionChanges: Viele Farbwechsel in letzten 20 Kerzen (>10 = Range)
  let dirChanges = 0;
  const recent20 = candles.slice(-20);
  for (let i = 1; i < recent20.length; i++) {
    const prevGreen = recent20[i - 1].close > recent20[i - 1].open;
    const currGreen = recent20[i].close > recent20[i].open;
    if (prevGreen !== currGreen) dirChanges++;
  }
  results.directionChanges = {
    value: dirChanges >= 10,
    confidence: 0.85,
    detail: `${dirChanges} Farbwechsel in 20 Kerzen (Range-typisch >= 10)`,
  };

  // lowATR: ATR ist niedrig (unter 50% des 60-Tage-Durchschnitts)
  const atr60 = candles.length >= 74 ? calcATR(candles.slice(-74), 60) : atr;
  results.lowATR = {
    value: atr < atr60 * 0.7,
    confidence: 0.8,
    detail: `ATR ${atr.toFixed(2)} vs. 60-Tage-ATR ${atr60.toFixed(2)}`,
  };

  // wicksAtEdges: Lange Dochte an Range-Raendern (mind. 3 in 20 Kerzen)
  const rangeHigh = Math.max(...recent20.map(c => c.high));
  const rangeLow = Math.min(...recent20.map(c => c.low));
  const rangeSize = rangeHigh - rangeLow;
  let wickCount = 0;
  if (rangeSize > 0) {
    for (const c of recent20) {
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const body = Math.abs(c.close - c.open);
      if ((c.high > rangeHigh - rangeSize * 0.15 && upperWick > body) || (c.low < rangeLow + rangeSize * 0.15 && lowerWick > body)) {
        wickCount++;
      }
    }
  }
  results.wicksAtEdges = {
    value: wickCount >= 3,
    confidence: 0.8,
    detail: `${wickCount} Docht-Abweisungen an Range-Raendern`,
  };

  // alternatingColors: Wechselnde Kerzenfarben (> 60% der Kerzen wechseln)
  results.alternatingColors = {
    value: dirChanges / Math.max(1, recent20.length - 1) > 0.6,
    confidence: 0.85,
    detail: `Farbwechsel-Rate: ${((dirChanges / Math.max(1, recent20.length - 1)) * 100).toFixed(0)}%`,
  };

  // nearSupport: Kurs nahe Unterstuetzung (unteres Drittel der Range)
  const nearSupportRange = rangeSize > 0 && (currentPrice - rangeLow) / rangeSize < 0.35;
  results.nearSupport = {
    value: nearSupportRange,
    confidence: rangeSize > 0 ? 0.85 : 0.3,
    detail: nearSupportRange ? `Kurs im unteren Drittel der Range` : `Kurs bei ${rangeSize > 0 ? ((currentPrice - rangeLow) / rangeSize * 100).toFixed(0) : "?"}% der Range`,
  };

  // ════════════════════════════════════════════════════════
  // BOUNCE Kriterien
  // ════════════════════════════════════════════════════════

  // bigDrop: Drop >= 3 ATR vom 20-Tage-Hoch
  results.bigDrop = {
    value: pullbackATR >= 3,
    confidence: atr > 0 ? 0.9 : 0.3,
    detail: `Drop: ${pullbackATR.toFixed(1)} ATR vom Hoch (Bounce-typisch >= 3)`,
  };

  // farBelowEMAs: Kurs weit unter EMA20 und EMA50 (>3%)
  const distEma20Pct = ema20 ? (ema20 - currentPrice) / ema20 * 100 : 0;
  const distEma50Pct = ema50 ? (ema50 - currentPrice) / ema50 * 100 : 0;
  results.farBelowEMAs = {
    value: distEma20Pct > 3 && distEma50Pct > 3,
    confidence: ema20 && ema50 ? 0.9 : 0.3,
    detail: `Unter EMA20: ${distEma20Pct.toFixed(1)}%, unter EMA50: ${distEma50Pct.toFixed(1)}%`,
  };

  // atrRising: ATR stark steigend (Panik-Volatilitaet)
  results.atrRising = {
    value: atr > atr10ago * 1.5,
    confidence: 0.8,
    detail: `ATR-Anstieg: ${atr.toFixed(2)} vs. ${atr10ago.toFixed(2)} (${((atr / Math.max(atr10ago, 0.01) - 1) * 100).toFixed(0)}%)`,
  };

  // bigRedCandles: Mehrere grosse rote Kerzen in letzten 5 Kerzen
  const last5 = candles.slice(-5);
  const bigReds = last5.filter(c => c.close < c.open && Math.abs(c.close - c.open) > avgBody * 1.5).length;
  results.bigRedCandles = {
    value: bigReds >= 2,
    confidence: 0.85,
    detail: `${bigReds} grosse rote Kerzen in letzten 5 Kerzen`,
  };

  // longLowerWicks: Lange untere Dochte in letzten 3 Kerzen (Docht > 2x Body)
  const last3 = candles.slice(-3);
  const longWickCount = last3.filter(c => {
    const body = Math.abs(c.close - c.open) || 0.01;
    const lowerWick = Math.min(c.open, c.close) - c.low;
    return lowerWick > body * 2;
  }).length;
  results.longLowerWicks = {
    value: longWickCount >= 1,
    confidence: 0.9,
    detail: `${longWickCount} Kerze(n) mit langem unteren Docht in letzten 3`,
  };

  // firstGreenReversal: Erste gruene Kerze nach mind. 3 roten
  let consecReds = 0;
  for (let i = candles.length - 2; i >= Math.max(0, candles.length - 6); i--) {
    if (candles[i].close < candles[i].open) consecReds++;
    else break;
  }
  const isFirstGreen = last.close > last.open && consecReds >= 3;
  results.firstGreenReversal = {
    value: isFirstGreen,
    confidence: 0.9,
    detail: isFirstGreen ? `Erste gruene Kerze nach ${consecReds} roten` : `${consecReds} aufeinanderfolgende rote Kerzen`,
  };

  // ════════════════════════════════════════════════════════
  // Leitindex (falls verfuegbar)
  // ════════════════════════════════════════════════════════

  if (indexCandles && indexCandles.length >= 200) {
    const idxCloses = indexCandles.map(c => c.close);
    const idxSma50 = SMA.calculate({ values: idxCloses, period: 50 });
    const idxSma200 = SMA.calculate({ values: idxCloses, period: 200 });
    const idxPrice = idxCloses[idxCloses.length - 1];
    const ma50 = idxSma50[idxSma50.length - 1];
    const ma200 = idxSma200[idxSma200.length - 1];
    results.indexAboveMAs = {
      value: idxPrice > ma50 && idxPrice > ma200,
      confidence: 0.9,
      detail: `Index: ${idxPrice.toFixed(0)} | 50-MA: ${ma50.toFixed(0)} | 200-MA: ${ma200.toFixed(0)}`,
    };
  }

  return results;
}
