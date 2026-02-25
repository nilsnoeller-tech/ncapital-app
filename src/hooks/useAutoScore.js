// ─── Auto-Score Hook (Merkmalliste v2) ───
// Laedt Marktdaten und berechnet Merkmalliste-Ergebnisse fuer alle autoKeys.

import { useState, useCallback } from "react";
import { fetchOHLCV, fetchIndexData } from "../services/marketData";
import { evaluateMerkmalliste } from "../services/indicators";

/**
 * @returns {{
 *   merkmalResults: Object|null,  // { [autoKey]: { value, confidence, detail } }
 *   loading: boolean,
 *   error: string|null,
 *   dataTimestamp: Date|null,
 *   staleData: boolean,
 *   marketData: Object|null,
 *   computeAutoScores: (symbol: string, currency: string, entryPrice: number) => Promise<void>,
 *   resetAutoScores: () => void
 * }}
 */
export function useAutoScore() {
  const [merkmalResults, setMerkmalResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataTimestamp, setDataTimestamp] = useState(null);
  const [staleData, setStaleData] = useState(false);
  const [marketData, setMarketData] = useState(null);

  const computeAutoScores = useCallback(async (symbol, currency, entryPrice) => {
    if (!symbol || !entryPrice) {
      setError("Symbol und Einstiegskurs erforderlich");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Yahoo-Ticker fuer europaeische Aktien anpassen
      let yahooSymbol = symbol.toUpperCase();
      const addedDE = currency === "EUR" && !yahooSymbol.includes(".");
      if (addedDE) {
        yahooSymbol = `${yahooSymbol}.DE`;
      }

      // Index-Daten parallel starten
      const indexPromise = fetchIndexData(currency);

      // Symbol-Daten laden — bei EUR mit .DE Fallback auf reines Symbol
      let symbolResult;
      try {
        symbolResult = await fetchOHLCV(yahooSymbol, "1y", "1d");
      } catch (deError) {
        if (addedDE) {
          yahooSymbol = symbol.toUpperCase();
          symbolResult = await fetchOHLCV(yahooSymbol, "1y", "1d");
        } else {
          throw deError;
        }
      }

      const indexResult = await indexPromise;

      const { candles } = symbolResult;
      const indexCandles = indexResult.candles;

      if (!candles || candles.length < 30) {
        throw new Error(
          `Nur ${candles?.length || 0} Kerzen fuer ${yahooSymbol} — mindestens 30 noetig`
        );
      }

      // Stale-Status pruefen
      const isStale = symbolResult.stale || indexResult.stale;
      setStaleData(isStale);

      // Merkmalliste auswerten
      const results = evaluateMerkmalliste(candles, entryPrice, indexCandles);

      setMerkmalResults(results);
      setMarketData({
        symbol: yahooSymbol,
        candles: candles.length,
        lastPrice: candles[candles.length - 1]?.close,
        lastDate: candles[candles.length - 1]?.date,
        currency: symbolResult.meta?.currency,
        indexName: indexResult.indexName,
        indexPrice: indexCandles[indexCandles.length - 1]?.close,
      });
      setDataTimestamp(new Date());
    } catch (err) {
      console.error("Auto-Score Fehler:", err);
      setError(err.message || "Unbekannter Fehler");
      setMerkmalResults(null);
      setMarketData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetAutoScores = useCallback(() => {
    setMerkmalResults(null);
    setError(null);
    setDataTimestamp(null);
    setStaleData(false);
    setMarketData(null);
  }, []);

  return {
    merkmalResults,
    loading,
    error,
    dataTimestamp,
    staleData,
    marketData,
    computeAutoScores,
    resetAutoScores,
  };
}
