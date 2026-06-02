// Shared AI types. Kept separate so the browser never imports server engine code.

export interface Summary {
  count: number;
  /** 1. 学びと次回への教訓 */
  lessons: string[];
  /** 2. 重要な決断と事実の記録 */
  decisions: string[];
  /** 3. 興味・関心と熱中したことの変遷 */
  trends: string[];
}
