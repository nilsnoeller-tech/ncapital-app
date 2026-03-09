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

// ─── Composite Score (Frontend-Version, synchron mit worker.js computeCompositeScore) ───
// Base: Trend(D×1.0+W×0.7+M×0.3) + RSI(±2) + MACD(±1.5) + MA(±1.5) + Volume(±0.5) + Breakout(0..1)
// Enhanced: + StochRSI + Structure + Pullback + Buyer - Distribution

export function computeCompositeScoreFrontend(candles) {
  if (!candles || candles.length < 60) return null;

  const closes = candles.map(c => c.close);
  const price = closes[closes.length - 1];
  const last = candles[candles.length - 1];

  // ── Indikatoren ──
  const ema20Arr = EMA.calculate({ values: closes, period: 20 });
  const sma20Arr = SMA.calculate({ values: closes, period: 20 });
  const sma50Arr = SMA.calculate({ values: closes, period: 50 });
  const sma200Arr = closes.length >= 200 ? SMA.calculate({ values: closes, period: 200 }) : [];
  const rsiArr = RSI.calculate({ values: closes, period: 14 });

  const e20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : price;
  const sma20 = sma20Arr.length > 0 ? sma20Arr[sma20Arr.length - 1] : price;
  const sma50 = sma50Arr.length > 0 ? sma50Arr[sma50Arr.length - 1] : price;
  const sma200 = sma200Arr.length > 0 ? sma200Arr[sma200Arr.length - 1] : null;
  const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;
  const atr = calcATR(candles, 14);

  // MACD (12, 26, 9)
  const ema12 = EMA.calculate({ values: closes, period: 12 });
  const ema26 = EMA.calculate({ values: closes, period: 26 });
  const macdLine = [];
  const offset = ema12.length - ema26.length;
  for (let i = 0; i < ema26.length; i++) macdLine.push(ema12[i + offset] - ema26[i]);
  const signalLine = macdLine.length >= 9 ? EMA.calculate({ values: macdLine, period: 9 }) : [];
  const histOffset = macdLine.length - signalLine.length;
  const macdHist = signalLine.map((s, i) => macdLine[i + histOffset] - s);

  // Bollinger Bands
  const bbArr = closes.length >= 20 ? BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 }) : [];
  let bbSqueeze = false, bbRelPos = null;
  if (bbArr.length >= 20) {
    const bb = bbArr[bbArr.length - 1];
    const bw = bb.upper - bb.lower;
    const recentBW = bbArr.slice(-Math.min(50, bbArr.length)).map(b => b.upper - b.lower);
    const avgBW = recentBW.reduce((s, v) => s + v, 0) / recentBW.length;
    bbSqueeze = bw < avgBW * 0.75;
    bbRelPos = bw > 0 ? (price - bb.lower) / bw : 0.5;
  }

  // Volume (5d trend + OBV)
  const last5 = candles.slice(-5), prev5 = candles.slice(-10, -5);
  const avg5vol = last5.reduce((s, c) => s + c.volume, 0) / 5;
  const avgPrev5vol = prev5.length > 0 ? prev5.reduce((s, c) => s + c.volume, 0) / prev5.length : avg5vol;
  const vol5dTrend = avgPrev5vol > 0 ? (avg5vol - avgPrev5vol) / avgPrev5vol : 0;
  const last5green = last5.filter(c => c.close >= c.open).length;
  const lastIsRed = last.close < last.open;
  const avgVol20 = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const volRatio = avgVol20 > 0 ? last.volume / avgVol20 : 1;

  // OBV rising (simplified)
  let obvRising = false;
  if (candles.length >= 20) {
    let obv = 0;
    const obvArr = candles.slice(-30).map(c => { obv += c.close >= c.open ? c.volume : -c.volume; return obv; });
    if (obvArr.length >= 10) {
      const obvEma = EMA.calculate({ values: obvArr, period: 10 });
      if (obvEma.length >= 2) obvRising = obvEma[obvEma.length - 1] > obvEma[obvEma.length - 2];
    }
  }

  // RSI Bullish Divergence
  let rsiBullDiv = false;
  if (rsiArr.length >= 30 && closes.length >= 40) {
    const rsiOff = closes.length - rsiArr.length;
    let minP20 = Infinity, rsiMin20 = 50;
    for (let i = closes.length - 20; i < closes.length; i++) {
      if (closes[i] < minP20) { minP20 = closes[i]; const ri = i - rsiOff; if (ri >= 0 && ri < rsiArr.length) rsiMin20 = rsiArr[ri]; }
    }
    let minP40 = Infinity, rsiMin40 = 50;
    for (let i = Math.max(0, closes.length - 40); i < closes.length - 15; i++) {
      if (closes[i] < minP40) { minP40 = closes[i]; const ri = i - rsiOff; if (ri >= 0 && ri < rsiArr.length) rsiMin40 = rsiArr[ri]; }
    }
    if (minP20 <= minP40 * 1.02 && rsiMin20 > rsiMin40 + 3) rsiBullDiv = true;
  }

  // StochRSI (simplified: RSI of RSI over 14 periods, smoothed)
  let stochOversold = false, stochBullish = false;
  if (rsiArr.length >= 20) {
    const r14 = rsiArr.slice(-14);
    const minR = Math.min(...r14), maxR = Math.max(...r14);
    const stochNow = maxR > minR ? ((rsi - minR) / (maxR - minR)) * 100 : 50;
    const r14prev = rsiArr.slice(-15, -1);
    const minRp = Math.min(...r14prev), maxRp = Math.max(...r14prev);
    const stochPrev = maxRp > minRp ? ((rsiArr[rsiArr.length - 2] - minRp) / (maxRp - minRp)) * 100 : 50;
    stochOversold = stochNow < 25;
    stochBullish = stochNow > stochPrev && stochPrev < 30;
  }

  // HH/HL + Higher Low
  const swingHighs = [], swingLows = [];
  const lb = Math.min(candles.length, 120);
  const rc = candles.slice(-lb);
  for (let i = 3; i < rc.length - 3; i++) {
    if (rc[i].high >= rc[i-1].high && rc[i].high >= rc[i-2].high && rc[i].high >= rc[i-3].high && rc[i].high >= rc[i+1].high && rc[i].high >= rc[i+2].high && rc[i].high >= rc[i+3].high) swingHighs.push(rc[i].high);
    if (rc[i].low <= rc[i-1].low && rc[i].low <= rc[i-2].low && rc[i].low <= rc[i-3].low && rc[i].low <= rc[i+1].low && rc[i].low <= rc[i+2].low && rc[i].low <= rc[i+3].low) swingLows.push(rc[i].low);
  }
  const hhhl = swingHighs.length >= 2 && swingLows.length >= 2 && swingHighs[swingHighs.length - 1] > swingHighs[swingHighs.length - 2] && swingLows[swingLows.length - 1] > swingLows[swingLows.length - 2];
  const higherLow = swingLows.length >= 2 && swingLows[swingLows.length - 1] > swingLows[swingLows.length - 2];

  // Pullback volume declining
  const last5Down = candles.slice(-10).filter(c => c.close < c.open).slice(-5);
  const pullbackVolDeclining = last5Down.length >= 3 && last5Down[last5Down.length - 1].volume < last5Down[0].volume * 0.8;

  // Support confluence
  const distToEma20 = Math.abs(price - e20) / e20 * 100;
  const priceAboveEma20 = price > e20;
  let confluence = 0;
  if (distToEma20 < 2 && priceAboveEma20) confluence++;
  const distToSma50 = Math.abs(price - sma50) / sma50 * 100;
  if (distToSma50 < 3 && price > sma50) confluence++;

  // Close near day high
  const dayRange = last.high - last.low;
  const closeNearDayHigh = dayRange > 0 ? (last.close - last.low) / dayRange > 0.90 : false;

  // Distribution / Selling pressure
  const lastBodySize = Math.abs(last.close - last.open);
  const sellingPressure = lastIsRed && volRatio >= 1.2 && lastBodySize > (atr || price * 0.02) * 0.8;
  const heavySelling = lastIsRed && volRatio >= 1.8 && lastBodySize > atr;
  const last3 = candles.slice(-3);
  const redHighVolCount = last3.filter(c => c.close < c.open && avgVol20 > 0 && c.volume > avgVol20 * 1.2).length;
  const distributionPattern = redHighVolCount >= 2;

  // ═══════════════════════════════════════════════════════════
  // 1. TREND (Daily×1.0 + Weekly×0.7 + Monthly×0.3, max ±4.0)
  // ═══════════════════════════════════════════════════════════
  let dailyTrend = 0;
  if (sma20Arr.length >= 2) {
    const sma20Slope = (sma20 - sma20Arr[sma20Arr.length - 2]) / sma20Arr[sma20Arr.length - 2] * 100;
    if (price > sma20 && sma20 > sma50 && (sma200 ? sma50 > sma200 : true) && sma20Slope > 0.3) dailyTrend = 2;
    else if (price > (sma200 || sma50) && sma20Slope >= 0) dailyTrend = 1;
    else if (price < sma50 && price < sma20 && sma20 < sma50 && sma20Slope < -0.3) dailyTrend = -2;
    else if (price < (sma200 || sma50)) dailyTrend = -1;
  }

  let weeklyTrend = 0;
  if (sma200 && closes.length >= 60) {
    const sma50arr10ago = SMA.calculate({ values: closes.slice(0, -10), period: 50 });
    const sma50slope = sma50arr10ago.length > 0 ? (sma50 - sma50arr10ago[sma50arr10ago.length - 1]) / sma50arr10ago[sma50arr10ago.length - 1] * 100 : 0;
    if (sma50 > sma200 && sma50slope > 0.2) weeklyTrend = 2;
    else if (sma50 > sma200) weeklyTrend = 1;
    else if (sma50 < sma200 && sma50slope < -0.2) weeklyTrend = -2;
    else if (sma50 < sma200) weeklyTrend = -1;
  } else {
    weeklyTrend = dailyTrend > 0 ? 1 : dailyTrend < 0 ? -1 : 0;
  }

  let monthlyTrend = 0;
  if (sma200 && closes.length >= 220) {
    const sma200arr20ago = SMA.calculate({ values: closes.slice(0, -20), period: 200 });
    const sma200slope = sma200arr20ago.length > 0 ? (sma200 - sma200arr20ago[sma200arr20ago.length - 1]) / sma200arr20ago[sma200arr20ago.length - 1] * 100 : 0;
    if (price > sma200 && sma200slope > 0.1) monthlyTrend = 2;
    else if (price > sma200) monthlyTrend = 1;
    else if (price < sma200 && sma200slope < -0.1) monthlyTrend = -2;
    else if (price < sma200) monthlyTrend = -1;
  } else {
    monthlyTrend = weeklyTrend;
  }

  const trendScore = Math.round((dailyTrend * 1.0 + weeklyTrend * 0.7 + monthlyTrend * 0.3) * 10) / 10;

  // ═══════════════════════════════════════════════════════════
  // 2. RSI (±2.0) — with uptrend modifiers + divergence bonus
  // ═══════════════════════════════════════════════════════════
  let rsiScore = 0;
  if (rsi < 30 && trendScore > 0) rsiScore = 2.0;
  else if (rsi < 30) rsiScore = 1.5;
  else if (rsi < 40 && trendScore > 0) rsiScore = 1.0;
  else if (rsi < 40) rsiScore = 0.5;
  else if (rsi > 80) rsiScore = -1.0;
  else if (rsi > 70) rsiScore = -0.5;
  else if (rsi > 60) rsiScore = -0.2;
  if (rsiBullDiv) rsiScore += 1.0;
  rsiScore = Math.max(-2.0, Math.min(2.0, rsiScore));

  // ═══════════════════════════════════════════════════════════
  // 3. MACD Histogram (±1.5) — graduated + crossover bonus
  // ═══════════════════════════════════════════════════════════
  let macdScore = 0;
  if (macdHist.length > 0) {
    const lastH = macdHist[macdHist.length - 1];
    const prevH = macdHist.length > 1 ? macdHist[macdHist.length - 2] : 0;
    const histRising = lastH > prevH;
    if (lastH > 0 && histRising) macdScore = 1.5;
    else if (lastH > 0) macdScore = 0.5;
    else if (lastH < 0 && histRising) macdScore = -0.3;
    else if (lastH < 0) macdScore = -1.5;
    if (macdHist.length >= 3 && macdHist[macdHist.length - 3] < 0 && lastH > 0) macdScore = Math.min(macdScore + 0.5, 1.5);
  }

  // ═══════════════════════════════════════════════════════════
  // 4. MA Alignment (±1.5) — using EMA20 for faster response
  // ═══════════════════════════════════════════════════════════
  let maScore = 0;
  if (sma200) {
    if (price > e20 && e20 > sma50 && sma50 > sma200) maScore = 1.5;
    else if (price < e20 && e20 < sma50 && sma50 < sma200) maScore = -1.5;
    else if (price > sma200) maScore = 0.5;
    else if (price < sma200) maScore = -0.5;
  } else {
    if (price > e20 && e20 > sma50) maScore = 1.0;
    else if (price < e20 && e20 < sma50) maScore = -1.0;
    else if (price > sma50) maScore = 0.3;
    else maScore = -0.3;
  }

  // ═══════════════════════════════════════════════════════════
  // 5. Volume (±0.5) — 5d trend + OBV
  // ═══════════════════════════════════════════════════════════
  let volumeScore = 0;
  if (vol5dTrend > 0.2 && last5green >= 3) volumeScore = 0.5;
  else if (vol5dTrend > 0.2 && last5green < 2) volumeScore = -0.5;
  if (obvRising && last5green >= 3) volumeScore = Math.min(volumeScore + 0.2, 0.5);

  // ═══════════════════════════════════════════════════════════
  // 6. Breakout Proximity (0 to +1.0) — 52w/20d high + BB squeeze
  // ═══════════════════════════════════════════════════════════
  let breakoutScore = 0;
  {
    const high20d = Math.max(...closes.slice(-20));
    const high52w = Math.max(...closes);
    if ((high52w - price) / high52w * 100 < 2) breakoutScore += 0.5;
    if ((high20d - price) / high20d * 100 < 1) breakoutScore += 0.5;
    if (bbSqueeze && bbRelPos != null && bbRelPos > 0.5) breakoutScore += 0.3;
    breakoutScore = Math.min(1.0, breakoutScore);
  }

  // ═══════════════════════════════════════════════════════════
  // COMPOSITE (BASE) SCORE
  // ═══════════════════════════════════════════════════════════
  const compositeScore = Math.round((trendScore + rsiScore + macdScore + maScore + volumeScore + breakoutScore) * 10) / 10;

  // ═══════════════════════════════════════════════════════════
  // ENHANCED SCORE — additional quality signals
  // ═══════════════════════════════════════════════════════════
  let stochBonus = 0;
  if (stochOversold && trendScore > 0) stochBonus = 0.5;
  else if (stochBullish && trendScore > 0) stochBonus = 0.3;

  let structureBonus = 0;
  if (hhhl && higherLow) structureBonus = 0.5;
  else if (higherLow) structureBonus = 0.3;

  let pullbackBonus = 0;
  if (pullbackVolDeclining && trendScore > 0) pullbackBonus += 0.2;
  if (confluence >= 2) pullbackBonus += 0.1;

  const buyerBonus = closeNearDayHigh ? 0.2 : 0;

  let distPenalty = 0;
  if (distributionPattern || heavySelling) distPenalty = -0.5;
  else if (sellingPressure) distPenalty = -0.3;

  const enhancedBonus = Math.round((stochBonus + structureBonus + pullbackBonus + buyerBonus + distPenalty) * 10) / 10;
  const enhancedScore = Math.round((compositeScore + enhancedBonus) * 10) / 10;

  // ═══════════════════════════════════════════════════════════
  // CONFIDENCE
  // ═══════════════════════════════════════════════════════════
  let confidence;
  if (compositeScore >= 5) confidence = "STRONG BUY";
  else if (compositeScore >= 2) confidence = "BUY";
  else if (compositeScore >= -2) confidence = "NEUTRAL";
  else if (compositeScore >= -5) confidence = "SELL";
  else confidence = "STRONG SELL";

  return {
    compositeScore,
    enhancedScore,
    enhancedBonus,
    confidence,
    breakdown: {
      trend: { score: trendScore, max: 4, detail: `Daily ${dailyTrend > 0 ? "+" : ""}${dailyTrend} \u00D7 1.0, Weekly ${weeklyTrend > 0 ? "+" : ""}${weeklyTrend} \u00D7 0.7, Monthly ${monthlyTrend > 0 ? "+" : ""}${monthlyTrend} \u00D7 0.3` },
      rsi: { score: rsiScore, max: 2, detail: `RSI ${rsi.toFixed(1)}${rsiBullDiv ? " + Divergenz" : ""}` },
      macd: { score: macdScore, max: 1.5, detail: `MACD Histogramm ${macdHist.length > 0 ? (macdHist[macdHist.length - 1] > 0 ? "positiv" : "negativ") : "n/a"}${macdHist.length > 0 ? (macdHist[macdHist.length - 1] > (macdHist.length > 1 ? macdHist[macdHist.length - 2] : 0) ? " + steigend" : " + fallend") : ""}` },
      ma: { score: maScore, max: 1.5, detail: `EMA20 ${e20.toFixed(0)}, SMA50 ${sma50.toFixed(0)}${sma200 ? ", SMA200 " + sma200.toFixed(0) : ""}` },
      volume: { score: volumeScore, max: 0.5, detail: `5d-Trend ${(vol5dTrend * 100).toFixed(0)}%, ${last5green}/5 gruen${obvRising ? ", OBV steigend" : ""}` },
      breakout: { score: breakoutScore, max: 1, detail: `${breakoutScore > 0 ? "Nahe Hoch" : "Kein Breakout"}${bbSqueeze ? " + BB Squeeze" : ""}` },
    },
    enhanced: {
      bonus: enhancedBonus,
      stoch: { score: stochBonus, detail: stochOversold ? "Ueberverkauft" : stochBullish ? "Dreht auf" : "Neutral" },
      structure: { score: structureBonus, detail: hhhl ? "HH/HL" : higherLow ? "Higher Low" : "Keine Struktur" },
      pullback: { score: pullbackBonus, detail: `${pullbackVolDeclining ? "Vol sinkt" : ""}${confluence >= 2 ? " + Konfluenz" : ""}`.trim() || "Kein Signal" },
      buyer: { score: buyerBonus, detail: closeNearDayHigh ? "Close nahe Tageshoch" : "Neutral" },
      distribution: { score: distPenalty, detail: distributionPattern ? "Distribution" : heavySelling ? "Starker Abverkauf" : sellingPressure ? "Verkaufsdruck" : "Kein Signal" },
    },
    indicators: { rsi, e20, sma20, sma50, sma200, price, volRatio, atr },
  };
}
