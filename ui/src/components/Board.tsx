import { useLayoutEffect, useRef, useState } from "react";
import type { Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, CLUE_NAMES, ICONS, PORTRAITS } from "../data.ts";

// The detective's corkboard: suspects on top, evidence below, and red string from
// each piece of evidence to the story it broke.
export function Board({ state, actions, onClose }: { state: Snapshot; actions: Actions; onClose(): void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Array<{ key: string; x1: number; y1: number; x2: number; y2: number }>>([]);
  const cards = [
    ...state.evidence.map((e) => ({ id: e.id, name: e.name, note: e.testimony ? "testimony" : e.tested ? (e.puzzle ? "restored" : "tested") : "" })),
    ...state.clues.map((c) => ({ id: c.id, name: CLUE_NAMES[c.id] ?? c.id, note: "your clue" })),
  ];

  useLayoutEffect(() => {
    const measure = () => {
      const box = wrap.current?.getBoundingClientRect();
      if (!box) return;
      const at = (sel: string, edge: "top" | "bottom") => {
        const r = wrap.current!.querySelector(sel)?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2 - box.left, y: (edge === "top" ? r.top + 8 : r.bottom - 8) - box.top } : null;
      };
      setLines(
        state.links.flatMap((l) => {
          const a = at(`[data-ev="${l.evidence}"]`, "top");
          const b = at(`[data-who="${l.agent}"]`, "bottom");
          return a && b ? [{ key: `${l.evidence}-${l.agent}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
        }),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [state.links.length, cards.length]);

  return (
    <div className="overlay boardview" role="dialog" aria-label="Evidence board">
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="cork" ref={wrap}>
        <div className="cork-head">
          <div>
            <p className="eyebrow">The evidence board</p>
            <h2>The case so far</h2>
          </div>
          <div className="meter" aria-label={`Case ${state.progress}% uncovered`}>
            <span className="meter-label">Case uncovered</span>
            <div className="meter-bar"><i style={{ width: `${state.progress}%` }} /></div>
            <b>{state.progress}%</b>
          </div>
        </div>

        <div className="pins suspects-pins">
          {state.suspects.map((s, n) => (
            <div key={s.agent} className="polaroid" data-who={s.agent} style={{ "--rot": `${[-3, 2, -1.5, 3][n % 4]}deg` } as React.CSSProperties}>
              <span className="pin" />
              <img src={ART(PORTRAITS[s.agent]!)} alt="" />
              <b>{s.name}</b>
              <small>{s.cracked}/{s.claims.length} lies broken</small>
              {s.cracked > 0 && <span className="mini-stamp">LIAR</span>}
            </div>
          ))}
        </div>

        <svg className="strings" aria-hidden="true">
          {lines.map((l) => (
            <path key={l.key} d={`M${l.x1},${l.y1} Q${(l.x1 + l.x2) / 2},${(l.y1 + l.y2) / 2 + 40} ${l.x2},${l.y2}`} />
          ))}
        </svg>

        <div className="pins evidence-pins">
          {cards.length === 0 && <p className="muted">Nothing pinned yet. Search the house.</p>}
          {cards.map((c, n) => (
            <div key={c.id} className={`note-card ${state.links.some((l) => l.evidence === c.id) ? "linked" : ""}`} data-ev={c.id} style={{ "--rot": `${((n * 53) % 9) - 4}deg` } as React.CSSProperties}>
              <span className="pin" />
              <span className="note-icon">{ICONS[c.id] ?? "🔍"}</span>
              <span>{c.name}</span>
              {c.note && <small>{c.note}</small>}
            </div>
          ))}
        </div>

        <div className="cork-foot">
          <p className="muted">Red string marks evidence that broke a story. Not every liar is the killer.</p>
          <button className="btn big danger" disabled={state.phase !== "playing"} onClick={() => actions.open({ kind: "accuse" })}>
            Make your accusation
          </button>
        </div>
      </div>
    </div>
  );
}
