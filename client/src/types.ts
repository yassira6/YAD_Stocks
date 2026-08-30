export interface Company {
  code: string;
  nameEn: string;
  // Dynamically-discovered companies (looked up by a raw code that wasn't in
  // the curated starter directory) come from Yahoo's metadata, which has no
  // Arabic name or sector — those fields are null until manually corrected.
  nameAr: string | null;
  sectorEn: string | null;
  sectorAr: string | null;
  market: "TASI" | "US";
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
  priceTargets?: {
    fairValue: number;
    targetBuy: number;
    targetSell: number;
    fairValuePct: number;
    targetBuyPct: number;
    targetSellPct: number;
  } | null;
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
  market: "TASI" | "US";
  currency: string;
  exchangeName: string;
  regularMarketPrice: number;
  previousClose: number;
  regularMarketTime: number;
  series: Bar[];
  analysis: Analysis;
  dataSource: "live" | "demo";
  liveError: string | null;
  marketOpen: boolean;
  marketCloseReason: "weekend" | "after_hours" | "holiday" | null;
}

export type AlertDirection = "buy" | "sell";
export type AlertStatus = "active" | "triggered" | "cancelled";

export interface PriceAlert {
  id: string;
  code: string;
  email: string;
  direction: AlertDirection;
  targetPrice: number;
  lang: "en" | "ar";
  status: AlertStatus;
  createdAt: number;
  triggeredAt: number | null;
  triggeredPrice: number | null;
  lastCheckedAt: number | null;
  emailSent: boolean | null;
  emailError: string | null;
  pushEnabled: boolean;
  pushSent: boolean | null;
  pushError: string | null;
  userEmail?: string;
  userName?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: "google" | "apple";
  isAdmin: boolean;
  createdAt: number;
  lastLoginAt: number;
}

export interface AdminStatus {
  smtpConfigured: boolean;
  googleConfigured: boolean;
  appleConfigured: boolean;
  pushConfigured: boolean;
  totalUsers: number;
  totalAlerts: number;
  totalCompanies: number;
  priceSource: string;
  marketOpen: boolean;
  tasiMarketOpen: boolean;
  usMarketOpen: boolean;
  signalSubscribers: { email: number; push: number };
}

export interface SignalSubscription {
  emailEnabled: boolean;
  pushEnabled: boolean;
  lang: "en" | "ar";
  hasPushRegistration: boolean;
  pushConfigured: boolean;
}

export interface CompanySignal {
  code: string;
  nameEn: string | null;
  nameAr: string | null;
  lastVerdict: Verdict | null;
  lastScore: number | null;
  lastNotifiedVerdict: Verdict | null;
  lastNotifiedAt: number | null;
  updatedAt: number;
}
