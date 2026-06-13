// Local-time date helpers. All "keys" are YYYY-MM-DD in the user's timezone.

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** YYYY-MM-DD in local time. */
export function dateKey(d: string | Date): string {
  const date = toDate(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateJP(d: string | Date): string {
  const date = toDate(d);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${DOW[date.getDay()]})`;
}

export function formatTimeJP(d: string | Date): string {
  const date = toDate(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDateTimeJP(d: string | Date): string {
  return `${formatDateJP(d)} ${formatTimeJP(d)}`;
}

/** Short M/D label. */
export function formatShortJP(d: string | Date): string {
  const date = toDate(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 期間ラベル "2026/6/8 〜 6/14"。
 * YYYY-MM-DD のキーを（タイムゾーンに依存せず）そのまま整形する。
 * 同じ年なら終端の年は省略し、年をまたぐ場合のみ終端にも年を付ける。
 */
export function formatRangeJP(startKey: string, endKey: string): string {
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const startStr = `${sy}/${sm}/${sd}`;
  const endStr = sy === ey ? `${em}/${ed}` : `${ey}/${em}/${ed}`;
  return `${startStr} 〜 ${endStr}`;
}

/** ISO start/end of a local date key. */
export function dayRange(key: string): { startISO: string; endISO: string } {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** ISO start/end of a month (month0 = 0-based month). */
export function monthRange(year: number, month0: number): { startISO: string; endISO: string } {
  const start = new Date(year, month0, 1, 0, 0, 0, 0);
  const end = new Date(year, month0 + 1, 0, 23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** 6x7 grid of dates covering the month (weeks start Monday). */
export function monthGrid(year: number, month0: number): Date[] {
  const first = new Date(year, month0, 1);
  // getDay(): 0=Sun..6=Sat → Monday-start offset (Mon=0..Sun=6)
  const startOffset = (first.getDay() + 6) % 7;
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(year, month0, 1 - startOffset + i));
  }
  return cells;
}

/** Weekday header labels for the calendar (Monday-first). */
export const WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
