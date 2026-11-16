/** Parses a numeric cell, accepting both "1,234.56" and "1.234,56" styles,
 * a lone decimal comma ("1,5") and a leading currency symbol ("$1,200").
 * Returns null for anything that isn't a finite number. */
export function parseNumber(value: string): number | null {
  let s = value.trim().replace(/[\s$€]/g, "");
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever separator comes last is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // "1,234" / "12,345,678" are thousands groups; any other comma is decimal.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Normalizes a date cell to YYYY-MM-DD so dates sort and group correctly.
 * Slash/dash dates are read day-first (es-MX convention) unless the second
 * number can't be a month, e.g. "1/31/2026". */
export function toIsoDate(value: string): string | null {
  const v = value.trim();

  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);

  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return b > 12 ? isoDate(year, a, b) : isoDate(year, b, a);
  }

  const time = Date.parse(v);
  if (Number.isNaN(time)) return null;
  const d = new Date(time);
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
