// Lists the rooms the game master can see and writes a rooms.json to fill in.
// Also prints the room operations the server offers, so we can automate room setup next.
import { existsSync, writeFileSync } from "node:fs";
import { bridgeUrl, readAgents, ROOMS_FILE } from "../src/config.ts";
import { GM } from "../src/engine/game.ts";
import { SwitchAgent } from "../src/switch/client.ts";

const creds = readAgents()[GM];
if (!creds) {
  console.error("Run `npm run register` first.");
  process.exit(1);
}
const gm = new SwitchAgent(GM, creds, bridgeUrl());

const ops = await gm.listOps();
console.log("Room operations on this server:");
for (const name of Object.keys(ops).filter((n) => /room|participant|invite|add_users/.test(n)).sort()) {
  console.log(`  ${name}: ${JSON.stringify(ops[name]!.input_schema)}`);
}

const rooms = await gm.op("list_rooms");
console.log("\nRooms the game master belongs to:");
console.log(JSON.stringify(rooms, null, 2));

if (!existsSync(ROOMS_FILE)) {
  writeFileSync(ROOMS_FILE, JSON.stringify({ shared: "<room id of #conservatory>", private: { "<your mattermost username>": "<room id>" } }, null, 2) + "\n");
  console.log(`\nWrote ${ROOMS_FILE}. Fill in the room ids from the list above.`);
}
