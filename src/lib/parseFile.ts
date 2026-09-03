import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { DatasetRow } from "./types";

/** CSV via papaparse — header row as keys, empty lines dropped (mirrors the
 * original's csv.DictReader + fully-empty-row filtering). */
export function parseCsv(buffer: Buffer): DatasetRow[] {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<DatasetRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transform: (value) => (typeof value === "string" ? value.trim() : value),
  });
  return result.data.filter((row) => Object.values(row).some((v) => v !== ""));
}

/** Excel via SheetJS — first sheet, first row as headers, cell values
 * resolved to their displayed/calculated form (mirrors openpyxl's
 * data_only=True). */
export function parseExcel(buffer: Buffer): DatasetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  return rows
    .map((row) => {
      const stringRow: DatasetRow = {};
      for (const [key, value] of Object.entries(row)) {
        stringRow[key] = String(value ?? "").trim();
      }
      return stringRow;
    })
    .filter((row) => Object.values(row).some((v) => v !== ""));
}
