// Checks that SWITCH_BRIDGE_URL points at the agent bridge (GET /health answers 200).
import { bridgeUrl } from "../src/config.ts";
import { health } from "../src/switch/client.ts";

const base = bridgeUrl();
try {
  const { status, body } = await health(base);
  if (status === 200) console.log(`✓ ${base} is a Switch agent bridge: ${body}`);
  else if (status === 401) console.log(`✗ ${base} answered 401: right host, wrong path. Try the bare host and port.`);
  else console.log(`✗ ${base}/health answered ${status}: ${body}`);
} catch (err) {
  console.log(`✗ Could not reach ${base}: ${(err as Error).message}`);
  console.log("  Is the server running in Switch Console? Is SWITCH_BRIDGE_URL right (often port 8000)?");
  process.exitCode = 1;
}
