import type { ChartSuggestion, ColumnProfile, DatasetProfile, DatasetRow, Insight, Kpi, LocalAnalysis } from "./types";

const MAX_BAR_CATEGORIES = 8;
const MAX_TIME_POINTS = 24;
const MAX_CHARTS = 4;

function toNumber(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);
}

function numericColumns(columns: ColumnProfile[]): ColumnProfile[] {
  return columns.filter((c) => c.type === "number");
}

function buildKpis(profile: DatasetProfile, rows: DatasetRow[]): Kpi[] {
  const kpis: Kpi[] = [{ label: "Filas analizadas", value: formatNumber(profile.rowCount) }];

  for (const col of numericColumns(profile.columns).slice(0, 2)) {
    const values = rows.map((r) => toNumber(r[col.name] ?? "")).filter((v): v is number => v !== null);
    if (values.length === 0) continue;
    const sum = values.reduce((s, v) => s + v, 0);
    kpis.push({ label: `Total ${col.name}`, value: formatNumber(sum) });
    kpis.push({ label: `Promedio ${col.name}`, value: formatNumber(sum / values.length) });
  }

  return kpis.slice(0, 4);
}

function buildInsights(profile: DatasetProfile, rows: DatasetRow[]): Insight[] {
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

function aggregateByCategory(rows: DatasetRow[], categoryCol: string, numericCol: string | null): ChartSuggestion["points"] {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const key = (row[categoryCol] ?? "").trim();
    if (key === "") continue;
    const entry = sums.get(key) ?? { sum: 0, count: 0 };
    const n = numericCol ? toNumber(row[numericCol] ?? "") : 1;
    entry.sum += n ?? 0;
    entry.count += 1;
    sums.set(key, entry);
  }

  const entries = Array.from(sums.entries())
    .map(([label, { sum }]) => ({ label, value: sum }))
    .sort((a, b) => b.value - a.value);

  if (entries.length <= MAX_BAR_CATEGORIES) return entries;

  const top = entries.slice(0, MAX_BAR_CATEGORIES - 1);
  const rest = entries.slice(MAX_BAR_CATEGORIES - 1);
  const otrosValue = rest.reduce((s, e) => s + e.value, 0);
  return [...top, { label: "Otros", value: otrosValue }];
}

function aggregateByDate(rows: DatasetRow[], dateCol: string, numericCol: string): ChartSuggestion["points"] {
  const dailySums = new Map<string, number>();
  for (const row of rows) {
    const key = (row[dateCol] ?? "").trim();
    const n = toNumber(row[numericCol] ?? "");
    if (key === "" || n === null) continue;
    dailySums.set(key, (dailySums.get(key) ?? 0) + n);
  }

  let entries = Array.from(dailySums.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (entries.length > MAX_TIME_POINTS) {
    const monthlySums = new Map<string, number>();
    for (const row of rows) {
      const key = (row[dateCol] ?? "").trim().slice(0, 7); // YYYY-MM
      const n = toNumber(row[numericCol] ?? "");
      if (key === "" || n === null) continue;
      monthlySums.set(key, (monthlySums.get(key) ?? 0) + n);
    }
    entries = Array.from(monthlySums.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return entries;
}

function buildCharts(profile: DatasetProfile, rows: DatasetRow[]): ChartSuggestion[] {
  const charts: ChartSuggestion[] = [];
  const numeric = numericColumns(profile.columns);
  const primaryNumeric = numeric[0]?.name ?? null;

  const dateCol = profile.columns.find((c) => c.type === "date");
  if (dateCol && primaryNumeric) {
    const points = aggregateByDate(rows, dateCol.name, primaryNumeric);
    if (points.length >= 2) {
      charts.push({
        id: `line-${dateCol.name}`,
        kind: "line",
        title: `${primaryNumeric} a lo largo del tiempo (${dateCol.name})`,
        aggregation: "sum",
        points,
      });
    }
  }

  const categoryColumns = profile.columns.filter((c) => c.type === "category" && c.uniqueValues > 1 && c.uniqueValues <= 40);
  for (const col of categoryColumns) {
    if (charts.length >= MAX_CHARTS) break;
    const points = aggregateByCategory(rows, col.name, primaryNumeric);
    if (points.length < 2) continue;
    charts.push({
      id: `bar-${col.name}`,
      kind: "bar",
      title: primaryNumeric ? `${primaryNumeric} por ${col.name}` : `Registros por ${col.name}`,
      aggregation: primaryNumeric ? "sum" : "count",
      points,
    });
  }

  return charts.slice(0, MAX_CHARTS);
}

export function analyzeLocal(profile: DatasetProfile, rows: DatasetRow[]): LocalAnalysis {
  return {
    kpis: buildKpis(profile, rows),
    insights: buildInsights(profile, rows),
    charts: buildCharts(profile, rows),
  };
}
