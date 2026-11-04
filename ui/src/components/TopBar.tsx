import { useEffect, useState } from "react";
import type { GameConnection, Snapshot } from "../net.ts";
import { ROMAN } from "../data.ts";
import { sound } from "../sound.ts";

export function TopBar({ state, conn, onAccuse, onTour }: { state: Snapshot; conn: GameConnection; onAccuse(): void; onTour(): void }) {
  const [now, setNow] = useState(Date.now());
  const [audio, setAudio] = useState(sound.on);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = state.nextActAt ? Math.max(0, state.nextActAt - now) : null;
  const mmss = left === null ? null : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const carriage = state.act === 3;

  return (
    <header className="topbar">
      <div className="brand">Ashgrave</div>
      <div className="act">
        <span className="act-num">{state.act ? `Act ${ROMAN[state.act]}` : "Not begun"}</span>
        <span className="act-title">{state.actTitle}</span>
      </div>
      <div className={`clock ${carriage ? "urgent" : ""}`} data-tour="clock" title={carriage ? "Until Dr. Vale's carriage leaves" : "Until the next bell"}>
        <span aria-hidden="true">{carriage ? "🐎" : "🔔"}</span> {mmss ?? "—:—"}
      </div>
      <div className="stat" title="Lab tests left">🔬 {state.labTestsLeft}</div>
      <div className="stat" title="Lies caught">🧩 {state.liesCaught}</div>
      <button className="btn small accuse-btn" data-tour="accuse" onClick={onAccuse} disabled={state.phase !== "playing"}>
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
