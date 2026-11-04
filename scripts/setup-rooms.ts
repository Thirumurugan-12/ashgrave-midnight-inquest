// Creates the game's rooms on Switch (which creates matching Mattermost channels)
// and writes rooms.json:
//   • the shared room with every agent and every player
//   • one private room per player with only the game master, for private clues
//
//   PLAYERS=detective,priya npm run setup:rooms
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { blackOrchid } from "../src/case/black-orchid.ts";
import { bridgeUrl, readAgents, ROOMS_FILE } from "../src/config.ts";
import { GM, type RoomDirectory } from "../src/engine/game.ts";
import { roster } from "../src/runtime/cast.ts";
import { SwitchAgent } from "../src/switch/client.ts";
import { GatewayAdmin } from "../src/switch/gateway.ts";

const players = (process.env.PLAYERS ?? "detective").split(",").map((p) => p.trim()).filter(Boolean);
const creds = readAgents()[GM];
if (!creds) {
  console.error("Run `npm run register` first.");
  process.exit(1);
}
const gm = new SwitchAgent(GM, creds, bridgeUrl());

type Bridge = { bridge_id?: string; id?: string; platform?: string; type?: string; name?: string };
const bridgesRaw = await gm.op<unknown>("list_bridges");
const bridges: Bridge[] = Array.isArray(bridgesRaw) ? bridgesRaw : ((bridgesRaw as { bridges?: Bridge[] })?.bridges ?? []);
const mm = bridges.find((b) => JSON.stringify(b).toLowerCase().includes("mattermost"));
const bridgeId = mm?.bridge_id ?? mm?.id;
if (!bridgeId) {
  console.error("No Mattermost bridge found:", JSON.stringify(bridgesRaw));
  process.exit(1);
}
console.log(`Mattermost bridge: ${bridgeId}`);

// Switch greets with "Hi! Tag @agent…" whenever an agent joins a room. That breaks
// the mood, so turn it off before the characters join.
const admin = await GatewayAdmin.fromInfraEnv(bridgeUrl());
const off = await admin?.disableGreetings(bridgeId);
console.log(off?.ok ? "✓ agent greetings off" : `• could not turn greetings off (${off?.status ?? "no admin credentials"})`);

const existing: RoomDirectory = existsSync(ROOMS_FILE) ? JSON.parse(readFileSync(ROOMS_FILE, "utf8")) : { shared: "", private: {} };
const rooms: RoomDirectory = { shared: existing.shared?.match(/^[0-9a-f-]{36}$/) ? existing.shared : "", private: {} };
for (const [k, v] of Object.entries(existing.private ?? {})) if (/^[0-9a-f-]{36}$/.test(v)) rooms.private[k] = v;

async function createRoom(args: Record<string, unknown>): Promise<string> {
  const res = await gm.op<Record<string, unknown>>("create_room", { bridge_id: bridgeId, ...args });
  const id = (res.room_id ?? res.id ?? (res.room as Record<string, unknown> | undefined)?.room_id) as string | undefined;
  if (!id) throw new Error(`create_room returned no id: ${JSON.stringify(res)}`);
  return id;
}

if (!rooms.shared) {
  rooms.shared = await createRoom({
    name: "conservatory",
    description: "Ashgrave Manor, 1889. Lady Verity is dead. Investigate here.",
    agent_names: roster(blackOrchid).map((m) => m.name),
    user_names: players,
    channel_type: "channel_public",
    instructions:
      "A murder mystery game. Players address characters with @mentions. Each character answers only for itself and stays in character.",
  });
  console.log(`✓ shared room ${rooms.shared}`);
} else {
  console.log(`• shared room exists ${rooms.shared}`);
}

for (const p of players) {
  if (rooms.private[p.toLowerCase()]) {
    console.log(`• private room for ${p} exists`);
    continue;
  }
  rooms.private[p.toLowerCase()] = await createRoom({
    name: `clues-${p.toLowerCase()}`,
    description: `Detective ${p}'s private clues. Only you and the game master are here.`,
    agent_names: [GM],
    user_names: [p],
    channel_type: "channel_private",
  });
  console.log(`✓ private room for ${p} ${rooms.private[p.toLowerCase()]}`);
}

writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2) + "\n");
console.log(`✓ wrote ${ROOMS_FILE}`);
