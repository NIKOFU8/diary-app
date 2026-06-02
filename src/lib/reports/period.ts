// 自動レポートの対象期間の計算（JST基準・週は月曜始まり・ISO週番号）。

export interface ReportPeriod {
  type: "week" | "month" | "year";
  start: string; // YYYY-MM-DD (JST)
  end: string; // YYYY-MM-DD (JST)
  label: string;
}

interface Civil {
  y: number;
  m: number; // 1-12
  d: number;
}

function jstParts(now: Date): { y: number; m: number; d: number; dow: number } {
  const t = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    dow: t.getUTCDay(), // 0=Sun .. 6=Sat
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(c: Civil): string {
  return `${c.y}-${pad(c.m)}-${pad(c.d)}`;
}

function addDays(c: Civil, delta: number): Civil {
  const dt = new Date(Date.UTC(c.y, c.m - 1, c.d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function isoWeek(c: Civil): { year: number; week: number } {
  const date = new Date(Date.UTC(c.y, c.m - 1, c.d));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: date.getUTCFullYear(), week };
}

/** 今日(JST)が境界なら、直前に終了した期間のレポート対象を返す。 */
export function duePeriods(now: Date = new Date()): ReportPeriod[] {
  const { y, m, d, dow } = jstParts(now);
  const today: Civil = { y, m, d };
  const periods: ReportPeriod[] = [];

  // 週: 月曜(dow===1)に「先週(月〜日)」を生成
  if (dow === 1) {
    const start = addDays(today, -7);
    const end = addDays(today, -1);
    const { year, week } = isoWeek(start);
    periods.push({
      type: "week",
      start: ymd(start),
      end: ymd(end),
      label: `${year}年 第${week}週のまとめ`,
    });
  }
  // 月: 1日に「先月」を生成
  if (d === 1) {
    const end = addDays(today, -1); // 先月の末日
    const start: Civil = { y: end.y, m: end.m, d: 1 };
    periods.push({
      type: "month",
      start: ymd(start),
      end: ymd(end),
      label: `${end.y}年${end.m}月のまとめ`,
    });
  }
  // 年: 1月1日に「昨年」を生成
  if (m === 1 && d === 1) {
    periods.push({
      type: "year",
      start: `${y - 1}-01-01`,
      end: `${y - 1}-12-31`,
      label: `${y - 1}年のまとめ`,
    });
  }

  return periods;
}

/** 期間(JST日付)を created_at(timestamptz) 比較用のISO文字列に変換。 */
export function jstPeriodRangeISO(p: ReportPeriod): { startISO: string; endISO: string } {
  return {
    startISO: `${p.start}T00:00:00+09:00`,
    endISO: `${p.end}T23:59:59.999+09:00`,
  };
}
