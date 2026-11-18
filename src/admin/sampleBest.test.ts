import { describe, it, expect } from "vitest";
import { countLines, callKey } from "../lib/bingoLogic";
import { bestArrangementDemo, compareMethods, totalLines } from "./sampleBest";

const ordered = (n: number) => Array.from({ length: n * n }, (_, i) => i + 1);
const calledMap = (nums: number[]) => Object.fromEntries(nums.map((num, i) => [callKey(num), i + 1]));

describe("bestArrangementDemo", () => {
  it("finds the true best result on a small board (exact search)", () => {
    const called = calledMap([1, 2, 7, 12, 17, 22, 9, 14, 19, 3, 11]); // 11 called numbers on 5x5
    const result = bestArrangementDemo(ordered(5), called, 5, true);
    expect(result.method).toBe("exact");
    expect(result.linesAchieved).toBe(2); // a 3rd line would need at least 12 called numbers
    expect(countLines(result.cells, called, 5, true)).toBe(result.linesAchieved);
    expect([...result.cells].sort((a, b) => a - b)).toEqual(ordered(5)); // same numbers, just moved
  });
  it("falls back to the heuristic on a board too big to check exactly", () => {
    const called = calledMap(Array.from({ length: 60 }, (_, i) => i + 1)); // 60 called on a 15x15
    const result = bestArrangementDemo(ordered(15), called, 15, true);
    expect(result.method).toBe("heuristic");
    expect(countLines(result.cells, called, 15, true)).toBe(result.linesAchieved);
  });
  it("never claims more lines than the called numbers allow", () => {
    const called = calledMap([1, 2, 3, 4, 5]); // exactly one line's worth
    const result = bestArrangementDemo(ordered(5), called, 5, true);
    expect(result.linesAchieved).toBe(1);
  });
});

describe("compareMethods", () => {
  it("the heuristic never beats the exact best on a small board", () => {
    const { exact, heuristic } = compareMethods(5, true, 11);
    expect(exact).not.toBeNull();
    expect(heuristic.lines).toBeLessThanOrEqual(exact!.lines);
  });
  it("returns null for exact once the board is too big to check exactly", () => {
    const { exact, heuristic } = compareMethods(15, true, 60);
    expect(exact).toBeNull();
    expect(heuristic.lines).toBeGreaterThan(0);
  });
});

describe("totalLines", () => {
  it("counts rows, columns and diagonals", () => {
    expect(totalLines(5, true)).toBe(12);
    expect(totalLines(5, false)).toBe(10);
    expect(totalLines(9, true)).toBe(20);
    expect(totalLines(10, true)).toBe(22);
  });
});
