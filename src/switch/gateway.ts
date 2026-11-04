// Admin calls to the Switch Gateway API (mounted at /gateway on the agent bridge).
// Used only by setup scripts, with the stack's admin credentials from infra/.env.

import { existsSync, readFileSync } from "node:fs";

export function readInfraEnv(path = "infra/.env"): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

export class GatewayAdmin {
  private constructor(private readonly base: string, private readonly cookie: string) {}

  /** Logs in as the stack's Gateway admin, or returns undefined if there are no credentials. */
  static async fromInfraEnv(base: string): Promise<GatewayAdmin | undefined> {
    const env = readInfraEnv();
    if (!env.GATEWAY_ADMIN_EMAIL || !env.GATEWAY_ADMIN_PASSWORD) return undefined;
    const res = await fetch(new URL("/gateway/auth/login", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.GATEWAY_ADMIN_EMAIL, password: env.GATEWAY_ADMIN_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Gateway login failed: ${res.status} ${await res.text()}`);
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return new GatewayAdmin(base, cookie);
  }

  async call(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(new URL(`/gateway${path}`, this.base), {
      method,
      headers: { Cookie: this.cookie, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** No policy means anyone in the agent's rooms may address it. */
  openAgent(agentId: string): Promise<Response> {
    return this.call("PUT", `/agents/${agentId}/addressing-policy`, { policy: null });
  }

  /** Stops Switch posting "Hi! Tag @agent…" when an agent joins a room. */
  disableGreetings(bridgeId: string): Promise<Response> {
    return this.call("PATCH", `/collaborations/${bridgeId}`, { agent_greetings_enabled: false });
  }
}
