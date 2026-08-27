import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
} from "lightweight-charts";
import { useLanguage } from "../i18n/LanguageContext";
import { useTheme } from "../lib/ThemeContext";
import type { Bar } from "../types";

// Candlestick charts are read chronologically left-to-right even in RTL apps
// (standard convention on Arabic trading platforms too), so the chart canvas
// itself is always forced to ltr regardless of the app's current direction.

interface Props {
  series: Bar[];
}

// The user asked to see "the chart for the last month" — the backend fetches a
// longer history so indicators (SMA50, MFI, CMF...) are statistically sound,
// this component slices that down to the requested last-month view.
function lastMonth(bars: Bar[]): Bar[] {
  if (bars.length === 0) return bars;
  const lastTime = bars[bars.length - 1].time;
  const cutoff = lastTime - 32 * 24 * 60 * 60;
  return bars.filter((b) => b.time >= cutoff);
}

// lightweight-charts renders to a <canvas>, so it needs real color values up
// front — it can't pick up a CSS custom property the way Tailwind utility
// classes do, hence a small light/dark palette here kept in sync by hand
// with the ink-* tokens in index.css.
const CHART_PALETTE = {
  dark: {
    text: "#a9b4d0",
    grid: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.08)",
  },
  light: {
    text: "#5b6b85",
    grid: "rgba(16,25,43,0.06)",
    border: "rgba(16,25,43,0.12)",
  },
};

export function PriceChart({ series }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const palette = CHART_PALETTE[theme];

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: palette.text,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#f43f5e",
      priceScaleId: "right",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.25 },
    });

    const bars = lastMonth(series);
    candleSeries.setData(
      bars.map((b) => ({ time: b.time as never, open: b.open, high: b.high, low: b.low, close: b.close }))
    );
    volumeSeries.setData(
      bars.map((b) => ({
        time: b.time as never,
        value: b.volume,
        color: b.close >= b.open ? "rgba(34,197,94,0.5)" : "rgba(244,63,94,0.5)",
      }))
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, theme]);

  return (
    <div className="rounded-3xl border border-ink-700 bg-ink-900 p-4 shadow-xl shadow-black/20 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-ink-100">{t.chartTitle}</h3>
        <p className="text-xs text-ink-300">{t.chartSubtitle}</p>
      </div>
      <div ref={containerRef} dir="ltr" className="chart-container h-[280px] w-full sm:h-[360px]" />
    </div>
  );
}
