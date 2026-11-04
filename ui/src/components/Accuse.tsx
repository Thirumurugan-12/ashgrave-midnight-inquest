import { useState } from "react";
import type { Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, CLUE_NAMES, ICONS, PORTRAITS } from "../data.ts";

export function Accuse({ state, actions, onClose }: { state: Snapshot; actions: Actions; onClose(): void }) {
  const [who, setWho] = useState<string | null>(null);
  const [how, setHow] = useState<string[]>([]);
  const [why, setWhy] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const items = [
    ...state.evidence.map((e) => ({ id: e.id, name: e.name })),
    ...state.clues.map((c) => ({ id: c.id, name: CLUE_NAMES[c.id] ?? c.id })),
  ];
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const suspect = state.suspects.find((s) => s.id === who);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const command = suspect
    ? `@game-master accuse ${suspect.id} how: ${how.map(nameOf).join(", ") || "unknown"} why: ${why.map(nameOf).join(", ") || "unknown"}`
    : "";

  return (
    <div className="overlay accuse" role="dialog" aria-label="Make your accusation">
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="board">
        <p className="eyebrow">The evidence board</p>
        <h2>Name the killer</h2>
        <p className="muted">You need all three: who did it, how, and why. The first accusation ends the game, so agree with your fellow detectives first.</p>

        <div className="board-step">
          <span className="step">1 · Who</span>
          <div className="suspect-row">
            {state.suspects.map((s) => (
              <button key={s.id} className={`suspect-pin ${who === s.id ? "on" : ""}`} onClick={() => setWho(s.id)} aria-pressed={who === s.id}>
                <img src={ART(PORTRAITS[s.agent]!)} alt="" />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="board-cols">
          <div className="board-step">
            <span className="step">2 · How: the means</span>
            <div className="chips">
              {items.map((i) => (
                <button key={i.id} className={`chip ${how.includes(i.id) ? "on" : ""}`} onClick={() => toggle(how, setHow, i.id)} aria-pressed={how.includes(i.id)}>
                  {ICONS[i.id]} {i.name}
                </button>
              ))}
            </div>
          </div>
          <div className="board-step">
            <span className="step">3 · Why: the motive</span>
            <div className="chips">
              {items.map((i) => (
                <button key={i.id} className={`chip ${why.includes(i.id) ? "on" : ""}`} onClick={() => toggle(why, setWhy, i.id)} aria-pressed={why.includes(i.id)}>
                  {ICONS[i.id]} {i.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="board-foot">
          {!confirm ? (
            <button className="btn big danger" disabled={!suspect} onClick={() => setConfirm(true)}>
              {suspect ? `Accuse ${suspect.name}` : "Pick a suspect"}
            </button>
          ) : (
            <div className="confirm">
              <p>
                Accuse <b>{suspect!.name}</b>? There is no taking it back.
              </p>
              <button className="btn big danger" onClick={() => { actions.say(command); onClose(); }}>
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
