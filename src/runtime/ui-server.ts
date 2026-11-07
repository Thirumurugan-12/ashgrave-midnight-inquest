// The game window's server: serves the built UI and a WebSocket per browser.
//
// The window never talks to the characters directly. Every action a player takes
// is posted into the Switch room in Mattermost *as that player*, so the agents
// receive it exactly as if it were typed in chat. Replies come back through Switch
// and are pushed to the window. Switch stays the hub: the game window is a view.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { Game, RoomDirectory } from "../engine/game.ts";
import { readInfraEnv } from "../switch/gateway.ts";

export interface FeedMessage {
  id: string;
  room: "shared" | "private";
  from: string;
  /** Set when a character or the game master wrote it. */
  agent?: string;
  text: string;
  ts: number;
}

interface Session {
  ws: WebSocket;
  username?: string;
  token?: string;
  channels?: { shared: string; private?: string };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

export class UiServer {
  private sessions = new Set<Session>();
  private feed: FeedMessage[] = [];
  private thinking = new Map<string, number>();
  private readonly mm: string;
  /** Where people open Mattermost; differs from mm when the server reaches it on a private network. */
  private readonly mmPublic: string;
  private readonly team: string;
  private readonly infra = readInfraEnv();
  private seq = 0;

  constructor(
    private readonly game: Game,
    private readonly rooms: RoomDirectory,
    private readonly port = Number(process.env.PORT ?? process.env.UI_PORT ?? 5180),
    private readonly distDir = "ui/dist",
  ) {
    this.mm = process.env.MATTERMOST_URL ?? `http://localhost:${this.infra.MATTERMOST_HOST_PORT ?? 8065}`;
    this.mmPublic = process.env.MATTERMOST_PUBLIC_URL ?? this.mm;
    this.team = process.env.MATTERMOST_TEAM ?? this.infra.MATTERMOST_TEAM_NAME ?? "ashgrave";
  }

  start(): void {
    const http = createServer((req, res) => this.serveStatic(req, res));
    const wss = new WebSocketServer({ server: http, path: "/ws" });
    wss.on("connection", (ws) => this.onConnection(ws));
    http.listen(this.port, () => console.log(`🎮 Game window: http://localhost:${this.port}`));
  }

  // ---------- events from the game process ----------

  /** A message appeared in a room (from a person or one of our agents). */
  roomMessage(roomId: string, from: string, text: string, agent?: string): void {
    const room = this.roomKind(roomId);
    if (!room) return;
    const msg: FeedMessage = { id: `m${++this.seq}`, room: room.kind, from, agent, text, ts: Date.now() };
    if (room.kind === "shared") {
      this.feed.push(msg);
      if (this.feed.length > 300) this.feed.splice(0, this.feed.length - 300);
    }
    if (agent) this.thinking.delete(agent);
    for (const s of this.sessions) {
      if (room.kind === "private" && s.username?.toLowerCase() !== room.player) continue;
      this.send(s, { type: "message", message: msg });
    }
    this.broadcastState();
  }

  setThinking(agent: string, on: boolean): void {
    if (on) this.thinking.set(agent, Date.now());
    else this.thinking.delete(agent);
    for (const s of this.sessions) this.send(s, { type: "thinking", agents: [...this.thinking.keys()] });
  }

  broadcastState(): void {
    for (const s of this.sessions) this.send(s, { type: "state", state: this.game.snapshot(s.username) });
  }

  // ---------- browser sessions ----------

  private onConnection(ws: WebSocket): void {
    const s: Session = { ws };
    this.sessions.add(s);
    ws.on("close", () => this.sessions.delete(s));
    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      this.onClientMessage(s, msg).catch((err) => this.send(s, { type: "error", error: (err as Error).message }));
    });
    this.send(s, {
      type: "welcome",
      quickPlayers: this.quickPlayers(),
      mattermostUrl: `${this.mmPublic}/${this.team}/channels/conservatory`,
    });
  }

  private async onClientMessage(s: Session, msg: Record<string, unknown>): Promise<void> {
    switch (msg.type) {
      case "login": {
        const username = String(msg.username ?? "").trim();
        const password = msg.password ? String(msg.password) : this.localPassword(username);
        if (!username || !password) throw new Error("Enter your Mattermost username and password.");
        await this.login(s, username, password);
        this.send(s, { type: "ready", username: s.username, mattermostUrl: `${this.mmPublic}/${this.team}/channels/conservatory` });
        this.send(s, { type: "history", messages: this.feed });
        this.send(s, { type: "thinking", agents: [...this.thinking.keys()] });
        this.send(s, { type: "state", state: this.game.snapshot(s.username) });
        return;
      }
      case "say": {
        if (!s.token || !s.channels) throw new Error("Sign in first.");
        const text = String(msg.text ?? "").trim();
        if (!text) return;
        const channel = msg.room === "private" ? s.channels.private : s.channels.shared;
        if (!channel) throw new Error("You have no private room yet. Ask the host to run setup:rooms for you.");
        await this.mmFetch(s.token, "/api/v4/posts", { method: "POST", body: JSON.stringify({ channel_id: channel, message: text }) });
        return;
      }
    }
  }

  // ---------- Mattermost ----------

  private async login(s: Session, username: string, password: string): Promise<void> {
    const res = await fetch(`${this.mm}/api/v4/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: username, password }),
    });
    if (!res.ok) throw new Error("Mattermost didn't accept that username and password.");
    const token = res.headers.get("token");
    const user = (await res.json()) as { username: string };
    if (!token) throw new Error("Mattermost returned no session token.");
    s.token = token;
    s.username = user.username;
    const shared = await this.channelId(token, "conservatory");
    const priv = await this.channelId(token, `clues-${user.username.toLowerCase()}`).catch(() => undefined);
    if (!shared) throw new Error("You aren't in #conservatory. Ask the host to add you (setup:rooms).");
    s.channels = { shared, private: priv };
  }

  private async channelId(token: string, name: string): Promise<string | undefined> {
    const res = await fetch(`${this.mm}/api/v4/teams/name/${this.team}/channels/name/${name}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { id: string }).id;
  }

  private async mmFetch(token: string, path: string, init: RequestInit): Promise<unknown> {
    const res = await fetch(`${this.mm}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Mattermost ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  /** On a local stack, the seeded player can join with one click. */
  private quickPlayers(): string[] {
    return this.infra.MATTERMOST_USER && this.infra.MATTERMOST_USER_PASSWORD ? [this.infra.MATTERMOST_USER] : [];
  }

  private localPassword(username: string): string | undefined {
    return username === this.infra.MATTERMOST_USER ? this.infra.MATTERMOST_USER_PASSWORD : undefined;
  }

  // ---------- helpers ----------

  private roomKind(roomId: string): { kind: "shared" } | { kind: "private"; player: string } | undefined {
    if (roomId === this.rooms.shared) return { kind: "shared" };
    const entry = Object.entries(this.rooms.private).find(([, id]) => id === roomId);
    return entry ? { kind: "private", player: entry[0] } : undefined;
  }

  private send(s: Session, payload: unknown): void {
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(JSON.stringify(payload));
  }

  private serveStatic(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", "http://x");
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(this.distDir, rel);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(this.distDir, "index.html");
    if (!existsSync(file)) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("The game window isn't built yet. Run: npm run ui:build");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  }
}
