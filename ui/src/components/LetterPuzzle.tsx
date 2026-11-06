import { useEffect, useState } from "react";
import type { Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { sound } from "../sound.ts";

// Charred scraps of a letter: drag (or tap, then tap a gap) each into its place.
export function LetterPuzzle({ state, actions, onClose }: { state: Snapshot; actions: Actions; onClose(): void }) {
  const puzzle = state.puzzle;
  const restored = state.evidence.find((e) => e.puzzle && e.tested);
  const [order] = useState(() => shuffle(puzzle?.pieces.map((_, i) => i) ?? []));
  const [placed, setPlaced] = useState<number[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const done = puzzle ? placed.length === puzzle.pieces.length : false;

  useEffect(() => {
    if (done && !sent) {
      setSent(true);
      sound.success();
      setTimeout(() => actions.say("@game-master restore the burned letter"), 900);
    }
  }, [done, sent]);

  if (!puzzle && !restored) {
    return (
      <div className="overlay letter" role="dialog" aria-label="The burned letter">
        <button className="close big" onClick={onClose} aria-label="Close">×</button>
        <div className="letter-card"><p className="muted">There is nothing to piece together yet.</p></div>
      </div>
    );
  }

  const drop = (slot: number, piece: number) => {
    setHeld(null);
    if (slot === piece && !placed.includes(piece)) {
      setPlaced((p) => [...p, piece]);
      sound.chime();
    } else {
      setWrong(piece);
      sound.thud();
      setTimeout(() => setWrong(null), 500);
    }
  };

  const pieces = puzzle?.pieces ?? [];
  return (
    <div className="overlay letter" role="dialog" aria-label="The burned letter">
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="letter-card">
        <p className="eyebrow">From the study fireplace</p>
        <h2>{restored && !puzzle ? "The letter, restored" : "Piece the letter together"}</h2>
        {restored && !puzzle ? (
          <div className="paper whole"><p>{restored.lab}</p></div>
        ) : (
          <>
            <p className="muted">Drag each charred scrap into the right gap, in reading order. Or tap a scrap, then tap a gap.</p>
            <div className={`paper ${done ? "whole" : ""}`}>
              {pieces.map((text, slot) => (
                <div
                  key={slot}
                  className={`gap ${placed.includes(slot) ? "filled" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => drop(slot, Number(e.dataTransfer.getData("text/plain")))}
                  onClick={() => held !== null && drop(slot, held)}
                >
                  {placed.includes(slot) ? <span className="ink">{text}</span> : <span className="gap-n">{slot + 1}</span>}
                </div>
              ))}
            </div>
            {done ? (
              <p className="letter-done">The words come back. Read it closely.</p>
            ) : (
              <div className="scraps">
                {order
                  .filter((i) => !placed.includes(i))
                  .map((i, n) => (
                    <button
                      key={i}
                      className={`scrap ${held === i ? "on" : ""} ${wrong === i ? "shake" : ""}`}
                      style={{ "--rot": `${((n * 37) % 14) - 7}deg` } as React.CSSProperties}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                      onClick={() => setHeld(held === i ? null : i)}
                    >
                      {pieces[i]}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
        {(done || restored) && (
          <button className="btn" onClick={onClose}>Back to the house</button>
        )}
      </div>
    </div>
  );
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  // Never start already solved.
  if (a.length > 1 && a.every((v, i) => v === xs[i])) a.push(a.shift()!);
  return a;
}
