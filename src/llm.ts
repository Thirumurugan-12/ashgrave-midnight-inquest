// In-character replies from Meta's Muse models on Meta Model API.
// Docs: https://dev.meta.ai/docs/protocols/chat-completions.md
// Meta Model API speaks the OpenAI Chat Completions format, so we use the OpenAI SDK
// pointed at https://api.meta.ai/v1 with a Meta API key (MODEL_API_KEY).

import OpenAI from "openai";

export const models = {
  suspect: process.env.MODEL_SUSPECT ?? "muse-spark-1.3",
  ghost: process.env.MODEL_GHOST ?? "muse-spark-1.3",
  clerk: process.env.MODEL_CLERK ?? "muse-spark-1.3",
};

type Effort = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface SpeakRequest {
  model: string;
  /** Standing instructions: persona and rules. */
  system: string;
  /** Instructions that change during the game, such as a broken alibi. */
  situation?: string;
  /** What the character should respond to: recent room transcript plus the new message. */
  prompt: string;
  /** Said instead if the call fails or comes back empty. */
  fallbackLine: string;
  effort?: Effort;
}

export interface Speaker {
  speak(req: SpeakRequest): Promise<string>;
}

/** Tried in order when a model isn't served to this key from where the server runs. */
const FALLBACK_MODELS = ["muse-spark-1.3", "muse-spark-1.2", "muse-spark-1.1"];

export class MuseSpeaker implements Speaker {
  private client: OpenAI;
  /** A requested model that returned 404, mapped to the one that worked instead. */
  private swapped = new Map<string, string>();

  constructor(apiKey = process.env.MODEL_API_KEY) {
    if (!apiKey) throw new Error("MODEL_API_KEY is not set. Add your Meta Model API key to .env.");
    this.client = new OpenAI({ baseURL: process.env.MODEL_BASE_URL ?? "https://api.meta.ai/v1", apiKey, maxRetries: 2 });
  }

  async speak(req: SpeakRequest): Promise<string> {
    // `developer` is Meta's highest-precedence instruction role. The stable persona goes
    // first so repeated calls share a cacheable prefix; the changing situation goes after.
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "developer", content: req.system }];
    if (req.situation) messages.push({ role: "developer", content: req.situation });
    messages.push({ role: "user", content: req.prompt });

    const model = this.swapped.get(req.model) ?? req.model;
    try {
      const res = await this.client.chat.completions.create({
        model,
        // Reasoning tokens count toward max_tokens, so leave room beyond the short reply.
        max_tokens: 2048,
        reasoning_effort: req.effort ?? "low",
        messages,
      });
      const text = res.choices[0]?.message?.content?.trim();
      return text || req.fallbackLine;
    } catch (err) {
      if (err instanceof OpenAI.RateLimitError) return "*(pauses, gathering their thoughts... ask again in a moment)*";
      if (err instanceof OpenAI.NotFoundError) {
        const next = FALLBACK_MODELS[FALLBACK_MODELS.indexOf(model) + 1];
        if (next) {
          console.warn(`Model ${model} not found for this key here; falling back to ${next}`);
          this.swapped.set(req.model, next);
          return this.speak(req);
        }
      }
      if (err instanceof OpenAI.AuthenticationError) {
        console.error("Meta Model API key missing or invalid: check MODEL_API_KEY in .env");
      } else if (err instanceof OpenAI.APIError) {
        console.error(`Meta Model API error ${err.status}: ${err.message}`);
      } else {
        console.error("Model call failed:", err);
      }
      return req.fallbackLine;
    }
  }
}

/** Logs the models this key can use from here, to diagnose "model not found". */
export async function logModels(apiKey = process.env.MODEL_API_KEY): Promise<void> {
  if (!apiKey) return;
  try {
    const res = await fetch(`${process.env.MODEL_BASE_URL ?? "https://api.meta.ai/v1"}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body = (await res.json()) as { data?: Array<{ id: string }> };
    console.log(`Meta models available here (${res.status}): ${(body.data ?? []).map((m) => m.id).join(", ")}`);
  } catch (err) {
    console.warn("Could not list Meta models:", (err as Error).message);
  }
}

/** Offline stand-in for tests and the simulator without an API key. */
export class EchoSpeaker implements Speaker {
  async speak(req: SpeakRequest): Promise<string> {
    const first = req.system.split("\n")[0] ?? "";
    return `[${req.model}] ${first.slice(0, 60)}… ${req.situation ? "(situation: " + req.situation.slice(0, 80) + "…)" : ""}`;
  }
}
