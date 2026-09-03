"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDataset } from "@/lib/datasetStore";
import { BoardWidgetFrame } from "@/components/BoardWidgetFrame";
import { MiniChart } from "@/components/AnalysisCharts";
import { ColorPicker } from "@/components/ColorPicker";
import { exportBoardToPdf } from "@/lib/exportPdf";
import type { BoardState, BoardWidget } from "@/lib/types";

const STORAGE_KEY = "kanva:board";
const DEFAULT_BACKGROUND = "#f7f7fbff";
const DEFAULT_SIZE = { kpi: { w: 220, h: 110 }, chart: { w: 420, h: 280 }, text: { w: 260, h: 100 } };
const GRID_STEP = 24;

function nextPosition(count: number) {
  const step = 32;
  const cols = 4;
  return { x: 24 + (count % cols) * step, y: 24 + Math.floor(count / cols) * step };
}

function defaultTitle(widget: BoardWidget): string {
  if (widget.content.kind === "kpi") return widget.content.kpi.label;
  if (widget.content.kind === "chart") return widget.content.chart.title;
  return "Nota";
}

function loadBoard(): BoardState {
  if (typeof window === "undefined") return { background: DEFAULT_BACKGROUND, widgets: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { background: DEFAULT_BACKGROUND, widgets: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<BoardState>;
    return { background: parsed.background ?? DEFAULT_BACKGROUND, widgets: parsed.widgets ?? [] };
  } catch {
    return { background: DEFAULT_BACKGROUND, widgets: [] };
  }
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="5" cy="5" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="19" cy="5" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="19" r="1" />
      <circle cx="12" cy="19" r="1" />
      <circle cx="19" cy="19" r="1" />
    </svg>
  );
}

export default function TableroPage() {
  const { result } = useDataset();
  const [board, setBoard] = useState<BoardState>(loadBoard);
  const [grid, setGrid] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const { background, widgets } = board;
  const selected = widgets.find((w) => w.id === selectedId) ?? null;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  }, [board]);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [addMenuOpen]);

  function setWidgets(fn: (prev: BoardWidget[]) => BoardWidget[]) {
    setBoard((prev) => ({ ...prev, widgets: fn(prev.widgets) }));
  }

  function setBackground(hex: string) {
    setBoard((prev) => ({ ...prev, background: hex }));
  }

  function addWidget(content: BoardWidget["content"]) {
    const size = DEFAULT_SIZE[content.kind];
    const pos = nextPosition(widgets.length);
    const id = crypto.randomUUID();
    setWidgets((prev) => [...prev, { id, ...pos, ...size, content }]);
    setSelectedId(id);
    setAddMenuOpen(false);
  }

  function updateWidget(id: string, next: Partial<BoardWidget>) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...next } : w)));
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function handleExport() {
    if (!result) return;
    const base = result.fileName.replace(/\.[^./]+$/, "");
    exportBoardToPdf(widgets, background, `Tablero - ${base}.pdf`);
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-lg font-semibold text-ink">Aún no hay datos para armar un tablero</p>
          <p className="text-sm text-ink-secondary">Analiza un archivo primero y vuelve aquí para componer tu tablero.</p>
          <Link href="/" className="pill mt-2 bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
            Ir a Análisis
          </Link>
        </div>
      </div>
    );
  }

  const boardHeight = Math.max(700, ...widgets.map((w) => w.y + w.h + 40), 700);
  const chartContent = selected?.content.kind === "chart" ? selected.content : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Kanva</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Tablero</h1>
        <p className="text-sm text-ink-secondary">
          Arrastra, redimensiona y personaliza los elementos para armar tu dashboard con los datos de {result.fileName}.
        </p>
      </div>

      {/* Barra de herramientas: agrupada por sección, siempre visible, como una barra de Office. */}
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
        <div ref={addMenuRef} className="relative flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Agregar</span>
          <button
            onClick={() => setAddMenuOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              addMenuOpen ? "border-accent bg-accent/10 text-accent" : "border-hairline bg-surface text-ink-secondary hover:border-accent"
            }`}
          >
            <PlusIcon /> Elemento
          </button>
          {addMenuOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-64 space-y-3 rounded-xl border border-hairline bg-surface p-3 shadow-lg">
              {result.analysis.kpis.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">KPIs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analysis.kpis.map((kpi) => (
                      <button
                        key={kpi.label}
                        onClick={() => addWidget({ kind: "kpi", kpi })}
                        className="pill border border-hairline bg-page px-2.5 py-1 text-xs font-medium text-ink-secondary hover:border-accent hover:text-accent"
                      >
                        {kpi.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {result.analysis.charts.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Gráficas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.analysis.charts.map((chart) => (
                      <button
                        key={chart.id}
                        onClick={() => addWidget({ kind: "chart", chart })}
                        className="pill border border-hairline bg-page px-2.5 py-1 text-xs font-medium text-ink-secondary hover:border-accent hover:text-accent"
                      >
                        {chart.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Otros</p>
                <button
                  onClick={() => addWidget({ kind: "text", text: "Escribe una nota…" })}
                  className="pill w-full border border-hairline bg-page px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:border-accent hover:text-accent"
                >
                  + Nota de texto
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-hairline" />

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Lienzo</span>
          <ColorPicker value={background} onChange={setBackground} label="Fondo" />
          <button
            onClick={() => setGrid((g) => !g)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              grid ? "border-accent bg-accent/10 text-accent" : "border-hairline bg-surface text-ink-secondary hover:border-accent"
            }`}
          >
            <GridIcon /> Cuadrícula
          </button>
        </div>

        {selected && (
          <>
            <div className="h-8 w-px bg-hairline" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Selección</span>
              <input
                type="text"
                value={selected.title ?? defaultTitle(selected)}
                onChange={(e) => updateWidget(selected.id, { title: e.target.value })}
                className="w-40 rounded-lg border border-hairline bg-page px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
              <ColorPicker
                value={selected.background ?? "#ffffffff"}
                onChange={(hex) => updateWidget(selected.id, { background: hex })}
                label="Fondo"
              />
              {chartContent && (
                <ColorPicker
                  value={chartContent.accentColor ?? "#2a78d6ff"}
                  onChange={(hex) => updateWidget(selected.id, { content: { ...chartContent, accentColor: hex } })}
                  label="Color de gráfica"
                />
              )}
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:text-negative"
                aria-label="Cerrar selección"
              >
                ✕
              </button>
            </div>
          </>
        )}

        <div className="ml-auto">
          <button
            onClick={handleExport}
            disabled={widgets.length === 0}
            className="pill bg-accent px-4 py-2 text-xs font-semibold text-accent-ink shadow-sm disabled:opacity-40"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="card relative overflow-auto" style={{ height: Math.min(boardHeight, 900) }}>
        <div
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
          className={`relative ${grid ? "board-grid" : ""}`}
          style={{ height: boardHeight, minWidth: 900, background }}
        >
          {widgets.length === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
              Usa los botones de arriba para agregar KPIs, gráficas o notas al tablero.
            </p>
          )}
          {widgets.map((widget) => {
            const isText = widget.content.kind === "text";
            return (
              <BoardWidgetFrame
                key={widget.id}
                x={widget.x}
                y={widget.y}
                w={widget.w}
                h={widget.h}
                title={widget.title ?? defaultTitle(widget)}
                variant={isText ? "plain" : "card"}
                background={widget.background}
                selected={selectedId === widget.id}
                snapStep={grid ? GRID_STEP : undefined}
                onSelect={() => setSelectedId(widget.id)}
                onChange={(next) => updateWidget(widget.id, next)}
                onRemove={() => removeWidget(widget.id)}
              >
                {widget.content.kind === "kpi" && (
                  <div className="flex h-full items-center">
                    <p className="tabular text-2xl font-bold text-ink">{widget.content.kpi.value}</p>
                  </div>
                )}
                {widget.content.kind === "chart" && (
                  <div data-chart-widget={widget.id} className="h-full w-full">
                    <MiniChart chart={widget.content.chart} color={widget.content.accentColor} />
                  </div>
                )}
                {widget.content.kind === "text" && (
                  <textarea
                    defaultValue={widget.content.text}
                    onBlur={(e) => updateWidget(widget.id, { content: { kind: "text", text: e.target.value } })}
                    className="h-full w-full resize-none bg-transparent text-sm text-ink outline-none"
                  />
                )}
              </BoardWidgetFrame>
            );
          })}
        </div>
      </div>
    </div>
  );
}
