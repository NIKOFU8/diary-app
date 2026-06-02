// Core domain types for the diary app.

export type Weather = "sunny" | "cloudy" | "rainy" | "snowy";

export type Condition = 1 | 2 | 3 | 4 | 5;

/** A single saved diary record. */
export interface DiaryEntry {
  id: string;
  /** ISO 8601 timestamp of when the record was made. */
  createdAt: string;
  weather: Weather;
  condition: Condition;
  /** Body text after AI correction + manual edits. */
  body: string;
  /** Photo as a data URL (local store) or a public URL (Supabase). */
  photoUrl: string | null;
}

/** Input used when creating a new entry. */
export interface NewEntryInput {
  weather: Weather;
  condition: Condition;
  body: string;
  /** Data URL of the attached photo, if any. */
  photoDataUrl?: string | null;
  /** Override timestamp (defaults to now). */
  createdAt?: string;
}

export const WEATHERS: { value: Weather; label: string; emoji: string }[] = [
  { value: "sunny", label: "晴れ", emoji: "☀️" },
  { value: "cloudy", label: "曇り", emoji: "☁️" },
  { value: "rainy", label: "雨", emoji: "🌧️" },
  { value: "snowy", label: "雪", emoji: "❄️" },
];

export const CONDITIONS: { value: Condition; label: string; emoji: string }[] = [
  { value: 1, label: "悪い", emoji: "😣" },
  { value: 2, label: "いまいち", emoji: "😕" },
  { value: 3, label: "ふつう", emoji: "😐" },
  { value: 4, label: "good", emoji: "🙂" },
  { value: 5, label: "絶好調", emoji: "😄" },
];

export function weatherMeta(w: Weather) {
  return WEATHERS.find((x) => x.value === w) ?? WEATHERS[0];
}

export function conditionMeta(c: Condition) {
  return CONDITIONS.find((x) => x.value === c) ?? CONDITIONS[2];
}
