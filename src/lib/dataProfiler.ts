import type { ColumnProfile, ColumnType, DatasetProfile, DatasetRow } from "./types";

const SAMPLE_SIZE = 200;
const SAMPLE_VALUES_SHOWN = 5;

const BOOLEAN_VALUES = new Set(["true", "false", "sí", "si", "no", "yes", "verdadero", "falso", "1", "0"]);

function isNumeric(value: string): boolean {
  const trimmed = value.trim().replace(/,/g, "");
  if (trimmed === "") return false;
  return !Number.isNaN(Number(trimmed));
}

const DATE_PATTERNS = [
  /^\d{4}-\d{1,2}-\d{1,2}/, // 2024-01-31
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // 31/01/2024 or 1/31/2024
  /^\d{1,2}-\d{1,2}-\d{2,4}$/, // 31-01-2024
];

function isDateLike(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 6 || isNumeric(trimmed)) return false;
  if (DATE_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  return !Number.isNaN(Date.parse(trimmed));
}

/** Infers a column's type from a sample of its non-empty values, in the
 * same spirit as the original Python profiler: booleans, then numbers, then
 * dates, then category vs. free text based on cardinality. */
function inferColumnType(values: string[]): ColumnType {
  const sample = values.slice(0, SAMPLE_SIZE);
  if (sample.length === 0) return "text";

  if (sample.every((v) => BOOLEAN_VALUES.has(v.trim().toLowerCase()))) return "boolean";

  const numericRatio = sample.filter(isNumeric).length / sample.length;
  if (numericRatio >= 0.9) return "number";

  const dateRatio = sample.filter(isDateLike).length / sample.length;
  if (dateRatio >= 0.9) return "date";

  const uniqueCount = new Set(sample).size;
  const uniqueRatio = uniqueCount / sample.length;
  if (uniqueCount <= 20 || uniqueRatio <= 0.5) return "category";

  return "text";
}

export function profileDataset(rows: DatasetRow[]): DatasetProfile {
  const columnNames = rows.length > 0 ? Object.keys(rows[0]) : [];

  const columns: ColumnProfile[] = columnNames.map((name) => {
    const allValues = rows.map((row) => (row[name] ?? "").trim());
    const nonEmptyValues = allValues.filter((v) => v !== "");
    const nullCount = allValues.length - nonEmptyValues.length;

    return {
      name,
      type: inferColumnType(nonEmptyValues),
      nullCount,
      nullRatio: allValues.length > 0 ? nullCount / allValues.length : 0,
      uniqueValues: new Set(nonEmptyValues).size,
      sampleValues: Array.from(new Set(nonEmptyValues)).slice(0, SAMPLE_VALUES_SHOWN),
    };
  });

  return {
    rowCount: rows.length,
    columnCount: columnNames.length,
    columns,
  };
}
