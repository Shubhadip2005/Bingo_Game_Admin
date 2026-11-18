import { useEffect, useState } from "react";
import {
  MAX_GRID, MIN_GRID, callKey, countLines, emptyDraft, isCalled, isCompleteBoard, litCells,
  nextFreeNumber, randomFill, sequentialFill, unusedNumbers, validateEntry, type Draft,
} from "../lib/bingoLogic";
import BoardGrid from "../components/BoardGrid";
import { bestArrangementDemo, compareMethods, totalLines, EXACT_LINE_LIMIT, type BestResult } from "./sampleBest";

type Mode = "arrange" | "call";

interface Props {
  onBack: () => void;
}

/**
 * A sandbox board, fully made up in the browser. It never reads or writes Firebase and is not
 * connected to any real room or player. Use it to try arranging and calling numbers yourself,
 * then compare that to what the algorithm finds.
 */
export default function SampleRoom({ onBack }: Props) {
  const [n, setN] = useState(5);
  const [diagonals, setDiagonals] = useState(true);
  const [draft, setDraft] = useState<Draft>(() => sequentialFill(emptyDraft(5), 5));
  const [called, setCalled] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>("arrange");
  const [selected, setSelected] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [before, setBefore] = useState<Draft | null>(null);
  const [changed, setChanged] = useState<number[]>([]);
  const [result, setResult] = useState<BestResult | null>(null);
  const [compare, setCompare] = useState<ReturnType<typeof compareMethods> | null>(null);

  // Changing the board size starts a fresh board, since every position and called number is tied to it.
  useEffect(() => {
    setDraft(sequentialFill(emptyDraft(n), n));
    resetProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  function resetProgress() {
    setCalled({});
    setMode("arrange");
    setSelected(null);
    setError(null);
    setBefore(null);
    setChanged([]);
    setResult(null);
    setCompare(null);
  }

  const complete = isCompleteBoard(draft, n);
  const cells = complete ? (draft as number[]) : null;
  const calledCount = Object.keys(called).length;
  const myLines = cells ? countLines(cells, called, n, diagonals) : 0;
  const lit = cells ? litCells(cells, called, n, diagonals) : new Set<number>();
  const lines = totalLines(n, diagonals);
  const exactFeasible = lines <= EXACT_LINE_LIMIT;

  function setCell(index: number, value: number | null) {
    setDraft((d) => d.map((v, i) => (i === index ? value : v)));
  }

  function handleArrangeClick(index: number) {
    setError(null);
    if (draft[index] === null) {
      const next = nextFreeNumber(draft, n);
      if (next !== null) setCell(index, next);
      setSelected(null);
    } else {
      setSelected(index);
      setEditValue(String(draft[index]));
    }
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    const res = validateEntry(draft, selected, editValue, n);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCell(selected, res.value);
    setSelected(null);
    setError(null);
  }

  function handleCallClick(index: number) {
    if (!cells) return;
    const num = cells[index];
    const key = callKey(num);
    setCalled((c) => {
      if (c[key] !== undefined) {
        const next = { ...c };
        delete next[key];
        return next;
      }
      return { ...c, [key]: Object.keys(c).length + 1 };
    });
  }

  function callRandom() {
    if (!cells) return;
    const free = cells.filter((v) => !isCalled(called, v));
    if (free.length === 0) return;
    const num = free[Math.floor(Math.random() * free.length)];
    setCalled((c) => ({ ...c, [callKey(num)]: Object.keys(c).length + 1 }));
  }

  function callHalf() {
    if (!cells) return;
    const free = cells.filter((v) => !isCalled(called, v));
    const target = Math.max(1, Math.round(cells.length / 2)) - (cells.length - free.length);
    const shuffled = [...free].sort(() => Math.random() - 0.5).slice(0, Math.max(0, target));
    setCalled((c) => {
      const next = { ...c };
      let order = Object.keys(next).length;
      for (const num of shuffled) next[callKey(num)] = ++order;
      return next;
    });
  }

  function runBest() {
    if (!cells) return;
    const r = bestArrangementDemo(cells, called, n, diagonals);
    setBefore(draft);
    const diff: number[] = [];
    r.cells.forEach((v, i) => {
      if (v !== cells[i]) diff.push(i);
    });
    setChanged(diff);
    setDraft(r.cells);
    setResult(r);
  }

  function undoBest() {
    if (!before) return;
    setDraft(before);
    setBefore(null);
    setChanged([]);
    setResult(null);
  }

  function runCompare() {
    setCompare(compareMethods(n, diagonals, calledCount));
  }

  return (
    <main className="page wide">
      <div className="sample-banner">
        SAMPLE BOARD — made up in your browser only. Nothing here reads or writes Firebase or touches a real game.
      </div>

      <div className="admin-top">
        <button className="btn ghost" onClick={onBack}>
          Back to rooms
        </button>
        <button className="btn ghost" onClick={resetProgress}>
          Reset calls
        </button>
      </div>

      <div className="card">
        <h2 className="title">Set up a board</h2>
        <label className="label" htmlFor="sample-size">
          Board size: {n}×{n}, {n * n} boxes, {lines} possible lines{diagonals ? " (rows, columns, 2 diagonals)" : " (rows and columns)"}
        </label>
        <input
          id="sample-size"
          type="range"
          className="range"
          min={MIN_GRID}
          max={MAX_GRID}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
        />
        <div className="range-ends">
          <span>{MIN_GRID}×{MIN_GRID}</span>
          <span>{MAX_GRID}×{MAX_GRID}</span>
        </div>

        <label className="check">
          <input type="checkbox" checked={diagonals} onChange={(e) => setDiagonals(e.target.checked)} />
          Diagonals count as lines (the real game always counts them — this is just for comparing here)
        </label>

        <div className="tabs" role="tablist" style={{ marginTop: "1rem" }}>
          <button role="tab" aria-selected={mode === "arrange"} className={mode === "arrange" ? "tab active" : "tab"} onClick={() => setMode("arrange")}>
            Arrange numbers
          </button>
          <button
            role="tab"
            aria-selected={mode === "call"}
            className={mode === "call" ? "tab active" : "tab"}
            onClick={() => complete && setMode("call")}
            disabled={!complete}
          >
            Call numbers
          </button>
        </div>

        {mode === "arrange" ? (
          <>
            <p className="hint">
              Tap an empty box to place the next number. Tap a filled box to change or remove it. Use every number
              from 1 to {n * n} once before you can call numbers.
            </p>
            {selected !== null && (
              <form className="edit-bar" onSubmit={saveEdit}>
                <label htmlFor="sample-edit">Box {selected + 1}</label>
                <input
                  id="sample-edit"
                  className="input small"
                  inputMode="numeric"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSelected(null)}
                />
                <button type="submit" className="btn primary small">Save</button>
                <button type="button" className="btn ghost small" onClick={() => { setCell(selected, null); setSelected(null); }}>Remove</button>
                <button type="button" className="btn ghost small" onClick={() => setSelected(null)}>Cancel</button>
              </form>
            )}
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="btn ghost" onClick={() => setDraft((d) => sequentialFill(d, n))}>Fill rest in order</button>
              <button className="btn ghost" onClick={() => setDraft((d) => randomFill(d, n))}>Fill rest randomly</button>
              <button className="btn ghost" onClick={() => setDraft(randomFill(emptyDraft(n), n))}>Shuffle all</button>
              <button className="btn ghost" onClick={() => { setDraft(emptyDraft(n)); setSelected(null); }}>Clear board</button>
            </div>
            {!complete && (
              <p className="hint">{unusedNumbers(draft, n).length} box{unusedNumbers(draft, n).length === 1 ? "" : "es"} left to fill.</p>
            )}
          </>
        ) : (
          <>
            <p className="hint">
              Tap numbers to mark them as called, just like a real game — try arranging them yourself to make lines,
              then see what the algorithm finds below.
            </p>
            <div className="actions">
              <button className="btn ghost" onClick={callRandom}>Call one random number</button>
              <button className="btn ghost" onClick={callHalf}>Call about half the board</button>
              <button className="btn ghost" onClick={() => setCalled({})}>Clear all calls</button>
            </div>
            <p className="hint">{calledCount} of {n * n} numbers called.</p>
          </>
        )}

        {cells && (
          <div className="progress-top" style={{ marginTop: "1rem" }}>
            <span className="grow">Lines completed right now</span>
            <strong>{myLines}/{lines}</strong>
          </div>
        )}

        <BoardGrid
          n={n}
          cells={draft}
          called={mode === "call" ? called : undefined}
          lit={mode === "call" ? lit : undefined}
          selected={mode === "arrange" ? selected : changed.length ? changed : null}
          label="Sample board"
          canClick={(i) => (mode === "arrange" ? true : !!cells)}
          onCellClick={(i) => (mode === "arrange" ? handleArrangeClick(i) : handleCallClick(i))}
        />
      </div>

      <div className="card">
        <h2 className="title small">Find the best arrangement</h2>
        <p className="hint">
          Moves the numbers already on the board around (never adds or removes any) to complete as many lines as
          possible against the numbers currently called.
        </p>
        <div className="actions">
          <button className="btn primary" onClick={runBest} disabled={!complete}>
            Find best arrangement
          </button>
          {before && (
            <button className="btn ghost" onClick={undoBest}>
              Undo, back to my arrangement
            </button>
          )}
        </div>
        {result && (
          <p className="info">
            Found {result.linesAchieved} line{result.linesAchieved === 1 ? "" : "s"} using the{" "}
            {result.method === "exact" ? "exact method (checked every combination)" : "fast heuristic"} in{" "}
            {result.elapsedMs}ms. {changed.length} box{changed.length === 1 ? "" : "es"} moved (highlighted).
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="title small">Compare exact vs. heuristic speed</h2>
        <p className="hint">
          {exactFeasible
            ? `With ${lines} possible lines, checking every combination (2^${lines} = ${(2 ** lines).toLocaleString()}) is still fast enough to try.`
            : `With ${lines} possible lines, checking every combination would mean 2^${lines} combinations — far too many to try, so only the heuristic runs.`}
        </p>
        <div className="actions">
          <button className="btn ghost" onClick={runCompare} disabled={!complete}>
            Compare now
          </button>
        </div>
        {compare && (
          <div className="stats" style={{ marginTop: "0.8rem" }}>
            <div className="stat">
              <span className="stat-value">{compare.exact ? compare.exact.lines : "—"}</span>
              <span className="stat-label">Exact: lines found</span>
            </div>
            <div className="stat">
              <span className="stat-value">{compare.exact ? `${compare.exact.elapsedMs}ms` : "not run"}</span>
              <span className="stat-label">Exact: time taken</span>
            </div>
            <div className="stat">
              <span className="stat-value">{compare.heuristic.lines}</span>
              <span className="stat-label">Heuristic: lines found</span>
            </div>
            <div className="stat">
              <span className="stat-value">{compare.heuristic.elapsedMs}ms</span>
              <span className="stat-label">Heuristic: time taken</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
