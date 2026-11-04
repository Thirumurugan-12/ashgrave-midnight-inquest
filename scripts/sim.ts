// Play Ashgrave in the terminal, no Switch server needed. Uses the real engine and,
// when MODEL_API_KEY is set, real Muse Spark characters.
//
//   npm run sim                 interactive
//   npm run sim -- --demo       plays a scripted solve
//
// Type lines as `name: message` (default name "thiru"), e.g.
//   priya: @game-master join
//   @thomas-reed where were you at eleven?
// `/room <id>` switches room (shared, private-thiru, private-priya). `/quit` exits.

import { createInterface } from "node:readline/promises";
import { blackOrchid } from "../src/case/black-orchid.ts";
import { Game } from "../src/engine/game.ts";
import { mentions } from "../src/engine/match.ts";
import { MuseSpeaker, EchoSpeaker } from "../src/llm.ts";
import { handle, roster, Transcript, type Bus } from "../src/runtime/cast.ts";

const rooms = { shared: "shared", private: { thiru: "private-thiru", priya: "private-priya" } };
const game = new Game(blackOrchid, rooms, { actMinutes: 999, carriageMinutes: 999, labTests: 6 });
const transcript = new Transcript();
const live = Boolean(process.env.MODEL_API_KEY);
const speaker = live ? new MuseSpeaker() : new EchoSpeaker();
const names = roster(blackOrchid).map((m) => m.name);

const bus: Bus = {
  async post(agent, roomId, text) {
    transcript.add(roomId, { name: agent, body: text });
    console.log(`\n\x1b[33m[${roomId}] ${agent}\x1b[0m\n${text}`);
  },
};

let room = "shared";
async function say(line: string): Promise<void> {
  const m = /^([a-z0-9_-]+):\s+(.*)$/i.exec(line);
  const name = m && !m[1]!.startsWith("@") ? m[1]! : "thiru";
  const body = m ? m[2]! : line;
  console.log(`\x1b[36m[${room}] ${name}:\x1b[0m ${body}`);
  transcript.add(room, { name, body });
  for (const agent of names) {
    if (mentions(body, `@${agent}`)) {
      await handle(agent, { roomId: room, senderId: `@${name}`, senderName: name, body }, { game, speaker, bus, transcript, labDelayMs: 300 });
    }
  }
}

const demo = [
  "@game-master join",
  "priya: @game-master join",
  "@game-master start",
  "@game-master search conservatory",
  "@forensics-lab test the orchid",
  "@ghost-of-verity look at your orchid. What do you remember?",
  "@game-master search study",
  "@forensics-lab the tonic bottle",
  "@dr-vale you mixed the tonic. When did you leave tonight?",
  "priya: @mrs-holloway the scullery maid saw you scrubbing a glass at the sink",
  "@game-master next",
  "@game-master search study",
  "@forensics-lab burned letter",
  "@dr-vale the gate ledger says your carriage left at 11:40",
  "@evidence-clerk what contradictions do we have?",
  "priya: @game-master accuse dr vale how: the tonic bottle and the damp glass why: the burned letter",
];

console.log(`Ashgrave simulator · characters: ${live ? "Muse Spark" : "offline echo (set MODEL_API_KEY for real replies)"}`);
if (process.argv.includes("--demo")) {
  for (const line of demo) await say(line);
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const line = (await rl.question(`\n${room}> `)).trim();
    if (line === "/quit") break;
    if (line.startsWith("/room ")) {
      room = line.slice(6).trim();
      continue;
    }
    if (line) await say(line);
  }
  rl.close();
}
