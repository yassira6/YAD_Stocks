export interface Company {
  code: string;
  nameEn: string;
  nameAr: string;
  sectorEn: string;
  sectorAr: string;
}

export interface Bar {
  date: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Verdict = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

export interface Reason {
  signal: number;
  weight: number;
  en: string;
  ar: string;
}

export interface Analysis {
  insufficientData: boolean;
  barsAvailable?: number;
  score?: number;
  verdict?: Verdict;
  verdictLabel?: { en: string; ar: string };
  price?: number;
  reasons?: Reason[];
  latest?: {
    sma20: number | null;
    sma50: number | null;
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
    bollingerMid: number | null;
    obv: number | null;
    cmf20: number | null;
    mfi14: number | null;
    adLine: number | null;
  };
  moneyFlow?: {
    cmf20: number | null;
    mfi14: number | null;
    obvTrendUp: boolean;
    accumulationDays: number;
    distributionDays: number;
    avgVolume20: number | null;
    lastVolume: number;
    note: { en: string; ar: string };
  };
}

export interface QuoteResponse {
  symbol: string;
  code: string;
  currency: string;
  exchangeName: string;
  regularMarketPrice: number;
  previousClose: number;
  regularMarketTime: number;
  series: Bar[];
  analysis: Analysis;
  dataSource: "live" | "demo";
  liveError: string | null;
}
