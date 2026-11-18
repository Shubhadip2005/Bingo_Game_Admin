import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { RoomData } from "../types";
import { closeRooms, subscribeAllRooms } from "./adminActions";
import { timeAgo } from "../lib/format";
import AdminRoom from "./AdminRoom";

type Tab = "live" | "waiting" | "finished" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "waiting", label: "Waiting" },
  { key: "finished", label: "Finished" },
  { key: "all", label: "All" },
];

const isLive = (r: RoomData) => r.status === "setup" || r.status === "playing";
const inTab = (r: RoomData, tab: Tab) =>
  tab === "all" || (tab === "live" && isLive(r)) || (tab === "waiting" && r.status === "waiting") || (tab === "finished" && r.status === "finished");

const STATUS_LABEL: Record<RoomData["status"], string> = {
  waiting: "Waiting for players",
  setup: "Arranging boards",
  playing: "Playing",
  finished: "Finished",
};

interface Props {
  user: User;
  onSignOut: () => void;
}

export default function AdminDashboard({ user, onSignOut }: Props) {
  const [rooms, setRooms] = useState<Record<string, RoomData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeAllRooms(setRooms, setError), []);

  const all = useMemo(
    () => Object.entries(rooms ?? {}).sort((a, b) => b[1].createdAt - a[1].createdAt),
    [rooms]
  );

  const stats = useMemo(() => {
    const live = all.filter(([, r]) => isLive(r));
    return {
      live: live.length,
      playing: all.filter(([, r]) => r.status === "playing").length,
      waiting: all.filter(([, r]) => r.status === "waiting").length,
      finished: all.filter(([, r]) => r.status === "finished").length,
      online: live.reduce((sum, [, r]) => sum + Object.values(r.players).filter((p) => p.online && !p.left).length, 0),
    };
  }, [all]);

  const q = search.trim().toLowerCase();
  const shown = all.filter(
    ([id, r]) =>
      inTab(r, tab) &&
      (!q || id.toLowerCase().includes(q) || Object.values(r.players).some((p) => p.name.toLowerCase().includes(q)))
  );

  async function cleanUp(label: string, ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`${label}: delete ${ids.length} room${ids.length === 1 ? "" : "s"} and their boards? This can't be undone.`)) return;
    setBusy(true);
    try {
      await closeRooms(ids);
    } catch (e) {
      console.error(e);
      setError("Couldn't delete those rooms.");
    } finally {
      setBusy(false);
    }
  }

  const finishedIds = all.filter(([, r]) => r.status === "finished").map(([id]) => id);
  const staleWaitingIds = all
    .filter(([, r]) => r.status === "waiting" && Date.now() - r.createdAt > 60 * 60 * 1000)
    .map(([id]) => id);

  const selectedRoom = selected && rooms ? rooms[selected] : undefined;
  if (selected && selectedRoom) {
    return <AdminRoom room={selectedRoom} roomId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <main className="page wide">
      <div className="admin-top">
        <div>
          <h1 className="logo small">Admin</h1>
          <p className="tagline">Signed in as {user.email}</p>
        </div>
        <button className="btn ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      {error && <p className="error on-blue">{error}</p>}

      <div className="stats">
        <Stat label="Live rooms" value={stats.live} />
        <Stat label="Playing now" value={stats.playing} />
        <Stat label="Players online" value={stats.online} />
        <Stat label="Waiting" value={stats.waiting} />
        <Stat label="Finished" value={stats.finished} />
      </div>

      <div className="card">
        <div className="admin-filters">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="Search by room code or player name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search rooms"
          />
        </div>

        {rooms === null ? (
          <p className="hint">Loading rooms…</p>
        ) : shown.length === 0 ? (
          <p className="hint">{tab === "live" ? "No games are being played right now." : "No rooms here."}</p>
        ) : (
          <ul className="room-list">
            {shown.map(([id, r]) => {
              const players = Object.values(r.players).sort((a, b) => a.joinedAt - b.joinedAt);
              return (
                <li key={id}>
                  <button className="room-card" onClick={() => setSelected(id)}>
                    <span className="room-top">
                      <span className="code-stamp small">{id}</span>
                      <span className={`chip ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    </span>
                    <span className="room-meta">
                      {r.gridSize}×{r.gridSize} board, first to {r.linesToWin} lines, round {r.round}
                      {r.status === "playing" && `, ${r.callCount} called`}
                    </span>
                    <span className="room-players">
                      {players.map((p) => (
                        <span key={p.id} className="room-player">
                          <span className={p.online && !p.left ? "dot on" : "dot"} aria-hidden="true" />
                          {p.name}
                          {p.left && <span className="tag">Left</span>}
                        </span>
                      ))}
                    </span>
                    <span className="room-meta">Created {timeAgo(r.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="title small">Clean up</h2>
        <p className="hint">Old rooms stay in the database until they are deleted. This frees them in one click.</p>
        <div className="actions">
          <button className="btn ghost" disabled={busy || finishedIds.length === 0} onClick={() => cleanUp("Finished rooms", finishedIds)}>
            Delete finished rooms ({finishedIds.length})
          </button>
          <button className="btn ghost" disabled={busy || staleWaitingIds.length === 0} onClick={() => cleanUp("Waiting rooms older than 1 hour", staleWaitingIds)}>
            Delete old waiting rooms ({staleWaitingIds.length})
          </button>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
