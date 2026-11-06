import { useState } from "react";
import type { Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, PORTRAITS } from "../data.ts";

// Three picks: who, how, why. One shot.
export function Accuse({ state, actions, onClose }: { state: Snapshot; actions: Actions; onClose(): void }) {
  const [who, setWho] = useState<string | null>(null);
  const [how, setHow] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const suspect = state.suspects.find((s) => s.id === who);
  const ready = suspect && how && why;

  return (
    <div className="overlay accuse" role="dialog" aria-label="Make your accusation">
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="board">
        <p className="eyebrow">The accusation</p>
        <h2>Name the killer</h2>
        <p className="muted">Three choices: who did it, how, and why. The first accusation ends the game, so agree with your fellow detectives first.</p>

        <div className="board-step">
          <span className="step">1 · Who</span>
          <div className="suspect-row">
            {state.suspects.map((s) => (
              <button key={s.id} className={`suspect-pin ${who === s.id ? "on" : ""}`} onClick={() => setWho(s.id)} aria-pressed={who === s.id}>
                <img src={ART(PORTRAITS[s.agent]!)} alt="" />
                <span>{s.name}</span>
                {s.cracked > 0 && <small>{s.cracked} lie{s.cracked > 1 ? "s" : ""} caught</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="board-cols">
          <div className="board-step">
            <span className="step">2 · How</span>
            <div className="choices">
              {state.accusation.how.map((c) => (
                <button key={c.id} className={`choice ${how === c.id ? "on" : ""}`} onClick={() => setHow(c.id)} aria-pressed={how === c.id}>
                  {c.text}
                </button>
              ))}
            </div>
          </div>
          <div className="board-step">
            <span className="step">3 · Why</span>
            <div className="choices">
              {state.accusation.why.map((c) => (
                <button key={c.id} className={`choice ${why === c.id ? "on" : ""}`} onClick={() => setWhy(c.id)} aria-pressed={why === c.id}>
                  {c.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="board-foot">
          {!confirm ? (
            <button className="btn big danger" disabled={!ready} onClick={() => setConfirm(true)}>
              {ready ? `Accuse ${suspect!.name}` : "Make all three choices"}
            </button>
          ) : (
            <div className="confirm">
              <p>
                Accuse <b>{suspect!.name}</b>? There is no taking it back.
              </p>
              <button
                className="btn big danger"
                onClick={() => {
                  actions.say(`@game-master accuse ${suspect!.id} how: ${how} why: ${why}`);
                  onClose();
                }}
              >
                Yes, call the accusation
              </button>
              <button className="btn line" onClick={() => setConfirm(false)}>Not yet</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
