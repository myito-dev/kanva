import "server-only";
import { z } from "zod";
import { analyzeLocal, computeCharts, computeKpis } from "./localAnalysis";
import type { DatasetAnalysis, DatasetProfile, DatasetRow } from "./types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// Aliases that Google keeps pointed at current models, so the app doesn't break
// when a pinned version is retired. Flash-Lite goes first: on the free tier it
// answers in seconds while Flash is often overloaded. Override with GEMINI_MODEL.
const DEFAULT_MODEL = "gemini-flash-lite-latest";
// Tried in order when a model times out, is overloaded (5xx), rate-limited
// (429) or retired (404). A different Lite generation doesn't share the first
// model's load, and Flash is the last resort.
const BACKUP_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest"];
const REQUEST_TIMEOUT_MS = 15_000;

/** Thrown when the AI mode can't run; the message is shown to the user and
 * the caller falls back to the local analysis. */
export class AiUnavailableError extends Error {}

const aggregationSchema = z.enum(["sum", "avg", "count", "min", "max"]);

// The model only proposes *what* to compute (columns + aggregation) plus
// narrative text. Every number shown is then computed by Kanva from the rows,
// so the model can't put an invented figure on a KPI or a chart.
const aiResponseSchema = z.object({
  summary: z.string(),
  kpis: z.array(z.object({ label: z.string(), column: z.string().nullable(), aggregation: aggregationSchema })),
  charts: z.array(
    z.object({ title: z.string(), x: z.string(), y: z.string().nullable(), aggregation: aggregationSchema })
  ),
  insights: z.array(z.object({ text: z.string(), tone: z.enum(["info", "positive", "warning"]) })),
});

const SYSTEM_PROMPT = `Eres un analista de inteligencia de negocios. Recibes el perfil de un conjunto de datos tabular (columnas, tipos inferidos, porcentaje de vacíos, valores únicos y algunos ejemplos) y propones cómo resumirlo en un tablero. Responde únicamente con JSON en español con esta forma:
{
  "summary": "2 o 3 oraciones que describan qué parece contener el conjunto de datos",
  "kpis": [{ "label": "nombre corto del indicador", "column": "columna numérica o null para contar filas", "aggregation": "sum | avg | count | min | max" }],
  "charts": [{ "title": "título de la gráfica", "x": "columna de fecha o categoría", "y": "columna numérica o null para contar registros", "aggregation": "sum | avg | count | min | max" }],
  "insights": [{ "text": "hallazgo o recomendación", "tone": "info | positive | warning" }]
}
Reglas: usa solo nombres de columna que aparezcan en el perfil, escritos exactamente igual. Propón de 2 a 4 KPIs, de 2 a 4 gráficas y de 2 a 4 hallazgos. Los hallazgos deben basarse en el perfil (calidad de datos, tipos, cardinalidad, columnas útiles para analizar); no inventes cifras que no estén en el perfil.`;

function friendlyHttpError(status: number): string {
  if (status === 429) return "Se alcanzó el límite de uso gratuito de Gemini. Se aplicó el análisis local.";
  if (status === 400 || status === 401 || status === 403) return "La clave de Gemini no es válida o no tiene permisos. Se aplicó el análisis local.";
  if (status === 503) return "Gemini está saturado en este momento. Se aplicó el análisis local.";
  return `Gemini respondió con un error (${status}). Se aplicó el análisis local.`;
}

async function callGemini(profile: DatasetProfile): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError("El modo IA no está configurado (falta GEMINI_API_KEY). Se aplicó el análisis local.");
  }
  const primaryModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const models = [primaryModel, ...BACKUP_MODELS.filter((m) => m !== primaryModel)];

  let response: Response | null = null;
  let failure = "No se pudo conectar con Gemini. Se aplicó el análisis local.";
  for (const model of models) {
    try {
      response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: `Perfil del conjunto de datos:\n${JSON.stringify(profile)}` }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Timeout or network error: try the next model.
      response = null;
      failure = "Gemini no respondió a tiempo. Se aplicó el análisis local.";
      continue;
    }
    if (response.ok) break;
    failure = friendlyHttpError(response.status);
    // A bad key or request fails the same way on every model; the rest may not.
    if ([400, 401, 403].includes(response.status)) break;
  }

  if (!response || !response.ok) throw new AiUnavailableError(failure);

  const data = await response.json();
  const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new AiUnavailableError("Gemini no devolvió contenido. Se aplicó el análisis local.");

  try {
    return JSON.parse(text);
  } catch {
    throw new AiUnavailableError("Gemini devolvió una respuesta con formato inválido. Se aplicó el análisis local.");
  }
}

export async function analyzeWithAi(profile: DatasetProfile, rows: DatasetRow[]): Promise<DatasetAnalysis> {
  const parsed = aiResponseSchema.safeParse(await callGemini(profile));
  if (!parsed.success) {
    throw new AiUnavailableError("Gemini devolvió una respuesta incompleta. Se aplicó el análisis local.");
  }
  const ai = parsed.data;

  // Specs naming unknown or unsuitable columns are dropped; if nothing usable
  // is left for a section, that section falls back to the local rules.
  const local = analyzeLocal(profile, rows);
  const kpis = computeKpis(profile, rows, ai.kpis);
  const charts = computeCharts(profile, rows, ai.charts);
  const insights = ai.insights.filter((i) => i.text.trim() !== "").slice(0, 4);

  return {
    summary: ai.summary.trim() || undefined,
    kpis: kpis.length > 0 ? kpis : local.kpis,
    charts: charts.length > 0 ? charts : local.charts,
    insights: insights.length > 0 ? insights : local.insights,
  };
}
