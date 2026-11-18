import { useEffect, useState } from "react";
import type { Player, RoomData } from "../types";
import { countLines, litCells } from "../lib/bingoLogic";
import { timeAgo } from "../lib/format";
import BoardGrid from "../components/BoardGrid";
import {
  clearMessage, closeRooms, leaveGame, sendMessage, setWatching, subscribeRoomBoards, swapNumbers, type AdminBoard,
} from "./adminActions";

interface Props {
  room: RoomData;
  roomId: string;
  onBack: () => void;
}

export default function AdminRoom({ room, roomId, onBack }: Props) {
  const n = room.gridSize;
  const live = room.status === "setup" || room.status === "playing";
  // Players are always told about a swap, but only newer versions of the game can show that message.
  const canSwap = live && room.ver >= 2;
  const [boards, setBoards] = useState<Record<string, AdminBoard>>({});
  const [sel, setSel] = useState<{ uid: string; idx: number[] } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => subscribeRoomBoards(roomId, room.round, setBoards), [roomId, room.round]);

  // Players are shown a notice while an admin is viewing their game.
  useEffect(() => {
    if (!live) return;
    const mark = () => setWatching(roomId, true).catch(() => undefined);
    mark();
    const timer = setInterval(mark, 20_000);
    return () => {
      clearInterval(timer);
      setWatching(roomId, false).catch(() => undefined);
    };
  }, [roomId, live]);

  const ids = [
    ...room.order.filter((id) => room.players[id]),
    ...Object.keys(room.players).filter((id) => !room.order.includes(id)),
  ];
  const nameOf = (id: string) => room.players[id]?.name ?? "Player";
  const history = Object.entries(room.called)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => Number(key.slice(1)));

  function pick(uid: string, index: number) {
    setError(null);
    setInfo(null);
    setSel((cur) => {
      if (!cur || cur.uid !== uid || cur.idx.length >= 2) return { uid, idx: [index] };
      if (cur.idx.includes(index)) return { uid, idx: [] };
      return { uid, idx: [...cur.idx, index] };
    });
  }

  async function confirmSwap() {
    if (!sel || sel.idx.length !== 2) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await swapNumbers(roomId, room.round, sel.uid, sel.idx[0], sel.idx[1]);
      if (ok) {
        setInfo(`Swapped. ${nameOf(sel.uid)} has been told about the change.`);
        setSel(null);
      } else {
        setError("Couldn't swap those numbers.");
      }
    } catch (e) {
      console.error(e);
      setError("Couldn't swap those numbers. Check that your account is listed under admins and the rules are published.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await sendMessage(roomId, message);
      setMessage("");
      setInfo("Message sent to the players in this room.");
    } catch (e) {
      console.error(e);
      setError("Couldn't send the message.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(p: Player) {
    if (!window.confirm(`Remove ${p.name} from this game? The game carries on for everyone else.`)) return;
    try {
      await leaveGame(roomId, p.id);
    } catch (e) {
      console.error(e);
      setError("Couldn't remove that player.");
    }
  }

  async function handleClose() {
    if (!window.confirm(`Delete room ${roomId} and all its boards? Players will lose the game. This can't be undone.`)) return;
    try {
      await closeRooms([roomId]);
      onBack();
    } catch (e) {
      console.error(e);
      setError("Couldn't delete the room.");
    }
  }

  const turnName = room.turnId ? nameOf(room.turnId) : null;
  const selPlayer = sel ? nameOf(sel.uid) : "";
  const selCells = sel ? boards[sel.uid]?.cells : undefined;

  return (
    <main className="page wide">
      <div className="admin-top">
        <button className="btn ghost" onClick={onBack}>
          Back to rooms
        </button>
      </div>

      <div className="card">
        <div className="room-top">
          <span className="code-stamp">{roomId}</span>
          <span className={`chip ${room.status}`}>{room.status === "setup" ? "Arranging boards" : room.status === "waiting" ? "Waiting for players" : room.status === "playing" ? "Playing" : "Finished"}</span>
        </div>
        <p className="hint">
          {n}×{n} board, first to {room.linesToWin} lines, up to {room.maxPlayers} players, round {room.round}. Created{" "}
          {timeAgo(room.createdAt)}.
          {room.status === "playing" && ` ${room.callCount} numbers called${turnName ? `, ${turnName} to call` : ""}.`}
        </p>
        {live && <p className="hint">Players can see that an admin is viewing this game while this page is open.</p>}

        {history.length > 0 && (
          <div className="history">
            {history.map((num, i) => (
              <span key={num} className={i === history.length - 1 ? "ball tiny latest" : "ball tiny"}>
                {num}
              </span>
            ))}
          </div>
        )}

        <p className="label">Message to the players</p>
        <div className="admin-message">
          <input
            className="input"
            maxLength={200}
            placeholder="Shown to everyone in this room"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="btn ghost" onClick={handleSend} disabled={busy || !message.trim()}>
            Send
          </button>
          <button className="btn ghost" onClick={() => clearMessage(roomId).catch(() => undefined)}>
            Clear
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}

        <div className="actions">
          <button className="btn ghost" onClick={handleClose}>
            Delete this room
          </button>
        </div>
      </div>

      {room.status === "waiting" && (
        <div className="card">
          <p className="hint">This room hasn't started yet, so there are no boards.</p>
        </div>
      )}

      {ids.map((id) => {
        const p = room.players[id];
        const board = boards[id];
        const valid = board && board.cells.length === n * n;
        const lines = valid ? countLines(board.cells, room.called, n, room.diagonals) : 0;
        const isTurn = room.status === "playing" && room.turnId === id && !p.left;
        const mine = sel?.uid === id ? sel.idx : [];
        return (
          <section key={id} className="card">
            <h3 className="reveal-name">
              {p.name}
              <span className={p.online && !p.left ? "tag ok" : "tag"}>{p.left ? "Left" : p.online ? "Online" : "Offline"}</span>
              {room.status === "setup" && !p.left && <span className={p.ready ? "tag ok" : "tag"}>{p.ready ? "Ready" : "Arranging"}</span>}
              {isTurn && <span className="tag turn">{room.awaiting ? "Called" : "Turn"}</span>}
              {room.winnerIds?.includes(id) && <span className="tag ok">Winner</span>}
              {valid && (
                <span className="reveal-lines">
                  {lines}/{room.linesToWin} lines
                </span>
              )}
            </h3>

            {valid ? (
              <>
                <BoardGrid
                  n={n}
                  cells={board.cells}
                  called={room.called}
                  lit={litCells(board.cells, room.called, n, room.diagonals)}
                  selected={mine}
                  showOrder={room.status === "finished"}
                  label={`${p.name}'s board`}
                  canClick={() => canSwap}
                  onCellClick={(i) => pick(id, i)}
                />
                {canSwap && <p className="hint">Tap two numbers on this board to swap their positions.</p>}
                {live && !canSwap && (
                  <p className="hint">
                    Swapping is off for this room: it was created by an older version of the game that can't tell
                    players about corrections.
                  </p>
                )}
              </>
            ) : (
              <p className="hint">
                {room.status === "waiting"
                  ? "No board yet."
                  : "No board yet. This player hasn't pressed \"I'm ready\", so there's nothing to show."}
              </p>
            )}

            {live && !p.left && (
              <div className="actions">
                <button className="btn ghost small" onClick={() => handleRemove(p)}>
                  Remove {p.name} from the game
                </button>
              </div>
            )}
          </section>
        );
      })}

      {sel && sel.idx.length === 2 && selCells && (
        <div className="confirm-bar" role="group" aria-label="Confirm swap">
          <span className="ball">{selCells[sel.idx[0]]}</span>
          <span className="ball">{selCells[sel.idx[1]]}</span>
          <span className="confirm-text">
            Swap {selCells[sel.idx[0]]} and {selCells[sel.idx[1]]} on {selPlayer}'s board?
          </span>
          <button className="btn ghost small" onClick={() => setSel(null)} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary small" onClick={confirmSwap} disabled={busy}>
            {busy ? "Swapping…" : "Confirm swap"}
          </button>
        </div>
      )}
    </main>
  );
}
