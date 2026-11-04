import { useState } from "react";
import type { GameConnection, Snapshot } from "../net.ts";
import { ART } from "../data.ts";

export function Lobby({ state, conn, toured, onTour }: { state: Snapshot; conn: GameConnection; toured: boolean; onTour(): void }) {
  const joined = Boolean(state.you);
  const [pace, setPace] = useState<"quick" | "full">("quick");
  const solo = state.players.length <= 1;

  return (
    <div className="overlay lobby" style={{ backgroundImage: `url(${ART("title")})` }}>
      <div className="lobby-card">
        <p className="eyebrow">The inquest gathers</p>
        <h2>Who investigates tonight?</h2>

        <ol className="seats">
          {state.players.length === 0 && <li className="empty">No detectives yet. Join to take a seat.</li>}
          {state.players.map((p) => (
            <li key={p.name}>
              <span className="seat">Detective {p.seat}</span> {p.name}
              {p.name === conn.username && <span className="you">you</span>}
            </li>
          ))}
        </ol>
        <p className="muted small">
          {solo
            ? "Playing alone works well: you'll hold all four secret clues. Friends can join from their own browser or from #conservatory in Mattermost."
            : "Each detective gets their own secret clues. Decide together what to share."}
        </p>

        <div className="steps">
          <div className={`step-card ${toured ? "done" : "now"}`}>
            <span className="step-n">{toured ? "✓" : "1"}</span>
            <div>
              <b>Learn how to play</b>
              <p>A one-minute tour of the screen.</p>
            </div>
            <button className={`btn ${toured ? "line small" : ""}`} onClick={onTour}>
              {toured ? "Replay tour" : "Take the tour"}
            </button>
          </div>

          <div className={`step-card ${toured && !joined ? "now" : joined ? "done" : ""}`}>
            <span className="step-n">{joined ? "✓" : "2"}</span>
            <div>
              <b>Take your seat</b>
              <p>{joined ? `You are Detective ${state.you!.seat}.` : "Join the inquest as a detective."}</p>
            </div>
            {!joined && (
              <button className="btn" disabled={!toured} onClick={() => conn.say("@game-master join")}>
                Join
              </button>
            )}
          </div>

          <div className={`step-card ${toured && joined ? "now" : ""}`}>
            <span className="step-n">3</span>
            <div>
              <b>Choose the pace</b>
              <div className="pace" role="radiogroup" aria-label="Game length">
                <button role="radio" aria-checked={pace === "quick"} className={pace === "quick" ? "on" : ""} onClick={() => setPace("quick")}>
                  Quick case <span>about 15 min · best for a first game</span>
                </button>
                <button role="radio" aria-checked={pace === "full"} className={pace === "full" ? "on" : ""} onClick={() => setPace("full")}>
                  Full case <span>about 35 min</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <button className="btn big" disabled={!toured || !joined} onClick={() => conn.say(`@game-master start${pace === "quick" ? " quick" : ""}`)}>
          Begin the inquest
        </button>
        {!toured && <p className="muted small center">Take the tour first: it unlocks the inquest.</p>}
      </div>
    </div>
  );
}
