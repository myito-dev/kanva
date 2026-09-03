"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
  type ScriptableContext,
  type Plugin,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import type { ChartSuggestion } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler, Tooltip);

// Single accent hue — one series per chart, so color encodes nothing beyond
// "this is data"; identity comes from axis labels, not per-bar color.
const SERIES_COLOR = "#2a78d6";
const GRID_COLOR = "rgba(23, 23, 42, 0.07)";
const TICK_COLOR = "#8a8a99";

const numberFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function barGradient(color: string) {
  return (ctx: ScriptableContext<"bar">) => {
    const { chartArea, ctx: canvasCtx } = ctx.chart;
    if (!chartArea) return hexToRgba(color, 0.85);
    const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, hexToRgba(color, 0.55));
    gradient.addColorStop(1, hexToRgba(color, 0.95));
    return gradient;
  };
}

function lineAreaGradient(color: string) {
  return (ctx: ScriptableContext<"line">) => {
    const { chartArea, ctx: canvasCtx } = ctx.chart;
    if (!chartArea) return hexToRgba(color, 0.12);
    const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, hexToRgba(color, 0.3));
    gradient.addColorStop(1, hexToRgba(color, 0.01));
    return gradient;
  };
}

// Dashed vertical guide at the hovered point — the "hover crosshair" layer
// line/area charts should ship by default (dataviz skill, interaction.md).
const crosshairPlugin: Plugin<"line"> = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const active = chart.getActiveElements();
    if (!active.length) return;
    const { ctx: canvasCtx, chartArea } = chart;
    const x = active[0].element.x;
    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.moveTo(x, chartArea.top);
    canvasCtx.lineTo(x, chartArea.bottom);
    canvasCtx.lineWidth = 1;
    canvasCtx.strokeStyle = "rgba(23, 23, 42, 0.18)";
    canvasCtx.setLineDash([4, 4]);
    canvasCtx.stroke();
    canvasCtx.restore();
  },
};

const sharedScales: ChartOptions<"bar" | "line">["scales"] = {
  x: {
    grid: { display: false },
    border: { display: false },
    ticks: { color: TICK_COLOR, font: { size: 11 } },
  },
  y: {
    grid: { color: GRID_COLOR },
    border: { display: false },
    ticks: { color: TICK_COLOR, font: { size: 11 }, callback: (value) => numberFormat.format(Number(value)) },
    beginAtZero: true,
  },
};

const sharedPlugins: ChartOptions<"bar" | "line">["plugins"] = {
  legend: { display: false },
  tooltip: {
    backgroundColor: "#17172a",
    padding: 10,
    cornerRadius: 10,
    displayColors: false,
    titleFont: { size: 11, weight: "normal" },
    titleColor: "rgba(255,255,255,0.7)",
    bodyFont: { size: 13, weight: "bold" },
    callbacks: {
      label: (ctx) => numberFormat.format(ctx.parsed.y ?? 0),
    },
  },
};

const animation: ChartOptions<"bar" | "line">["animation"] = {
  duration: 650,
  easing: "easeOutQuart",
};

export function MiniChart({ chart, color = SERIES_COLOR }: { chart: ChartSuggestion; color?: string }) {
  const labels = chart.points.map((p) => p.label);
  const values = chart.points.map((p) => Math.round(p.value * 100) / 100);

  return chart.kind === "bar" ? (
    <Bar
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: barGradient(color),
            hoverBackgroundColor: hexToRgba(color, 1),
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.85,
            categoryPercentage: 0.7,
          },
        ],
      }}
      options={
        {
          responsive: true,
          maintainAspectRatio: false,
          animation,
          plugins: sharedPlugins,
          scales: sharedScales,
        } as ChartOptions<"bar">
      }
    />
  ) : (
    <Line
      data={{
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            backgroundColor: lineAreaGradient(color),
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHitRadius: 16,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: "#ffffff",
            pointHoverBorderColor: color,
            pointHoverBorderWidth: 3,
          },
        ],
      }}
      options={
        {
          responsive: true,
          maintainAspectRatio: false,
          animation,
          interaction: { mode: "index", intersect: false },
          plugins: sharedPlugins,
          scales: sharedScales,
        } as ChartOptions<"line">
      }
      plugins={[crosshairPlugin]}
    />
  );
}

function ChartCard({ chart }: { chart: ChartSuggestion }) {
  return (
    <div className="card p-5">
      <p className="mb-3 text-sm text-ink-muted">{chart.title}</p>
      <div className="h-64">
        <MiniChart chart={chart} />
      </div>
    </div>
  );
}

export function AnalysisCharts({ charts }: { charts: ChartSuggestion[] }) {
  if (charts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {charts.map((chart) => (
        <ChartCard key={chart.id} chart={chart} />
      ))}
    </div>
  );
}
