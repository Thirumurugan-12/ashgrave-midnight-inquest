import type { Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, PORTRAITS } from "../data.ts";
import { Md } from "../md.tsx";

export function Verdict({ state, actions }: { state: Snapshot; actions: Actions }) {
  const v = state.verdict!;
  const accused = state.suspects.find((s) => s.id === v.accused);
  const killer = state.suspects.find((s) => s.id === v.killer);
  return (
    <div className="overlay verdict" role="dialog" aria-label="The verdict">
      <div className="verdict-card">
        <div className="verdict-portrait">
          <img src={ART(PORTRAITS[killer?.agent ?? "dr-vale"]!)} alt="" />
          <span className={`verdict-stamp ${v.right ? "right" : "wrong"}`}>{v.right ? "Guilty" : "Innocent"}</span>
        </div>
        <div className="verdict-body">
          <p className="eyebrow">{v.by} names {accused?.name}</p>
          <h2>{v.right ? "You caught the killer." : "The killer walks free."}</h2>
          <ul className="score">
            <li><span>Who</span><b>{v.right ? "+3" : "−2"}</b></li>
            <li><span>How</span><b>{v.howOk ? "+2" : "0"}</b></li>
            <li><span>Why</span><b>{v.whyOk ? "+2" : "0"}</b></li>
            <li><span>Lies caught</span><b>+{v.liesCaught}</b></li>
            <li className="total"><span>Score</span><b>{v.score}</b></li>
          </ul>
          <Md text={v.reveal} className="md reveal" />
          <button className="btn big" onClick={() => actions.say("@game-master reset")}>Play again</button>
        </div>
      </div>
    </div>
  );
}
