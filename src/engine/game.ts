// The game engine: pure rules and state, no network and no LLM.
// Agents ask it what they are allowed to know; it never hands out the solution.

import type { Case, Crack, Evidence, EvidenceId, GhostMemory, PrivateClue, Suspect } from "../case/types.ts";
import { matchItems, mentions, stripMentions } from "./match.ts";

export interface RoomDirectory {
  /** The shared investigation room, where act openings are posted. */
  shared: string;
  /** Private room per player, keyed by lowercase player name. */
  private: Record<string, string>;
}

export interface Post {
  agent: string;
  roomId: string;
  text: string;
}

export interface Player {
  id: string;
  name: string;
  seat: number;
}

export interface GameOptions {
  actMinutes: number;
  carriageMinutes: number;
  labTests: number;
}

export const GM = "game-master";

export interface Verdict {
  by: string;
  accused: string;
  right: boolean;
  howOk: boolean;
  whyOk: boolean;
  liesCaught: number;
  score: number;
  /** Only filled in once the game is over. */
  reveal: string;
  killer: string;
}

/** What one player's game window may show. Never contains the solution while playing. */
export interface Snapshot {
  phase: Phase;
  pace: "full" | "quick";
  act: number;
  actTitle: string;
  nextActAt: number | null;
  labTestsLeft: number;
  liesCaught: number;
  players: Array<{ name: string; seat: number }>;
  you: { name: string; seat: number } | null;
  locations: Array<{ id: string; label: string; searched: boolean }>;
  evidence: Array<{
    id: string;
    name: string;
    location: string;
    description: string;
    testable: boolean;
    tested: boolean;
    lab: string | null;
    testimony: boolean;
  }>;
  clues: Array<{ id: string; text: string }>;
  suspects: Array<{ id: string; agent: string; name: string; role: string; cracked: number; gone: boolean }>;
  ghost: { agent: string; name: string; memories: string[] };
  verdict: Verdict | null;
}

export type Phase = "lobby" | "playing" | "over";

export class Game {
  phase: Phase = "lobby";
  act = 0;
  players = new Map<string, Player>();
  found = new Set<EvidenceId>();
  labDone = new Set<EvidenceId>();
  /** Private clue id -> player id holding it. */
  dealt = new Map<EvidenceId, string>();
  cracked = new Set<Crack>();
  ghostRecalled = new Set<GhostMemory>();
  valeGone = false;
  labTestsLeft: number;
  searched = new Set<string>();
  verdict?: Verdict;
  /** "quick" shortens the acts so one person can finish a case in about 15 minutes. */
  pace: "full" | "quick" = "full";
  private actStartedAt = 0;
  private nextActAt = Infinity;

  constructor(
    readonly data: Case,
    readonly rooms: RoomDirectory,
    readonly opts: GameOptions,
  ) {
    this.labTestsLeft = opts.labTests;
  }

  // ---------- lookups ----------

  evidence(id: EvidenceId): Evidence | undefined {
    return this.data.evidence.find((e) => e.id === id);
  }
  clue(id: EvidenceId): PrivateClue | undefined {
    return this.data.privateClues.find((c) => c.id === id);
  }
  suspectByAgent(agent: string): Suspect | undefined {
    return this.data.suspects.find((s) => s.agent === agent);
  }
  get liesCaught(): number {
    return this.cracked.size;
  }

  /** Evidence and dealt clues the team can refer to right now. */
  private available(): Array<{ id: string; name?: string; keywords: string[] }> {
    const ev = this.data.evidence.filter((e) => this.found.has(e.id));
    const clues = this.data.privateClues
      .filter((c) => this.dealt.has(c.id))
      .map((c) => ({ id: c.id, keywords: c.keywords }));
    return [...ev, ...clues];
  }

  /** What the text presents. Evidence with a lab result only counts as proof once tested. */
  presented(text: string): { mentioned: EvidenceId[]; proof: Set<EvidenceId> } {
    const mentioned = matchItems(text, this.available()).map((i) => i.id);
    const proof = new Set(
      mentioned.filter((id) => {
        const e = this.evidence(id);
        return !e || !e.lab || this.labDone.has(id) || e.location === "testimony";
      }),
    );
    return { mentioned, proof };
  }

  // ---------- game window ----------

  snapshot(playerName?: string): Snapshot {
    const you = [...this.players.values()].find((p) => p.name.toLowerCase() === playerName?.toLowerCase()) ?? null;
    return {
      phase: this.phase,
      pace: this.pace,
      act: this.act,
      actTitle: this.data.acts.find((a) => a.number === this.act)?.title ?? "",
      nextActAt: Number.isFinite(this.nextActAt) && this.phase === "playing" ? this.nextActAt : null,
      labTestsLeft: this.labTestsLeft,
      liesCaught: this.liesCaught,
      players: [...this.players.values()].map((p) => ({ name: p.name, seat: p.seat })),
      you: you ? { name: you.name, seat: you.seat } : null,
      locations: Object.entries(this.data.locations).map(([id, label]) => ({ id, label, searched: this.searched.has(id) })),
      evidence: [...this.found].map((id) => {
        const e = this.evidence(id)!;
        return {
          id: e.id,
          name: e.name,
          location: e.location,
          description: e.description,
          testable: Boolean(e.lab),
          tested: this.labDone.has(e.id),
          lab: this.labDone.has(e.id) ? (e.lab ?? null) : null,
          testimony: e.location === "testimony",
        };
      }),
      clues: you
        ? this.data.privateClues.filter((c) => this.dealt.get(c.id) === you.id).map((c) => ({ id: c.id, text: c.text }))
        : [],
      suspects: this.data.suspects.map((s) => ({
        id: s.id,
        agent: s.agent,
        name: s.name,
        role: s.role,
        cracked: s.cracks.filter((c) => this.cracked.has(c)).length,
        gone: s.id === this.data.solution.killer && this.valeGone,
      })),
      ghost: { agent: this.data.ghost.agent, name: this.data.ghost.name, memories: [...this.ghostRecalled].map((m) => m.memory) },
      verdict: this.phase === "over" ? (this.verdict ?? null) : null,
    };
  }

  // ---------- game master commands ----------

  /** Handle a message addressed to the game master. */
  command(player: { id: string; name: string }, roomId: string, raw: string, now: number): Post[] {
    const text = stripMentions(raw).toLowerCase();
    const reply = (t: string): Post[] => [{ agent: GM, roomId, text: t }];
    const verb = text.split(" ")[0] ?? "";

    if (verb === "help" || text === "") return reply(this.helpText());
    if (verb === "reset") {
      this.reset();
      return reply("🕯️ A new night at Ashgrave. Everyone say `@game-master join`, then `@game-master start`.");
    }
    if (verb === "join") return reply(this.join(player));
    if (verb === "start") {
      if (this.phase === "lobby") this.pace = mentions(text, "quick") ? "quick" : "full";
      return this.start(player, roomId, now);
    }
    if (this.phase === "lobby") return reply("The inquest has not begun. Everyone say `@game-master join`, then `@game-master start`.");
    if (this.phase === "over") return reply("This case is closed. Say `@game-master reset` to play again.");

    if (verb === "search" || verb === "examine" || verb === "look") return reply(this.search(text.slice(verb.length)));
    if (verb === "case" || verb === "evidence" || verb === "board" || verb === "status") return reply(this.caseFile());
    if (verb === "next") return this.advance(now);
    if (verb === "accuse") return this.accuse(player, roomId, text.slice(verb.length));
    return reply(`I did not understand that. ${this.helpText()}`);
  }

  reset(): void {
    Object.assign(this, new Game(this.data, this.rooms, this.opts));
  }

  helpText(): string {
    return [
      "**Commands**",
      "• `@game-master join`, then `@game-master start`",
      "• `@game-master search <place>`: " + Object.keys(this.data.locations).join(", "),
      "• `@game-master case`: the evidence found so far",
      "• `@game-master next`: move to the next act (host)",
      "• `@game-master accuse <suspect> how: <evidence> why: <evidence>`",
      "• `@forensics-lab <evidence>` · `@ghost-of-verity <question>` · `@<suspect> <question>`",
    ].join("\n");
  }

  private join(player: { id: string; name: string }): string {
    if (this.players.has(player.id)) return `${player.name}, you are already Detective ${this.players.get(player.id)!.seat}.`;
    if (this.phase !== "lobby") return "The inquest is already under way.";
    const seat = this.players.size + 1;
    this.players.set(player.id, { ...player, seat });
    return `${player.name} joins the inquest as **Detective ${seat}**.`;
  }

  private start(player: { id: string; name: string }, roomId: string, now: number): Post[] {
    if (this.phase !== "lobby") return [{ agent: GM, roomId, text: "The inquest is already under way." }];
    if (this.players.size === 0) this.join(player);
    this.phase = "playing";
    const posts: Post[] = [];
    // Deal private clues round-robin over seats.
    const seats = [...this.players.values()].sort((a, b) => a.seat - b.seat);
    for (const clue of this.data.privateClues) {
      const holder = seats[(clue.seat - 1) % seats.length]!;
      this.dealt.set(clue.id, holder.id);
      const privateRoom = this.rooms.private[holder.name.toLowerCase()];
      const text = `🤫 **Your private clue, Detective ${holder.seat}.** Only you can see this. Share it, or keep it.\n\n> ${clue.text}`;
      posts.push({ agent: GM, roomId: privateRoom ?? roomId, text: privateRoom ? text : `(No private room set up for ${holder.name}, so posting here.)\n\n${text}` });
    }
    posts.unshift(...this.beginAct(1, now));
    return posts;
  }

  private beginAct(n: number, now: number): Post[] {
    this.act = n;
    this.actStartedAt = now;
    const act = this.data.acts.find((a) => a.number === n)!;
    const min = 60_000;
    const actMin = this.pace === "quick" ? Math.min(this.opts.actMinutes, 5) : this.opts.actMinutes;
    const carriageMin = this.pace === "quick" ? Math.min(this.opts.carriageMinutes, 4) : this.opts.carriageMinutes;
    if (n === 1 || n === 2) this.nextActAt = now + actMin * min;
    else if (n === 3) this.nextActAt = now + carriageMin * min;
    else this.nextActAt = Infinity;
    const posts: Post[] = [];
    if (n === 4 && !this.valeGone) {
      this.valeGone = true;
      posts.push({ agent: GM, roomId: this.rooms.shared, text: "🐎 *Wheels on the gravel. Dr. Vale's carriage has left Ashgrave.*" });
    }
    const carriage = this.pace === "quick" ? Math.min(this.opts.carriageMinutes, 4) : this.opts.carriageMinutes;
    posts.push({ agent: GM, roomId: this.rooms.shared, text: act.opening.replace("{minutes}", String(carriage)) });
    return posts;
  }

  private advance(now: number): Post[] {
    if (this.act >= 4) return [{ agent: GM, roomId: this.rooms.shared, text: "It is already midnight. Make your accusation." }];
    return this.beginAct(this.act + 1, now);
  }

  /** Call regularly; moves the acts along on the clock. */
  tick(now: number): Post[] {
    if (this.phase !== "playing" || now < this.nextActAt) return [];
    return this.advance(now);
  }

  private search(where: string): string {
    const place = Object.keys(this.data.locations).find(
      (p) => mentions(where, p) || mentions(where, p.replace(/-/g, " ")),
    ) ?? (mentions(where, "clara") ? "clara-room" : mentions(where, "boot room") || mentions(where, "servants") ? "back-door" : undefined);
    if (!place) return `Search where? ${Object.keys(this.data.locations).join(", ")}`;
    this.searched.add(place);
    const items = this.data.evidence.filter(
      (e) => e.location === place && (e.appearsInAct ?? 1) <= this.act,
    );
    const lines = [`🔎 **${this.data.locations[place]}**`];
    if (items.length === 0) lines.push("You find nothing of note. Not yet, at least.");
    for (const e of items) {
      const isNew = !this.found.has(e.id);
      this.found.add(e.id);
      lines.push(`• **${e.name}**${isNew ? " *(new)*" : ""}: ${e.description}`);
    }
    return lines.join("\n");
  }

  caseFile(): string {
    const lines = [`📁 **Case file.** Act ${this.act} · lab tests left: ${this.labTestsLeft} · lies caught: ${this.liesCaught}`];
    if (this.found.size === 0) lines.push("Nothing found yet.");
    for (const id of this.found) {
      const e = this.evidence(id)!;
      const lab = e.lab ? (this.labDone.has(id) ? " · 🔬 tested" : " · untested") : "";
      lines.push(`• ${e.name}${lab}`);
    }
    return lines.join("\n");
  }

  // ---------- forensics lab ----------

  /** The lab's answer. Deterministic: the lab only reports facts in the case file. */
  lab(raw: string): { text: string; tested?: Evidence } {
    if (this.phase !== "playing") return { text: "The lab is closed until the inquest begins." };
    const found = this.data.evidence.filter((e) => this.found.has(e.id) && e.location !== "testimony");
    const text = stripMentions(raw);
    let [e] = matchItems(text, found);
    if (!e) {
      // Be forgiving at the lab bench: "test the tonic" can mean any item with "tonic" in its name.
      const loose = found.filter((f) => f.name.toLowerCase().split(/\W+/).some((w) => w.length > 3 && mentions(text, w)));
      if (loose.length > 1) return { text: `🔬 Which one? ${loose.map((f) => f.name).join(" or ")}.` };
      e = loose[0];
    }
    if (!e) {
      const names = found.map((f) => f.name).join(", ");
      return { text: `🔬 Bring me something you have actually found. ${names ? `On the bench: ${names}.` : "The bench is empty."}` };
    }
    if (!e.lab) return { text: `🔬 **${e.name}**: there is nothing more the lab can tell you.` };
    if (this.labDone.has(e.id)) return { text: `🔬 **${e.name}** (already tested): ${e.lab}` };
    if (this.labTestsLeft <= 0) return { text: "🔬 The reagents are spent. No more tests tonight." };
    this.labTestsLeft--;
    this.labDone.add(e.id);
    return { text: `🔬 **Laboratory report: ${e.name}**\n\n${e.lab}\n\n*Tests left: ${this.labTestsLeft}*`, tested: e };
  }

  // ---------- ghost ----------

  /** Memories the ghost may speak from: everything recalled so far plus anything this message triggers. */
  ghost(raw: string): { memories: string[]; fresh: string[] } {
    const { mentioned } = this.presented(raw);
    const fresh: string[] = [];
    for (const m of this.data.ghost.memories) {
      const hit = m.trigger === "none" || mentioned.includes(m.trigger);
      if (hit && !this.ghostRecalled.has(m)) {
        this.ghostRecalled.add(m);
        fresh.push(m.memory);
      }
    }
    return { memories: [...this.ghostRecalled].map((m) => m.memory), fresh };
  }

  // ---------- suspects ----------

  /** Which of the suspect's lies this message breaks, and what the suspect may now say. */
  suspect(s: Suspect, raw: string): { gone: boolean; admissions: string[]; fresh: Crack[]; unlocked: Evidence[] } {
    if (s.id === this.data.solution.killer && this.valeGone) return { gone: true, admissions: [], fresh: [], unlocked: [] };
    const { proof } = this.presented(raw);
    const fresh: Crack[] = [];
    const unlocked: Evidence[] = [];
    for (const c of s.cracks) {
      if (!this.cracked.has(c) && c.triggers.some((t) => proof.has(t))) {
        this.cracked.add(c);
        fresh.push(c);
        for (const id of c.unlocks ?? []) {
          if (!this.found.has(id)) {
            this.found.add(id);
            unlocked.push(this.evidence(id)!);
          }
        }
      }
    }
    const admissions = s.cracks.filter((c) => this.cracked.has(c)).map((c) => c.admit);
    return { gone: false, admissions, fresh, unlocked };
  }

  // ---------- accusation ----------

  private accuse(player: { id: string; name: string }, roomId: string, rest: string): Post[] {
    const [whoPart = "", afterHow = ""] = rest.split(/\bhow\s*:/);
    const [howPart = "", whyPart = ""] = afterHow.split(/\bwhy\s*:/);
    const suspect = this.data.suspects.find((s) =>
      [s.id, s.agent, s.agent.replace(/-/g, " "), ...s.name.toLowerCase().split(/[\s.]+/).filter((w) => w.length > 2)]
        .some((w) => mentions(whoPart, w)),
    );
    if (!suspect) {
      return [{ agent: GM, roomId, text: "Accuse whom? Name one of: " + this.data.suspects.map((s) => s.id).join(", ") }];
    }
    const how = this.presented(howPart).mentioned;
    const why = this.presented(whyPart).mentioned;
    const sol = this.data.solution;
    const right = suspect.id === sol.killer;
    const howOk = right && how.some((id) => sol.how.includes(id));
    const whyOk = right && why.some((id) => sol.why.includes(id));
    const score = (right ? 3 : -2) + (howOk ? 2 : 0) + (whyOk ? 2 : 0) + this.liesCaught;
    this.phase = "over";
    this.verdict = { by: player.name, accused: suspect.id, right, howOk, whyOk, liesCaught: this.liesCaught, score, reveal: sol.reveal, killer: sol.killer };
    const verdict = right
      ? `✅ **${suspect.name} is the killer.**`
      : `❌ **${suspect.name} is innocent.** The real killer walks free tonight.`;
    const lines = [
      `⚖️ **${player.name} names ${suspect.name}.**`,
      "",
      verdict,
      `• Who: ${right ? "+3" : "−2"}`,
      `• How: ${howOk ? "+2, proven" : right ? "0, not proven" : "0"}`,
      `• Why: ${whyOk ? "+2, proven" : right ? "0, not proven" : "0"}`,
      `• Lies caught: +${this.liesCaught}`,
      `**Score: ${score}**`,
    ];
    return [
      { agent: GM, roomId: this.rooms.shared, text: lines.join("\n") },
      { agent: GM, roomId: this.rooms.shared, text: sol.reveal },
    ];
  }
}
