// Runs the whole cast on a Switch server: one WebSocket connection per agent.

import { blackOrchid } from "./case/black-orchid.ts";
import { bridgeUrl, gameOptions, readAgents, readRooms } from "./config.ts";
import { Game } from "./engine/game.ts";
import { mentions } from "./engine/match.ts";
import { EchoSpeaker, MuseSpeaker } from "./llm.ts";
import { handle, roster, Transcript, type Bus, type CastDeps } from "./runtime/cast.ts";
import { UiServer } from "./runtime/ui-server.ts";
import { SwitchAgent, type RoomMessage } from "./switch/client.ts";

const base = bridgeUrl();
const creds = readAgents();
const cast = roster(blackOrchid);
const missing = cast.filter((m) => !creds[m.name]);
if (missing.length) {
  console.error(`Not registered: ${missing.map((m) => m.name).join(", ")}. Run \`npm run register\` first.`);
  process.exit(1);
}

const agents = new Map(cast.map((m) => [m.name, new SwitchAgent(m.name, creds[m.name]!, base)]));
const ourNames = new Set(cast.flatMap((m) => [m.name, m.displayName]));
const recentlyPosted = new Set<string>();
const displayName = new Map(cast.map((m) => [m.name, m.displayName]));
let ui: UiServer | undefined;

const bus: Bus = {
  async post(agent, roomId, text) {
    recentlyPosted.add(text);
    setTimeout(() => recentlyPosted.delete(text), 60_000);
    try {
      await agents.get(agent)!.post(roomId, text);
      ui?.roomMessage(roomId, displayName.get(agent) ?? agent, text, agent);
    } catch (err) {
      console.error(`[${agent}] post failed:`, (err as Error).message);
    }
  },
};

const rooms = readRooms();
const game = new Game(blackOrchid, rooms, gameOptions());
ui = new UiServer(game, rooms);
ui.start();
const transcript = new Transcript();
if (!process.env.MODEL_API_KEY) console.warn("⚠ MODEL_API_KEY not set: characters will give placeholder replies.");
const speaker = process.env.MODEL_API_KEY ? new MuseSpeaker() : new EchoSpeaker();
const deps: CastDeps = { game, speaker, bus, transcript };

// Every agent sees the same room messages; record each one once.
const recorded = new Set<string>();
// One message at a time per agent, so replies come out in order.
const queues = new Map<string, Promise<void>>();

function onMessage(agentName: string, msg: RoomMessage): void {
  const fromUs = ourNames.has(msg.senderName) || recentlyPosted.has(msg.body);
  if (!recorded.has(msg.messageId)) {
    recorded.add(msg.messageId);
    transcript.add(msg.roomId, { name: msg.senderName, body: msg.body });
    console.log(`[${msg.roomId.slice(0, 8)}] ${msg.senderName}: ${msg.body.slice(0, 120)}`);
    if (!fromUs) ui?.roomMessage(msg.roomId, msg.senderName, msg.body);
  }
  if (fromUs) return;
  const addressed = msg.addressed || mentions(msg.body, `@${agentName}`);
  if (!addressed) return;
  const prev = queues.get(agentName) ?? Promise.resolve();
  const next = prev
    .then(() => {
      ui?.setThinking(agentName, true);
      return handle(agentName, { roomId: msg.roomId, senderId: msg.sender, senderName: msg.senderName, body: msg.body }, deps);
    })
    .catch((err) => console.error(`[${agentName}] failed:`, err))
    .finally(() => {
      ui?.setThinking(agentName, false);
      ui?.broadcastState();
    });
  queues.set(agentName, next);
}

for (const [name, agent] of agents) {
  agent.on("ready", (state) => console.log(`✓ ${name} connected (rooms: ${JSON.stringify((state as { rooms?: unknown }).rooms ?? [])})`));
  agent.on("error", (err) => console.error(`✗ ${name}:`, (err as Error).message));
  agent.on("message", (m: RoomMessage) => onMessage(name, m));
  agent.connect();
}

setInterval(() => {
  const posts = game.tick(Date.now());
  for (const p of posts) void bus.post(p.agent, p.roomId, p.text);
  if (posts.length) ui?.broadcastState();
}, 5_000);

const shutdown = () => {
  for (const a of agents.values()) a.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log(`Ashgrave is running against ${base}. Say "@game-master help" in the shared room.`);
