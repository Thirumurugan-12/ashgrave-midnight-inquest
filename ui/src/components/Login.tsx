import { useState } from "react";
import type { GameConnection } from "../net.ts";
import { ART } from "../data.ts";
import { sound } from "../sound.ts";

export function Login({ conn }: { conn: GameConnection }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const busy = conn.status === "signing-in" || conn.status === "connecting";

  return (
    <div className="title-screen" style={{ backgroundImage: `url(${ART("title")})` }}>
      <div className="title-rain" aria-hidden="true" />
      <div className="title-card">
        <p className="eyebrow">Ashgrave Manor · All Hallows' Eve, 1889</p>
        <h1>
          Ashgrave
          <span>The Midnight Inquest</span>
        </h1>
        <p className="title-lede">
          Lady Verity Ashgrave lies dead in her conservatory, a black orchid in her hand. Four people in the house are lying
          to you. One of them is a murderer.
        </p>

        {conn.status === "offline" && <p className="notice">Can't reach the game. Is <code>npm start</code> running?</p>}
        {conn.error && <p className="notice">{conn.error}</p>}

        {conn.quickPlayers.length > 0 && (
          <div className="quick">
            {conn.quickPlayers.map((p) => (
              <button
                key={p}
                className="btn big"
                disabled={busy}
                onClick={() => {
                  sound.unlock();
                  conn.login(p);
                }}
              >
                Enter as {p}
              </button>
            ))}
          </div>
        )}

        <details className="signin" open={conn.quickPlayers.length === 0}>
          <summary>Sign in with your Mattermost account</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sound.unlock();
              conn.login(username, password);
            }}
          >
            <label>
              Username
              <input id="mm-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </label>
            <label>
              Password
              <input id="mm-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            <button className="btn" disabled={busy || !username || !password}>
              {busy ? "Opening the doors…" : "Sign in"}
            </button>
          </form>
        </details>

        <p className="title-foot">
          Every suspect is an AI agent in a <strong>Switch</strong> room on Mattermost. What you do here is posted there as you.
        </p>
      </div>
    </div>
  );
}
