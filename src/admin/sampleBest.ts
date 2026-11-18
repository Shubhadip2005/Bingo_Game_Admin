/**
 * DEMO ONLY. Used by SampleRoom.tsx to explore an algorithm idea on made-up data that never
 * touches Firebase or a real game. Not part of the real admin tools (adminActions.ts), which
 * only offer the swap-two-numbers tool that always tells the affected player what changed.
 *
 * Moving the whole board around freely, the number of complete lines you can reach depends
 * only on how many numbers have been called, not on where they currently sit. So the real
 * question is: "which combination of lines can be fully covered by the fewest called
 * numbers?" That can be answered two ways:
 *
 * - Exact: check every possible combination of lines. Always finds the true best answer,
 *   but the number of combinations doubles with every extra line, so it only stays fast on
 *   boards up to about 9x9 (20 lines, ~1,000,000 combinations).
 * - Heuristic: repeatedly add whichever remaining line needs the fewest new called numbers.
 *   Instant on any board size, usually very close to the true best, but not guaranteed.
 */
import { isCalled, lineGroups } from "../lib/bingoLogic";

export type BestMethod = "exact" | "heuristic";

export interface BestResult {
  cells: number[];
  method: BestMethod;
  linesAchieved: number;
  elapsedMs: number;
}

export interface UnionResult {
  lines: number;
  elapsedMs: number;
}

/** Checking every combination only stays fast up to this many lines (2^20 ~= 1,000,000). */
export const EXACT_LINE_LIMIT = 20;

export const totalLines = (n: number, diagonals: boolean): number => 2 * n + (diagonals ? 2 : 0);

function popcount(x: bigint): number {
  let c = 0;
  while (x > 0n) {
    x &= x - 1n;
    c++;
  }
  return c;
}

function lineMasks(n: number, diagonals: boolean): bigint[] {
  return lineGroups(n, diagonals).map((g) => g.reduce((m, idx) => m | (1n << BigInt(idx)), 0n));
}

/** Exact: tries every combination of lines. Returns null when there are too many to check. */
function exactBestUnion(n: number, diagonals: boolean, calledCount: number): { mask: bigint; lines: number } | null {
  const masks = lineMasks(n, diagonals);
  if (masks.length > EXACT_LINE_LIMIT) return null;
  let bestMask = 0n;
  let bestLines = 0;
  const subsetCount = 1 << masks.length;
  for (let subset = 0; subset < subsetCount; subset++) {
    let union = 0n;
    let lines = 0;
    for (let i = 0; i < masks.length; i++) {
      if (subset & (1 << i)) {
        union |= masks[i];
        lines++;
      }
    }
    if (lines > bestLines && popcount(union) <= calledCount) {
      bestLines = lines;
      bestMask = union;
    }
  }
  return { mask: bestMask, lines: bestLines };
}

/** Heuristic: greedily adds whichever line costs the fewest new called numbers. Always fast. */
function greedyBestUnion(n: number, diagonals: boolean, calledCount: number): { mask: bigint; lines: number } {
  const masks = lineMasks(n, diagonals);
  const used = new Array(masks.length).fill(false);
  let union = 0n;
  let lines = 0;
  for (;;) {
    let bestIdx = -1;
    let bestNewCells = Infinity;
    for (let i = 0; i < masks.length; i++) {
      if (used[i]) continue;
      const merged = union | masks[i];
      const size = popcount(merged);
      if (size > calledCount) continue;
      const newCells = size - popcount(union);
      if (newCells < bestNewCells) {
        bestNewCells = newCells;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    union |= masks[bestIdx];
    used[bestIdx] = true;
    lines++;
  }
  return { mask: union, lines };
}

/** Runs the exact method if the board is small enough, otherwise the heuristic. Rebuilds the board to match. */
export function bestArrangementDemo(cells: number[], called: Record<string, number>, n: number, diagonals: boolean): BestResult {
  const start = Date.now();
  const calledNumbers = cells.filter((v) => isCalled(called, v));
  const uncalledNumbers = cells.filter((v) => !isCalled(called, v));

  const exact = exactBestUnion(n, diagonals, calledNumbers.length);
  const chosen = exact ?? greedyBestUnion(n, diagonals, calledNumbers.length);
  const method: BestMethod = exact ? "exact" : "heuristic";

  const total = n * n;
  const linePositions: number[] = [];
  const otherPositions: number[] = [];
  for (let i = 0; i < total; i++) ((chosen.mask >> BigInt(i)) & 1n ? linePositions : otherPositions).push(i);

  const next = new Array<number>(total);
  let used = 0;
  for (const pos of linePositions) next[pos] = calledNumbers[used++];
  const leftovers = [...calledNumbers.slice(used), ...uncalledNumbers];
  otherPositions.forEach((pos, i) => (next[pos] = leftovers[i]));

  return { cells: next, method, linesAchieved: chosen.lines, elapsedMs: Date.now() - start };
}

/** Runs both methods (when possible) purely to compare their speed and result, without changing any board. */
export function compareMethods(n: number, diagonals: boolean, calledCount: number): { exact: UnionResult | null; heuristic: UnionResult } {
  const t0 = Date.now();
  const exactResult = exactBestUnion(n, diagonals, calledCount);
  const exact = exactResult ? { lines: exactResult.lines, elapsedMs: Date.now() - t0 } : null;

  const t1 = Date.now();
  const heuristicResult = greedyBestUnion(n, diagonals, calledCount);
  const heuristic = { lines: heuristicResult.lines, elapsedMs: Date.now() - t1 };

  return { exact, heuristic };
}
