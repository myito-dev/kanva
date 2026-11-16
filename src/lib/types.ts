export type ColumnType = "boolean" | "number" | "date" | "category" | "text";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  nullCount: number;
  nullRatio: number;
  uniqueValues: number;
  sampleValues: string[];
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
}

export type DatasetRow = Record<string, string>;

export interface Kpi {
  label: string;
  value: string;
}

export type InsightTone = "info" | "positive" | "warning";

export interface Insight {
  text: string;
  tone: InsightTone;
}

export type ChartKind = "bar" | "line";

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartSuggestion {
  id: string;
  kind: ChartKind;
  title: string;
  aggregation: Aggregation;
  points: ChartPoint[];
}

/** A KPI to compute: which column, how to aggregate it. With no column it
 * counts rows. */
export interface KpiSpec {
  label: string;
  column: string | null;
  aggregation: Aggregation;
}

/** A chart to compute: x is a date or category column, y a numeric column
 * (or null to count rows per x value). */
export interface ChartSpec {
  title: string;
  x: string;
  y: string | null;
  aggregation: Aggregation;
}

export interface DatasetAnalysis {
  /** Short narrative overview; only the AI mode writes one. */
  summary?: string;
  kpis: Kpi[];
  insights: Insight[];
  charts: ChartSuggestion[];
}

export type AnalysisMode = "ai" | "local";

/** "local_fallback" = AI was requested but unavailable, so local rules ran. */
export type AnalysisSource = "ai" | "local" | "local_fallback";

export interface AnalyzeResult {
  /** Unique per analysis run; lets the board notice a new dataset. */
  id: string;
  profile: DatasetProfile;
  previewRows: DatasetRow[];
  fileName: string;
  analysis: DatasetAnalysis;
  analysisSource: AnalysisSource;
  aiWarning?: string;
}

export type BoardWidgetContent =
  | { kind: "kpi"; kpi: Kpi }
  | { kind: "chart"; chart: ChartSuggestion; accentColor?: string }
  | { kind: "text"; text: string };

export interface BoardWidget {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  background?: string;
  content: BoardWidgetContent;
}

export interface BoardState {
  /** AnalyzeResult.id the widgets were built from. */
  datasetId?: string;
  background: string;
  widgets: BoardWidget[];
}

export interface AnalyzeError {
  error: string;
}
