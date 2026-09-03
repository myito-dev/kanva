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

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartSuggestion {
  id: string;
  kind: ChartKind;
  title: string;
  aggregation: "sum" | "avg" | "count";
  points: ChartPoint[];
}

export type AnalysisSource = "ai" | "local";

export interface Analysis {
  source: AnalysisSource;
  kpis: Kpi[];
  insights: Insight[];
  charts: ChartSuggestion[];
}

export interface AnalyzeResult {
  profile: DatasetProfile;
  previewRows: DatasetRow[];
  fileName: string;
  analysis: Analysis;
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
  background: string;
  widgets: BoardWidget[];
}

export interface AnalyzeError {
  error: string;
}
