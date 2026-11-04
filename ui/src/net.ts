// The live connection to the game process. Everything the player does becomes a
// message in the Switch room (posted to Mattermost as them); everything that
// happens in the room comes back here.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../../src/engine/game.ts";
import type { FeedMessage } from "../../src/runtime/ui-server.ts";

export type { Snapshot, FeedMessage };

export type Status = "connecting" | "signed-out" | "signing-in" | "ready" | "offline";

export interface GameConnection {
  status: Status;
  error: string | null;
  username: string | null;
  quickPlayers: string[];
  mattermostUrl: string | null;
  state: Snapshot | null;
  feed: FeedMessage[];
  privateFeed: FeedMessage[];
  thinking: string[];
  login(username: string, password?: string): void;
  say(text: string, room?: "shared" | "private"): void;
  clearError(): void;
}

export function useGame(): GameConnection {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [quickPlayers, setQuickPlayers] = useState<string[]>([]);
  const [mattermostUrl, setMattermostUrl] = useState<string | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);
  const [feed, setFeed] = useState<FeedMessage[]>([]);
  const [privateFeed, setPrivateFeed] = useState<FeedMessage[]>([]);
  const [thinking, setThinking] = useState<string[]>([]);
  const credentials = useRef<{ username: string; password?: string } | null>(null);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const sock = new WebSocket(`${proto}://${location.host}/ws`);
      ws.current = sock;
      sock.onopen = () => {
        retry = 0;
        // Re-join automatically after a reconnect.
        if (credentials.current) sock.send(JSON.stringify({ type: "login", ...credentials.current }));
      };
      sock.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "welcome":
            setQuickPlayers(msg.quickPlayers ?? []);
            setMattermostUrl(msg.mattermostUrl ?? null);
            if (!credentials.current) setStatus("signed-out");
            break;
          case "ready":
            setUsername(msg.username);
            setStatus("ready");
            setError(null);
            break;
          case "history":
            setFeed(msg.messages);
            break;
          case "message": {
            const m = msg.message as FeedMessage;
            if (m.room === "private") setPrivateFeed((f) => [...f, m]);
            else setFeed((f) => [...f, m].slice(-300));
            break;
          }
          case "thinking":
            setThinking(msg.agents);
            break;
          case "state":
            setState(msg.state);
            break;
          case "error":
            setError(msg.error);
            setStatus((s) => (s === "signing-in" ? "signed-out" : s));
            if (!username) credentials.current = null;
            break;
        }
      };
      sock.onclose = () => {
        if (closed) return;
        setStatus("offline");
        setTimeout(open, Math.min(8000, 500 * 2 ** retry++));
      };
    };
    open();
    return () => {
      closed = true;
      ws.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (payload: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(payload));
  };

  const login = useCallback((u: string, p?: string) => {
    credentials.current = { username: u, password: p };
    setStatus("signing-in");
    send({ type: "login", username: u, password: p });
  }, []);

  const say = useCallback((text: string, room: "shared" | "private" = "shared") => {
    send({ type: "say", text, room });
  }, []);

  return {
    status,
    error,
    username,
    quickPlayers,
    mattermostUrl,
    state,
    feed,
    privateFeed,
    thinking,
    login,
    say,
    clearError: () => setError(null),
  };
}
