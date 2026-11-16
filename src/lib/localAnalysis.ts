import { parseNumber, toIsoDate } from "./parseValue";
import type {
  Aggregation,
  ChartSpec,
  ChartSuggestion,
  ColumnProfile,
  DatasetAnalysis,
  DatasetProfile,
  DatasetRow,
  Insight,
  Kpi,
  KpiSpec,
} from "./types";

const MAX_BAR_CATEGORIES = 8;
const MAX_TIME_POINTS = 24;
export const MAX_CHARTS = 4;
export const MAX_KPIS = 4;

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);
}

function numericColumns(columns: ColumnProfile[]): ColumnProfile[] {
  return columns.filter((c) => c.type === "number");
}

function aggregate(values: number[], aggregation: Aggregation): number {
  if (aggregation === "count") return values.length;
  if (values.length === 0) return 0;
  if (aggregation === "min") return Math.min(...values);
  if (aggregation === "max") return Math.max(...values);
  const sum = values.reduce((s, v) => s + v, 0);
  return aggregation === "avg" ? sum / values.length : sum;
}

/** Numbers in `column` for every row; with no column, a 1 per row (so
 * "count" counts rows). */
function columnValues(rows: DatasetRow[], column: string | null): number[] {
  if (!column) return rows.map(() => 1);
  return rows.map((r) => parseNumber(r[column] ?? "")).filter((v): v is number => v !== null);
}

/** Returns null when the spec references a column the dataset doesn't have
 * or can't aggregate numerically. */
export function computeKpi(profile: DatasetProfile, rows: DatasetRow[], spec: KpiSpec): Kpi | null {
  if (spec.column) {
    const col = profile.columns.find((c) => c.name === spec.column);
    if (!col || (col.type !== "number" && spec.aggregation !== "count")) return null;
  }
  const values = columnValues(rows, spec.column);
  if (values.length === 0) return null;
  return { label: spec.label, value: formatNumber(aggregate(values, spec.aggregation)) };
}

function groupValues(rows: DatasetRow[], keyOf: (row: DatasetRow) => string | null, yCol: string | null) {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const n = yCol ? parseNumber(row[yCol] ?? "") : 1;
    if (n === null) continue;
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }
  return groups;
}

function aggregateByCategory(rows: DatasetRow[], xCol: string, yCol: string | null, aggregation: Aggregation): ChartSuggestion["points"] {
  const groups = groupValues(rows, (row) => (row[xCol] ?? "").trim() || null, yCol);
  const entries = Array.from(groups.entries())
    .map(([label, values]) => ({ label, value: aggregate(values, aggregation) }))
    .sort((a, b) => b.value - a.value);

  if (entries.length <= MAX_BAR_CATEGORIES) return entries;

  // Only additive aggregations can fold the tail into "Otros"; for avg/min/max
  // a combined bar would be meaningless, so the tail is just left out.
  if (aggregation !== "sum" && aggregation !== "count") return entries.slice(0, MAX_BAR_CATEGORIES);

  const top = entries.slice(0, MAX_BAR_CATEGORIES - 1);
  const otrosValue = entries.slice(MAX_BAR_CATEGORIES - 1).reduce((s, e) => s + e.value, 0);
  return [...top, { label: "Otros", value: otrosValue }];
}

function aggregateByDate(rows: DatasetRow[], dateCol: string, yCol: string | null, aggregation: Aggregation): ChartSuggestion["points"] {
  const toPoints = (groups: Map<string, number[]>) =>
    Array.from(groups.entries())
      .map(([label, values]) => ({ label, value: aggregate(values, aggregation) }))
      .sort((a, b) => a.label.localeCompare(b.label));

  // Dates are normalized to YYYY-MM-DD so they sort chronologically and the
  // monthly roll-up below can just take the YYYY-MM prefix.
  const daily = toPoints(groupValues(rows, (row) => toIsoDate(row[dateCol] ?? ""), yCol));
  if (daily.length <= MAX_TIME_POINTS) return daily;
  return toPoints(groupValues(rows, (row) => toIsoDate(row[dateCol] ?? "")?.slice(0, 7) ?? null, yCol));
}

/** Date x-axes become line charts, anything else a bar chart. Returns null
 * for specs that reference unknown or unsuitable columns, or that produce
 * fewer than two points. */
export function computeChart(profile: DatasetProfile, rows: DatasetRow[], spec: ChartSpec): ChartSuggestion | null {
  const xCol = profile.columns.find((c) => c.name === spec.x);
  if (!xCol || xCol.type === "number") return null;
  if (spec.y && profile.columns.find((c) => c.name === spec.y)?.type !== "number") return null;

  const aggregation = spec.y ? spec.aggregation : "count";
  const isTime = xCol.type === "date";
  const points = isTime
    ? aggregateByDate(rows, xCol.name, spec.y, aggregation)
    : aggregateByCategory(rows, xCol.name, spec.y, aggregation);
  if (points.length < 2) return null;

  return {
    id: `${isTime ? "line" : "bar"}-${xCol.name}-${spec.y ?? "count"}-${aggregation}`,
    kind: isTime ? "line" : "bar",
    title: spec.title,
    aggregation,
    points,
  };
}

function localKpiSpecs(profile: DatasetProfile): KpiSpec[] {
  const specs: KpiSpec[] = [{ label: "Filas analizadas", column: null, aggregation: "count" }];
  for (const col of numericColumns(profile.columns).slice(0, 2)) {
    specs.push({ label: `Total ${col.name}`, column: col.name, aggregation: "sum" });
    specs.push({ label: `Promedio ${col.name}`, column: col.name, aggregation: "avg" });
  }
  return specs;
}

function localChartSpecs(profile: DatasetProfile): ChartSpec[] {
  const specs: ChartSpec[] = [];
  const primaryNumeric = numericColumns(profile.columns)[0]?.name ?? null;

  const dateCol = profile.columns.find((c) => c.type === "date");
  if (dateCol && primaryNumeric) {
    specs.push({
      title: `${primaryNumeric} a lo largo del tiempo (${dateCol.name})`,
      x: dateCol.name,
      y: primaryNumeric,
      aggregation: "sum",
    });
  }

  const categoryColumns = profile.columns.filter((c) => c.type === "category" && c.uniqueValues > 1 && c.uniqueValues <= 40);
  for (const col of categoryColumns) {
    specs.push({
      title: primaryNumeric ? `${primaryNumeric} por ${col.name}` : `Registros por ${col.name}`,
      x: col.name,
      y: primaryNumeric,
      aggregation: primaryNumeric ? "sum" : "count",
    });
  }

  return specs;
}

export function buildLocalInsights(profile: DatasetProfile, rows: DatasetRow[]): Insight[] {
  const insights: Insight[] = [];

  const nullHeavy = profile.columns.filter((c) => c.nullRatio > 0.2).sort((a, b) => b.nullRatio - a.nullRatio);
  for (const col of nullHeavy.slice(0, 2)) {
    insights.push({
      text: `"${col.name}" tiene ${Math.round(col.nullRatio * 100)}% de valores vacíos — revisa si conviene completarla o excluirla del análisis.`,
      tone: "warning",
    });
  }

  const categoryColumns = profile.columns.filter((c) => c.type === "category" && c.uniqueValues > 1);
  for (const col of categoryColumns.slice(0, 2)) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const v = (row[col.name] ?? "").trim();
      if (v === "") continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((s, v) => s + v, 0);
    if (total === 0) continue;
    const [topValue, topCount] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    const share = topCount / total;
    if (share >= 0.4) {
      insights.push({
        text: `En "${col.name}", "${topValue}" representa el ${Math.round(share * 100)}% de los registros.`,
        tone: "positive",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({ text: "No se detectaron valores faltantes ni categorías dominantes — los datos se ven balanceados.", tone: "info" });
  }

  return insights.slice(0, 4);
}

export function computeKpis(profile: DatasetProfile, rows: DatasetRow[], specs: KpiSpec[]): Kpi[] {
  return specs
    .map((spec) => computeKpi(profile, rows, spec))
    .filter((k): k is Kpi => k !== null)
    .slice(0, MAX_KPIS);
}

export function computeCharts(profile: DatasetProfile, rows: DatasetRow[], specs: ChartSpec[]): ChartSuggestion[] {
  const charts: ChartSuggestion[] = [];
  for (const spec of specs) {
    if (charts.length >= MAX_CHARTS) break;
    const chart = computeChart(profile, rows, spec);
    if (chart && !charts.some((c) => c.id === chart.id)) charts.push(chart);
  }
  return charts;
}

export function analyzeLocal(profile: DatasetProfile, rows: DatasetRow[]): DatasetAnalysis {
  return {
    kpis: computeKpis(profile, rows, localKpiSpecs(profile)),
    insights: buildLocalInsights(profile, rows),
    charts: computeCharts(profile, rows, localChartSpecs(profile)),
  };
}
