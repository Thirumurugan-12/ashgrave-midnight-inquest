import { useEffect, useState } from "react";
import type { GameConnection, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ROMAN } from "../data.ts";
import { sound } from "../sound.ts";

export function TopBar({ state, conn, actions, onTour }: { state: Snapshot; conn: GameConnection; actions: Actions; onTour(): void }) {
  const [now, setNow] = useState(Date.now());
  const [audio, setAudio] = useState(sound.on);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = state.nextActAt ? Math.max(0, state.nextActAt - now) : null;
  const mmss = left === null ? null : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const last = state.act === state.chapters;
  const playing = state.phase === "playing";

  return (
    <header className="topbar">
      <div className="brand">Ashgrave</div>
      <div className="act">
        <span className="act-num">{state.act ? `Chapter ${ROMAN[state.act]} of ${ROMAN[state.chapters]}` : "Not begun"}</span>
        <span className="act-title">{state.actTitle}</span>
      </div>
      {mmss && (
        <div className={`clock ${last ? "urgent" : ""}`} data-tour="clock" title={last ? "Until Dr. Vale's carriage leaves" : "Until the next chapter"}>
          <span aria-hidden="true">{last ? "🐎" : "🔔"}</span> {mmss}
        </div>
      )}
      <div className="progress-chip" title="How much of the case you have uncovered">
        <div className="meter-bar small"><i style={{ width: `${state.progress}%` }} /></div>
        <span>{state.progress}%</span>
      </div>
      <div className="stat" title="Lies caught">🧩 {state.liesCaught}</div>
      <button className="btn small line" data-tour="hint" onClick={actions.hint} disabled={!playing}>🕯️ Hint</button>
      <button className="btn small line" data-tour="board" onClick={() => actions.open({ kind: "board" })} disabled={!playing}>📌 Board</button>
      <button className="btn small accuse-btn" data-tour="accuse" onClick={() => actions.open({ kind: "accuse" })} disabled={!playing}>
        Accuse
      </button>
      <div className="spacer" />
      <button className="icon-btn" onClick={onTour} title="How to play">?</button>
      <a className="synced" data-tour="switch" href={conn.mattermostUrl ?? "#"} target="_blank" rel="noreferrer" title="Every action here is posted in the Switch room on Mattermost">
        <span className="dot" /> Live in #conservatory via Switch ↗
      </a>
      <button
        className="icon-btn"
        aria-pressed={audio}
        title={audio ? "Sound on" : "Sound off"}
        onClick={() => {
          sound.toggle();
          setAudio(sound.on);
        }}
      >
        {audio ? "🔊" : "🔈"}
      </button>
      <div className="who">{conn.username}</div>
    </header>
  );
}
