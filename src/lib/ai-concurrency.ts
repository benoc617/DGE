/**
 * Async semaphores for overlapping AI decisions (door-game) without unbounded
 * Gemini RPM or parallel Optimal/MCTS CPU.
 */

export function parsePositiveInt(env: string | undefined, defaultVal: number): number {
  const n = Number.parseInt(String(env ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaultVal;
}

export function createAsyncSemaphore(maxConcurrent: number) {
  const cap = Math.max(1, maxConcurrent);
  let active = 0;
  const queue: Array<() => void> = [];
  return async function runWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= cap) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

const geminiCap = parsePositiveInt(process.env.GEMINI_MAX_CONCURRENT, 4);
const mctsCap = parsePositiveInt(process.env.DOOR_AI_MAX_CONCURRENT_MCTS, 1);

/** Limits concurrent Gemini `generateContent` calls (global). */
export const withGeminiGeneration = createAsyncSemaphore(geminiCap);

/** Limits concurrent Optimal-persona MCTS work inside `getAIMove` (global). */
export const withMctsDecide = createAsyncSemaphore(mctsCap);
