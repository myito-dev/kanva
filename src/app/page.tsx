"use client";

import { useState, useTransition, type DragEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { analyzeDataset } from "@/lib/actions";
import { AnalysisCharts } from "@/components/AnalysisCharts";
import { useDataset } from "@/lib/datasetStore";
import type { InsightTone } from "@/lib/types";

const INSIGHT_TONE_CLASS: Record<InsightTone, string> = {
  info: "bg-ink-muted",
  positive: "bg-positive",
  warning: "bg-warning",
};

const TYPE_LABELS: Record<string, string> = {
  boolean: "Booleano",
  number: "Número",
  date: "Fecha",
  category: "Categoría",
  text: "Texto",
};

type TileTone = "mint" | "pink" | "violet" | "yellow";

function RowsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
function ColumnsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
      <line x1="7" y1="4" x2="7" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="17" y1="4" x2="17" y2="20" />
    </svg>
  );
}
function HashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
      <line x1="5" y1="9" x2="19" y2="9" />
      <line x1="5" y1="15" x2="19" y2="15" />
      <line x1="10" y1="4" x2="8" y2="20" />
      <line x1="16" y1="4" x2="14" y2="20" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12.5l2.2 2.2L16 9.5" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function UploadCloudIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 17.3 8.02 4 4 0 0 1 17 16" />
      <path d="M12 12v8" />
      <path d="M9 15l3-3 3 3" />
    </svg>
  );
}

function StatTile({ tone, icon, label, value }: { tone: TileTone; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={`tile-${tone} flex items-center gap-3 rounded-2xl p-4`}>
      <div className={`tile-badge-${tone} flex h-9 w-9 shrink-0 items-center justify-center rounded-xl`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-ink-secondary">{label}</p>
        <p className="tabular truncate text-lg font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { result, setResult } = useDataset();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);

  function submitFile(file: File) {
    setError(null);
    const formData = new FormData();
    formData.set("dataset", file);
    startTransition(async () => {
      const response = await analyzeDataset(formData);
      if ("error" in response) {
        setError(response.error);
        setResult(null);
      } else {
        setResult(response);
      }
    });
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) submitFile(file);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submitFile(file);
  }

  const qualityPct = result
    ? Math.round(
        (1 - result.profile.columns.reduce((s, c) => s + c.nullRatio, 0) / (result.profile.columns.length || 1)) * 100
      )
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <input id="dataset-input" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onInputChange} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Kanva</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Análisis</h1>
        <p className="text-sm text-ink-secondary">Sube un archivo CSV o Excel para obtener un perfil y análisis de tus datos.</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card border border-negative/30 bg-negative/5 p-4 text-sm text-negative"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <label
          htmlFor="dataset-input"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`card flex min-h-[420px] cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed p-10 text-center transition-colors ${
            dragActive ? "border-accent bg-accent/5" : "border-hairline"
          }`}
        >
          {pending ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                className="h-10 w-10 rounded-full border-2 border-accent border-t-transparent"
              />
              <p className="text-sm font-medium text-ink-secondary">Analizando tu archivo…</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <UploadCloudIcon />
              </div>
              <div>
                <p className="text-base font-semibold text-ink">Arrastra tu archivo aquí</p>
                <p className="text-sm text-ink-secondary">o haz clic para seleccionarlo de tu equipo</p>
              </div>
              <p className="pill border border-hairline bg-page px-3 py-1 text-xs text-ink-muted">CSV, XLSX o XLS · máximo 12 MB</p>
            </>
          )}
        </label>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm text-ink-muted">Archivo</p>
                <p className="font-semibold text-ink">{result.fileName}</p>
              </div>
              <label
                htmlFor="dataset-input"
                className="pill cursor-pointer border border-hairline bg-page px-4 py-2 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-accent"
              >
                {pending ? "Analizando…" : "Cambiar archivo"}
              </label>
              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile tone="mint" icon={<RowsIcon />} label="Filas" value={String(result.profile.rowCount)} />
                <StatTile tone="pink" icon={<ColumnsIcon />} label="Columnas" value={String(result.profile.columnCount)} />
                <StatTile
                  tone="violet"
                  icon={<HashIcon />}
                  label="Numéricas"
                  value={String(result.profile.columns.filter((c) => c.type === "number").length)}
                />
                <StatTile tone="yellow" icon={<CheckIcon />} label="Calidad promedio" value={`${qualityPct}%`} />
              </div>
            </div>

            {(result.analysis.kpis.length > 0 || result.analysis.insights.length > 0) && (
              <div id="hallazgos" className="grid scroll-mt-28 grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="card grid grid-cols-2 gap-4 p-5 lg:col-span-1">
                  {result.analysis.kpis.map((kpi) => (
                    <div key={kpi.label}>
                      <p className="text-xs text-ink-muted">{kpi.label}</p>
                      <p className="tabular text-lg font-bold text-ink">{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="card space-y-3 p-5 lg:col-span-2">
                  <p className="text-sm text-ink-muted">Hallazgos</p>
                  <ul className="space-y-2.5">
                    {result.analysis.insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-ink">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${INSIGHT_TONE_CLASS[insight.tone]}`} />
                        {insight.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {result.analysis.charts.length > 0 && (
              <div id="graficas" className="scroll-mt-28">
                <AnalysisCharts charts={result.analysis.charts} />
              </div>
            )}

            <div id="columnas" className="card scroll-mt-28 overflow-x-auto p-5">
              <p className="mb-3 text-sm text-ink-muted">Columnas detectadas</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs text-ink-muted">
                    <th className="pb-2 pr-4">Columna</th>
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Nulos</th>
                    <th className="pb-2 pr-4">Únicos</th>
                    <th className="pb-2">Ejemplos</th>
                  </tr>
                </thead>
                <tbody>
                  {result.profile.columns.map((col) => (
                    <tr key={col.name} className="border-b border-hairline/60">
                      <td className="py-2 pr-4 font-medium text-ink">{col.name}</td>
                      <td className="py-2 pr-4">
                        <span className="pill bg-page px-2 py-0.5 text-xs text-ink-secondary">{TYPE_LABELS[col.type]}</span>
                      </td>
                      <td className="tabular py-2 pr-4 text-ink-secondary">{Math.round(col.nullRatio * 100)}%</td>
                      <td className="tabular py-2 pr-4 text-ink-secondary">{col.uniqueValues}</td>
                      <td className="truncate py-2 text-xs text-ink-muted">{col.sampleValues.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div id="vista-previa" className="card scroll-mt-28 overflow-x-auto p-5">
              <p className="mb-3 text-sm text-ink-muted">
                Vista previa ({Math.min(result.previewRows.length, 20)} de {result.profile.rowCount} filas)
              </p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted">
                    {result.profile.columns.map((col) => (
                      <th key={col.name} className="whitespace-nowrap py-2 pr-4">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.previewRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-hairline/60">
                      {result.profile.columns.map((col) => (
                        <td key={col.name} className="whitespace-nowrap py-1.5 pr-4 text-ink-secondary">
                          {row[col.name]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
