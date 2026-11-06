import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AgentCredentials } from "./switch/client.ts";
import type { RoomDirectory } from "./engine/game.ts";

export const AGENTS_FILE = ".switch-agents.json";
export const ROOMS_FILE = "rooms.json";

export const bridgeUrl = () => process.env.SWITCH_BRIDGE_URL ?? "http://localhost:8000";

export const gameOptions = () => ({
  actMinutes: Number(process.env.ACT_MINUTES ?? 10),
  carriageMinutes: Number(process.env.CARRIAGE_MINUTES ?? 8),
  labTests: Number(process.env.LAB_TESTS ?? 99),
});

export function readAgents(): Record<string, AgentCredentials> {
  if (!existsSync(AGENTS_FILE)) return {};
  return JSON.parse(readFileSync(AGENTS_FILE, "utf8"));
}

export function writeAgents(agents: Record<string, AgentCredentials>): void {
  writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2) + "\n", { mode: 0o600 });
}

export function readRooms(): RoomDirectory {
  if (!existsSync(ROOMS_FILE)) {
    throw new Error(`${ROOMS_FILE} not found. Run \`npm run rooms\` to list your rooms and create it.`);
  }
  const r = JSON.parse(readFileSync(ROOMS_FILE, "utf8")) as RoomDirectory;
  if (!r.shared) throw new Error(`${ROOMS_FILE} needs a "shared" room id.`);
  r.private = Object.fromEntries(Object.entries(r.private ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return r;
}
