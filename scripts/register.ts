// Registers every agent in the cast once and saves their API keys to .switch-agents.json.
import { blackOrchid } from "../src/case/black-orchid.ts";
import { bridgeUrl, readAgents, writeAgents } from "../src/config.ts";
import { roster } from "../src/runtime/cast.ts";
import { GatewayAdmin } from "../src/switch/gateway.ts";
import { registerAgent, SwitchError } from "../src/switch/client.ts";

const base = bridgeUrl();
const key = process.env.SWITCH_REGISTRATION_KEY;
if (!key) {
  console.error("Set SWITCH_REGISTRATION_KEY in .env (Gateway → API Keys → a key of type registration).");
  process.exit(1);
}

const saved = readAgents();
for (const member of roster(blackOrchid)) {
  if (saved[member.name]) {
    console.log(`• ${member.name} already registered (${saved[member.name]!.id})`);
    continue;
  }
  try {
    const creds = await registerAgent(base, key, {
      name: member.name,
      display_name: member.displayName,
      description: member.description,
    });
    saved[member.name] = creds;
    writeAgents(saved); // save after each one: the API key is only shown once
    console.log(`✓ registered ${member.name} (${creds.id})`);
  } catch (err) {
    if (err instanceof SwitchError && err.status === 409) {
      console.error(`✗ ${member.name} already exists on the server but its key isn't in .switch-agents.json. Delete it in Switch Console or the Gateway, then run this again.`);
    } else {
      console.error(`✗ ${member.name}: ${(err as Error).message}`);
    }
  }
}

// Players are not the agents' owner, so open each agent to anyone in its rooms.
// An agent can't change its own policy; the owner or an admin must.
const admin = await GatewayAdmin.fromInfraEnv(base);
if (!admin) {
  console.log("\nNo Gateway admin credentials found (infra/.env). Open each agent to anyone in Switch Console → agent → Who can talk to your agent.");
} else {
  for (const [name, creds] of Object.entries(saved)) {
    const res = await admin.openAgent(creds.id);
    console.log(res.ok ? `✓ ${name} answers anyone in its rooms` : `✗ ${name} addressing: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
