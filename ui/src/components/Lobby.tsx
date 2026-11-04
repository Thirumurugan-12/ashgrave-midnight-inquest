import type { GameConnection, Snapshot } from "../net.ts";
import { ART } from "../data.ts";

export function Lobby({ state, conn }: { state: Snapshot; conn: GameConnection }) {
  const joined = Boolean(state.you);
  return (
    <div className="overlay lobby" style={{ backgroundImage: `url(${ART("title")})` }}>
      <div className="lobby-card">
        <p className="eyebrow">The inquest gathers</p>
        <h2>Who investigates tonight?</h2>
        <ol className="seats">
          {state.players.length === 0 && <li className="empty">No detectives yet.</li>}
          {state.players.map((p) => (
            <li key={p.name}>
              <span className="seat">Detective {p.seat}</span> {p.name}
              {p.name === conn.username && <span className="you">you</span>}
            </li>
          ))}
        </ol>
        <div className="how">
          <div><b>1</b> Search the house and collect evidence.</div>
          <div><b>2</b> Test it in the lab. Show it to the ghost.</div>
          <div><b>3</b> Confront suspects. Catch their lies.</div>
          <div><b>4</b> Name who, how and why before midnight.</div>
        </div>
        <div className="lobby-actions">
          {!joined && (
            <button className="btn big" onClick={() => conn.say("@game-master join")}>
              Join the inquest
            </button>
          )}
          <button className={`btn big ${joined ? "" : "ghosty"}`} onClick={() => conn.say("@game-master start")}>
            Begin the inquest
          </button>
        </div>
        <p className="muted small">Friends can join from their own browser or straight from #conservatory in Mattermost.</p>
      </div>
    </div>
  );
}
