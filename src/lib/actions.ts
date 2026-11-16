"use server";

import { parseCsv, parseExcel } from "./parseFile";
import { profileDataset } from "./dataProfiler";
import { analyzeLocal } from "./localAnalysis";
import { AiUnavailableError, analyzeWithAi } from "./aiAnalysis";
import type { AnalysisSource, AnalyzeError, AnalyzeResult, DatasetAnalysis } from "./types";

const MAX_SIZE = 12 * 1024 * 1024; // 12 MB — matches the original CanvasMetrics limit.
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const PREVIEW_ROW_LIMIT = 300;

export async function analyzeDataset(formData: FormData): Promise<AnalyzeResult | AnalyzeError> {
  const file = formData.get("dataset");
  const mode = formData.get("mode") === "local" ? "local" : "ai";

  if (!(file instanceof File) || file.size === 0) {
    return { error: "No se recibió ningún archivo." };
  }

  if (file.size > MAX_SIZE) {
    return { error: "El archivo excede el tamaño máximo permitido (12 MB)." };
  }

  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: "Formato no soportado. Usa un archivo CSV o Excel (.xlsx/.xls)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows;
  try {
    rows = ext === ".csv" ? parseCsv(buffer) : parseExcel(buffer);
  } catch {
    return { error: "No se pudo leer el archivo. Verifica que no esté dañado o mal formateado." };
  }

  if (rows.length === 0) {
    return { error: "El archivo no contiene filas de datos utilizables." };
  }

  const profile = profileDataset(rows);

  let analysis: DatasetAnalysis;
  let analysisSource: AnalysisSource = "local";
  let aiWarning: string | undefined;

  if (mode === "ai") {
    try {
      analysis = await analyzeWithAi(profile, rows);
      analysisSource = "ai";
    } catch (err) {
      // The AI mode never blocks the user: any failure degrades to local rules.
      if (!(err instanceof AiUnavailableError)) console.error("Fallo inesperado en el análisis con IA:", err);
      analysis = analyzeLocal(profile, rows);
      analysisSource = "local_fallback";
      aiWarning = err instanceof AiUnavailableError ? err.message : "No se pudo completar el análisis con IA. Se aplicó el análisis local.";
    }
  } else {
    analysis = analyzeLocal(profile, rows);
  }

  return {
    id: crypto.randomUUID(),
    profile,
    previewRows: rows.slice(0, PREVIEW_ROW_LIMIT),
    fileName: file.name,
    analysis,
    analysisSource,
    aiWarning,
  };
}
