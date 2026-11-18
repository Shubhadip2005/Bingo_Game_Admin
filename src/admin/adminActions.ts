/** Everything the admin panel does in Firebase. The database rules only allow these for admin accounts. */
import { ref, get, set, update, runTransaction, onValue, serverTimestamp } from "firebase/database";
import { db } from "../firebase";
import type { BoardNotice, RoomData } from "../types";
import { applyLeave, normalizeRoom } from "../lib/roomLogic";
import { swapCells } from "../lib/bingoLogic";

const toCells = (raw: unknown): number[] =>
  (Array.isArray(raw) ? raw : Object.values((raw ?? {}) as Record<string, unknown>)).map(Number);

const toNotice = (raw: unknown): BoardNotice | null => {
  const v = raw as { at?: unknown; a?: unknown; b?: unknown } | null | undefined;
  return v && v.a !== undefined && v.b !== undefined ? { at: Number(v.at) || 0, a: Number(v.a), b: Number(v.b) } : null;
};

/** Remove a player from a game in progress (the game carries on for everyone else). */
export async function leaveGame(roomId: string, playerId: string): Promise<boolean> {
  const result = await runTransaction(ref(db, `rooms/${roomId}`), (current) => {
    if (current === null) return current;
    const next = applyLeave(normalizeRoom(current), playerId);
    return next === null ? undefined : next;
  });
  return result.committed && result.snapshot.exists();
}

export interface AdminBoard {
  cells: number[];
  notice: BoardNotice | null;
}

/** An account is an admin when /admins/<uid> is true. That entry can only be added in the Firebase console. */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await get(ref(db, `admins/${uid}`));
    return snap.val() === true;
  } catch {
    return false;
  }
}

export function subscribeAllRooms(
  onRooms: (rooms: Record<string, RoomData>) => void,
  onError: (message: string) => void
): () => void {
  return onValue(
    ref(db, "rooms"),
    (snap) => {
      const rooms: Record<string, RoomData> = {};
      snap.forEach((child) => {
        const v = child.val();
        if (child.key && v && typeof v === "object" && v.gridSize && v.players) rooms[child.key] = normalizeRoom(v);
      });
      onRooms(rooms);
    },
    () => onError("Couldn't read the rooms. Check that your account is listed under admins and the rules are published.")
  );
}

/** Live view of every board that exists in a room's current round. A player who isn't ready has no board yet. */
export function subscribeRoomBoards(
  roomId: string,
  round: number,
  onBoards: (boards: Record<string, AdminBoard>) => void
): () => void {
  return onValue(
    ref(db, `boards/${roomId}/${round}`),
    (snap) => {
      const boards: Record<string, AdminBoard> = {};
      snap.forEach((child) => {
        const v = child.val();
        if (child.key && v?.cells) boards[child.key] = { cells: toCells(v.cells), notice: toNotice(v.notice) };
      });
      onBoards(boards);
    },
    () => onBoards({})
  );
}

/**
 * Swap two numbers on a player's board. The player is told about it on their own screen, and a
 * general "an admin made a correction" notice is shown to everyone in the room.
 */
export async function swapNumbers(roomId: string, round: number, uid: string, i: number, j: number): Promise<boolean> {
  const result = await runTransaction(ref(db, `boards/${roomId}/${round}/${uid}`), (current) => {
    if (current === null) return current;
    const cells = toCells(current.cells);
    const next = swapCells(cells, i, j);
    if (!next) return undefined;
    return { ...current, cells: next, notice: { at: Date.now(), a: cells[i], b: cells[j] } };
  });
  if (!result.committed || !result.snapshot.exists()) return false;
  await set(ref(db, `roomNotices/${roomId}/note`), { at: Date.now() });
  return true;
}

/** Lets players see that an admin is looking at their game. Call with false when leaving. */
export const setWatching = (roomId: string, on: boolean) =>
  set(ref(db, `roomNotices/${roomId}/watching`), on ? serverTimestamp() : null);

export const sendMessage = (roomId: string, text: string) =>
  set(ref(db, `roomNotices/${roomId}/message`), { text: text.trim().slice(0, 200), at: Date.now() });

export const clearMessage = (roomId: string) => set(ref(db, `roomNotices/${roomId}/message`), null);

/** Delete rooms completely (room, boards and notices) in one step. */
export async function closeRooms(roomIds: string[]): Promise<void> {
  if (roomIds.length === 0) return;
  const updates: Record<string, null> = {};
  for (const id of roomIds) {
    updates[`rooms/${id}`] = null;
    updates[`boards/${id}`] = null;
    updates[`roomNotices/${id}`] = null;
  }
  await update(ref(db), updates);
}
