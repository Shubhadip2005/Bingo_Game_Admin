import { describe, it, expect } from "vitest";
import { swapCells, countLines, callKey, isCompleteBoard } from "./bingoLogic";
import { makeRoom, normalizeRoom, applyJoin, applyStart, applyReady, applyLeave } from "./roomLogic";

describe("swapCells", () => {
  it("swaps two boxes without changing the original", () => {
    const cells = [1, 2, 3, 4, 5];
    expect(swapCells(cells, 0, 4)).toEqual([5, 2, 3, 4, 1]);
    expect(cells).toEqual([1, 2, 3, 4, 5]);
  });
  it("rejects a box swapped with itself or boxes that don't exist", () => {
    expect(swapCells([1, 2, 3], 1, 1)).toBeNull();
    expect(swapCells([1, 2, 3], -1, 2)).toBeNull();
    expect(swapCells([1, 2, 3], 0, 3)).toBeNull();
  });
  it("a swap changes the line count and keeps the board valid", () => {
    const cells = Array.from({ length: 25 }, (_, i) => i + 1);
    const called = Object.fromEntries([1, 2, 3, 4, 6].map((n, i) => [callKey(n), i + 1]));
    expect(countLines(cells, called, 5, true)).toBe(0);
    const swapped = swapCells(cells, 4, 5)!;
    expect(countLines(swapped, called, 5, true)).toBe(1);
    expect(isCompleteBoard(swapped, 5)).toBe(true);
  });
});

describe("room versions", () => {
  it("new rooms are version 2 and old rooms are read as version 1", () => {
    const opts = { gridSize: 5, linesToWin: 5, diagonals: true, maxPlayers: 2 };
    expect(makeRoom("A", "Asha", opts).ver).toBe(2);
    expect(normalizeRoom({ gridSize: 5, players: {} }).ver).toBe(1);
  });
});

describe("removing a player", () => {
  it("the game carries on without them", () => {
    const opts = { gridSize: 5, linesToWin: 5, diagonals: true, maxPlayers: 3 };
    const p = (id: string, joinedAt: number) => ({ id, name: id, joinedAt, ready: false, online: true, left: false });
    let room = makeRoom("A", "A", opts, 1);
    room = applyJoin(room, p("B", 2))!;
    room = applyJoin(room, p("C", 3))!;
    room = applyStart(room, "A", () => 0.999)!;
    for (const id of ["A", "B", "C"]) room = applyReady(room, id)!;
    room = applyLeave(room, "B")!;
    expect(room.status).toBe("playing");
    expect(room.players["B"].left).toBe(true);
  });
});
