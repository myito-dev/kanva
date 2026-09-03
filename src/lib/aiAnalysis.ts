import "server-only";
import { z } from "zod";
import { aggregateByCategory, aggregateByDate, formatNumber, toNumber } from "./localAnalysis";
import type { Analysis, ChartSuggestion, DatasetProfile, DatasetRow, Kpi } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MAX_CHARTS = 4;

const AiResponseSchema = z.object({
  insights: z
    .array(z.object({ text: z.string().min(1).max(220), tone: z.enum(["info", "positive", "warning"]) }))
    .max(4),
  kpiColumns: z.array(z.string()).max(2),
  chartColumns: z.array(z.object({ column: z.string(), kind: z.enum(["bar", "line"]) })).max(MAX_CHARTS),
});

/** Column-level summary sent to the model instead of raw rows: keeps the
 * payload small and avoids sending the business's row-level data to a
 * third-party API — only aggregated shape and a few sample values. */
function buildProfileSummary(profile: DatasetProfile, rows: DatasetRow[]): string {
  const columns = profile.columns.map((col) => {
    const base = {
      nombre: col.name,
      tipo: col.type,
      porcentajeNulos: Math.round(col.nullRatio * 100),
      valoresUnicos: col.uniqueValues,
      ejemplos: col.sampleValues,
    };

    if (col.type === "number") {
      const values = rows.map((r) => toNumber(r[col.name] ?? "")).filter((v): v is number => v !== null);
      if (values.length > 0) {
        const sum = values.reduce((s, v) => s + v, 0);
        return { ...base, suma: sum, promedio: sum / values.length, min: Math.min(...values), max: Math.max(...values) };
      }
    }

    if (col.type === "category") {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const v = (row[col.name] ?? "").trim();
        if (v === "") continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label, count }));
      return { ...base, categoriasMasFrecuentes: top };
    }

    return base;
  });

  return JSON.stringify({ filas: profile.rowCount, columnas: profile.columnCount, detalleColumnas: columns });
}

const SYSTEM_PROMPT =
  "Eres un analista de datos que revisa el perfil (resumen agregado, no las filas crudas) de un archivo CSV/Excel cargado por un usuario de negocio y respondes ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma: " +
  '{"insights": [{"text": string en español, breve y accionable, "tone": "info"|"positive"|"warning"}], ' +
  '"kpiColumns": [nombres de columnas numéricas relevantes para mostrar como KPI, máximo 2], ' +
  '"chartColumns": [{"column": nombre de columna existente, "kind": "bar" para columnas de categoría o "line" solo para columnas de fecha}, máximo 4]}. ' +
  "Usa únicamente nombres de columna que existan en el resumen recibido. No inventes cifras: los insights deben describir tendencias o hallazgos cualitativos, no inventar números que no estén en el resumen.";

/** AI-assisted mode runs on Google Gemini (generativelanguage.googleapis.com):
 * it has a free usage tier, unlike OpenAI, which keeps the project runnable
 * without incurring cost for this prototype. */
async function callGemini(summary: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada en el servidor.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: summary }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini respondió con estado ${response.status}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof content !== "string") throw new Error("Respuesta de Gemini sin contenido utilizable.");

    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

function buildKpisFromColumns(columnNames: string[], profile: DatasetProfile, rows: DatasetRow[]): Kpi[] {
  const kpis: Kpi[] = [{ label: "Filas analizadas", value: formatNumber(profile.rowCount) }];
  const numericNames = new Set(profile.columns.filter((c) => c.type === "number").map((c) => c.name));

  for (const name of columnNames) {
    if (!numericNames.has(name)) continue;
    const values = rows.map((r) => toNumber(r[name] ?? "")).filter((v): v is number => v !== null);
    if (values.length === 0) continue;
    const sum = values.reduce((s, v) => s + v, 0);
    kpis.push({ label: `Total ${name}`, value: formatNumber(sum) });
    kpis.push({ label: `Promedio ${name}`, value: formatNumber(sum / values.length) });
  }

  return kpis.slice(0, 5);
}

function buildChartsFromColumns(
  picks: { column: string; kind: "bar" | "line" }[],
  profile: DatasetProfile,
  rows: DatasetRow[]
): ChartSuggestion[] {
  const columnsByName = new Map(profile.columns.map((c) => [c.name, c]));
  const primaryNumeric = profile.columns.find((c) => c.type === "number")?.name ?? null;
  const charts: ChartSuggestion[] = [];

  for (const pick of picks) {
    if (charts.length >= MAX_CHARTS) break;
    const col = columnsByName.get(pick.column);
    if (!col) continue;

    if (pick.kind === "line" && col.type === "date" && primaryNumeric) {
      const points = aggregateByDate(rows, col.name, primaryNumeric);
      if (points.length >= 2) {
        charts.push({ id: `ai-line-${col.name}`, kind: "line", title: `${primaryNumeric} a lo largo del tiempo (${col.name})`, aggregation: "sum", points });
      }
    } else if (col.type === "category") {
      const points = aggregateByCategory(rows, col.name, primaryNumeric);
      if (points.length >= 2) {
        charts.push({
          id: `ai-bar-${col.name}`,
          kind: "bar",
          title: primaryNumeric ? `${primaryNumeric} por ${col.name}` : `Registros por ${col.name}`,
          aggregation: primaryNumeric ? "sum" : "count",
          points,
        });
      }
    }
  }

  return charts;
}

/** AI-assisted mode (RF08/RF09): the model only chooses which columns matter
 * and writes qualitative insights — the actual KPI and chart numbers are
 * always computed locally with the same deterministic aggregation used by
 * the local mode, so the AI can never fabricate a figure. */
export async function analyzeWithAI(profile: DatasetProfile, rows: DatasetRow[]): Promise<Analysis> {
  const summary = buildProfileSummary(profile, rows);
  const raw = await callGemini(summary);
  const parsed = AiResponseSchema.parse(raw);

  const validColumns = new Set(profile.columns.map((c) => c.name));
  const kpiColumns = parsed.kpiColumns.filter((name) => validColumns.has(name));
  const chartColumns = parsed.chartColumns.filter((pick) => validColumns.has(pick.column));

  const kpis = buildKpisFromColumns(kpiColumns, profile, rows);
  const charts = buildChartsFromColumns(chartColumns, profile, rows);
  const insights = parsed.insights.length > 0 ? parsed.insights : [{ text: "El modelo no encontró hallazgos destacables en este archivo.", tone: "info" as const }];

  return { source: "ai", kpis, insights, charts };
}
