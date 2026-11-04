// A minimal client for the Switch agent protocol.
// Spec: https://docs.switchagents.ai/switch-rooms/internals/agent-protocol.md
//   - register once with POST /agents (registration key), keep the API key
//   - open one WebSocket per agent, answer every ping with a pong carrying the cursor
//   - act only on `message` events whose payload.addressed is true
//   - post with POST /agents/{id}/message, call operations with POST /agents/{id}/ops/{name}

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

export interface AgentCredentials {
  id: string;
  api_key: string;
  connection_id?: string;
}

export interface RegisterSpec {
  name: string;
  display_name: string;
  description: string;
}

export interface RoomMessage {
  roomId: string;
  messageId: string;
  sender: string;
  senderName: string;
  body: string;
  addressed: boolean;
  timestamp: number;
  threadId: string | null;
}

export class SwitchError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message);
  }
}

async function request(base: string, path: string, init: RequestInit & { token: string }): Promise<unknown> {
  const res = await fetch(new URL(path, base), {
    ...init,
    headers: {
      Authorization: `Bearer ${init.token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new SwitchError(`${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`, res.status, text);
  return text ? JSON.parse(text) : null;
}

/** Register an agent. The API key in the response is shown once: store it. */
export async function registerAgent(base: string, registrationKey: string, spec: RegisterSpec): Promise<AgentCredentials> {
  const body = {
    name: spec.name,
    display_name: spec.display_name,
    description: spec.description,
    connector_type: "ashgrave",
    integration_profile: {
      connection_model: "always_on",
      message_exchange: true,
      pre_invocation_mediation: [],
      post_invocation_mediation: [],
      event_reporting: [],
    },
  };
  const res = (await request(base, "/agents", { method: "POST", token: registrationKey, body: JSON.stringify(body) })) as AgentCredentials;
  return { id: res.id, api_key: res.api_key };
}

export async function health(base: string): Promise<{ status: number; body: string }> {
  const res = await fetch(new URL("/health", base));
  return { status: res.status, body: (await res.text()).slice(0, 300) };
}

type Frame = Record<string, unknown> & { event?: string; type?: string; data?: Record<string, unknown>; id?: number };

/**
 * One connected agent. Emits:
 *   "message" (RoomMessage) for every message in its rooms (check .addressed)
 *   "ready" (connection_state) after each (re)connect
 *   "error" (Error)
 */
export class SwitchAgent extends EventEmitter {
  readonly connectionId: string;
  private ws?: WebSocket;
  private cursor = 0;
  private generation?: number;
  private stopped = false;
  private retry = 0;
  private seen = new Set<string>();

  constructor(
    readonly name: string,
    private readonly creds: AgentCredentials,
    private readonly base: string,
  ) {
    super();
    this.connectionId = creds.connection_id ?? randomUUID();
  }

  get id(): string {
    return this.creds.id;
  }

  // ---------- HTTP ----------

  /** Call an agent operation, e.g. list_rooms. Arguments go unwrapped in the body. */
  async op<T = unknown>(operation: string, args: Record<string, unknown> = {}, opts: { bindConnection?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.bindConnection) headers["X-Switch-Connection-Id"] = this.connectionId;
    const res = (await request(this.base, `/agents/${this.id}/ops/${operation}`, {
      method: "POST",
      token: this.creds.api_key,
      headers,
      body: JSON.stringify(args),
    })) as { result: T };
    return res.result;
  }

  async listOps(): Promise<Record<string, { description: string; input_schema: unknown }>> {
    const res = (await request(this.base, `/agents/${this.id}/ops`, { method: "GET", token: this.creds.api_key })) as {
      operations: Record<string, { description: string; input_schema: unknown }>;
    };
    return res.operations;
  }

  /** Post into a room. Needs no live connection. */
  async post(roomId: string, content: string): Promise<void> {
    await request(this.base, `/agents/${this.id}/message`, {
      method: "POST",
      token: this.creds.api_key,
      body: JSON.stringify({ room_id: roomId, content }),
    });
  }

  /** Who may address this agent: owner_only | owner_and_owner_agents | anyone. */
  async setAddressing(addressing: "owner_only" | "owner_and_owner_agents" | "anyone"): Promise<void> {
    await this.op("update_agent_detail", { agent_id: this.id, addressing });
  }

  // ---------- WebSocket ----------

  connect(): void {
    this.stopped = false;
    const url = new URL(`/agents/${this.id}/connection/ws`, this.base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("connection_id", this.connectionId);
    url.searchParams.set("scope", "all"); // every room this agent belongs to
    url.searchParams.set("filter", "all"); // we keep the transcript, so we want everything
    url.searchParams.set("start_from", this.cursor > 0 ? String(this.cursor) : "head");
    if (this.generation !== undefined) url.searchParams.set("expected_generation", String(this.generation));
    url.searchParams.set("client", "ashgrave");
    url.searchParams.set("client_version", "0.1.0");

    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${this.creds.api_key}` } });
    this.ws = ws;
    ws.on("message", (raw) => this.onFrame(raw.toString()));
    ws.on("close", (code, reason) => this.onClose(code, reason.toString()));
    ws.on("error", (err) => this.emit("error", err));
  }

  close(): void {
    this.stopped = true;
    this.ws?.close(1000);
  }

  private onFrame(raw: string): void {
    let f: Frame;
    try {
      f = JSON.parse(raw) as Frame;
    } catch {
      return;
    }
    const kind = (f.event ?? f.type) as string | undefined;
    // Answer pings before anything else.
    if (kind === "ping") {
      this.ws?.send(JSON.stringify({ type: "pong", cursor: this.cursor }));
      return;
    }
    const data = (f.data ?? f) as Record<string, unknown>;
    switch (kind) {
      case "connection_state":
        this.retry = 0;
        if (typeof data.generation === "number") this.generation = data.generation;
        if (typeof data.cursor === "number") this.cursor = Math.max(this.cursor, data.cursor);
        this.emit("ready", data);
        return;
      case "gap":
        if (typeof data.resumed_at === "number") this.cursor = data.resumed_at;
        return;
      case "evicted":
      case "refused":
        this.emit("error", new Error(`${this.name}: ${kind} ${JSON.stringify(data)}`));
        if (data.code === "taken_over") this.stopped = true;
        return;
      case "message": {
        if (typeof f.id === "number") this.cursor = Math.max(this.cursor, f.id);
        const p = (data.payload ?? {}) as Record<string, unknown>;
        const msg: RoomMessage = {
          roomId: String(data.room_id),
          messageId: String(p.message_id ?? f.id),
          sender: String(p.sender ?? ""),
          senderName: String(p.sender_name ?? p.sender ?? "someone"),
          body: String(p.body ?? ""),
          addressed: p.addressed === true,
          timestamp: Number(p.timestamp ?? Date.now()),
          threadId: (p.thread_id as string | null) ?? null,
        };
        if (this.seen.has(msg.messageId)) return;
        this.seen.add(msg.messageId);
        this.emit("message", msg);
        return;
      }
      default:
        if (typeof f.id === "number") this.cursor = Math.max(this.cursor, f.id);
    }
  }

  private onClose(code: number, reason: string): void {
    if (this.stopped) return;
    // 4401 bad key, 4403 room can't be served, 4409 taken over or refused: don't loop on those.
    if (code === 4401 || code === 4403 || code === 4409) {
      this.emit("error", new Error(`${this.name}: socket closed ${code} ${reason}`));
      return;
    }
    const delay = Math.min(30_000, 500 * 2 ** this.retry++);
    setTimeout(() => this.connect(), delay);
  }
}
