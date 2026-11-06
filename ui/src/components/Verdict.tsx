import { useEffect, useState } from "react";
import type { Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, PORTRAITS } from "../data.ts";
import { sound } from "../sound.ts";

const PORTRAIT_ART = new Set(["vale", "thomas", "clara", "holloway", "ghost"]);

// The finale: the verdict stamp, then what really happened in four painted panels, then the score.
export function Verdict({ state, actions }: { state: Snapshot; actions: Actions }) {
  const v = state.verdict!;
  const accused = state.suspects.find((s) => s.id === v.accused);
  const killer = state.suspects.find((s) => s.id === v.killer);
  // -1: the verdict itself; 0..n-1: panels; n: the score.
  const [step, setStep] = useState(-1);
  const n = v.panels.length;

  useEffect(() => {
    if (step === -1) {
      if (v.right) sound.bell();
      else sound.sting();
    }
    if (step >= n) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === -1 ? 3200 : 5200);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="overlay verdict" role="dialog" aria-label="The verdict">
      {step === -1 && (
        <div className="verdict-open">
          <img src={ART(PORTRAITS[accused?.agent ?? "dr-vale"]!)} alt="" />
          <p className="eyebrow">{v.by} names {accused?.name}</p>
          <span className={`verdict-stamp big ${v.right ? "right" : "wrong"}`}>{v.right ? "Guilty" : "Innocent"}</span>
          <h2>{v.right ? "You caught the killer." : "The killer walks free."}</h2>
        </div>
      )}

      {step >= 0 && step < n && (
        <div className="panel-stage" key={step} onClick={() => setStep(step + 1)}>
          <div className="panel-art" style={{ backgroundImage: `url(${ART(v.panels[step]!.art)})` }} />
          {PORTRAIT_ART.has(v.panels[step]!.art) && <img className="panel-fg" src={ART(v.panels[step]!.art)} alt="" />}
          <div className="panel-caption">
            <p className="eyebrow">What really happened · {step + 1} of {n}</p>
            <span className="panel-time">{v.panels[step]!.time}</span>
            <p>{v.panels[step]!.text}</p>
          </div>
          <div className="panel-dots">
            {v.panels.map((_, i) => <span key={i} className={i === step ? "on" : i < step ? "done" : ""} />)}
          </div>
          <button className="btn small line panel-skip" onClick={(e) => { e.stopPropagation(); setStep(n); }}>Skip to the score</button>
        </div>
      )}

      {step >= n && (
        <div className="verdict-card">
          <div className="verdict-portrait">
            <img src={ART(PORTRAITS[killer?.agent ?? "dr-vale"]!)} alt="" />
            <span className={`verdict-stamp ${v.right ? "right" : "wrong"}`}>{v.right ? "Caught" : "Escaped"}</span>
          </div>
          <div className="verdict-body">
            <p className="eyebrow">{v.by} named {accused?.name}</p>
            <h2>{v.right ? "Case closed." : `It was ${killer?.name}.`}</h2>
            <ul className="score">
              <li><span>Who</span><b>{v.right ? "+3" : "−2"}</b></li>
              <li><span>How</span><b>{v.howOk ? "+2" : "0"}</b></li>
              <li><span>Why</span><b>{v.whyOk ? "+2" : "0"}</b></li>
              <li><span>Lies caught</span><b>+{v.liesCaught}</b></li>
              <li className="total"><span>Score</span><b>{v.score} / {7 + 6}</b></li>
            </ul>
            <ul className="answers">
              <li className={v.right ? "ok" : "no"}><b>{v.right ? "✓" : "✗"}</b> {accused?.name}</li>
              <li className={v.howOk ? "ok" : "no"}><b>{v.howOk ? "✓" : "✗"}</b> {v.how}</li>
              <li className={v.whyOk ? "ok" : "no"}><b>{v.whyOk ? "✓" : "✗"}</b> {v.why}</li>
            </ul>
            {(!v.right || !v.howOk || !v.whyOk) && (
              <p className="muted small">
                The truth: {killer?.name}. {v.rightHow}. {v.rightWhy}.
              </p>
            )}
            <div className="row">
              <button className="btn line" onClick={() => setStep(0)}>Replay the reveal</button>
              <button className="btn big" onClick={() => actions.say("@game-master reset")}>Play again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
