// The game engine: pure rules and state, no network and no LLM.
// Agents ask it what they are allowed to know; it never hands out the solution.

import type { Case, Choice, Crack, Evidence, EvidenceId, GhostMemory, Goal, PrivateClue, Reagent, RevealPanel, Suspect } from "../case/types.ts";
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

export const REAGENTS: Record<Reagent, { name: string; words: string[] }> = {
  poison: { name: "Keller's poison test", words: ["poison", "keller", "keller's"] },
  soil: { name: "soil sieve", words: ["soil", "sieve", "earth"] },
  ink: { name: "ink-and-paper test", words: ["ink", "paper"] },
  metal: { name: "metal-trace powder", words: ["metal", "powder", "tool marks", "trace"] },
};

export type Pace = "story" | "timed";

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
  how: string;
  why: string;
  rightHow: string;
  rightWhy: string;
  panels: RevealPanel[];
}

/** What one player's game window may show. Never contains the solution while playing. */
export interface Snapshot {
  phase: Phase;
  pace: Pace;
  act: number;
  chapters: number;
  actTitle: string;
  goals: Array<{ text: string; done: boolean; have?: number; need?: number }>;
  /** 0 to 100: a rough sense of how much of the case is uncovered. */
  progress: number;
  /** Evidence still hidden but findable right now, so the scene can show a glint where it lies. */
  findable: Array<{ id: string; location: string }>;
  /** Pieces of a fragile item to put back together by hand, shuffled by the window. */
  puzzle: { id: string; name: string; pieces: string[] } | null;
  /** Evidence that broke a suspect's lie: strings on the evidence board. */
  links: Array<{ evidence: string; agent: string }>;
  accusation: { how: Array<{ id: string; text: string }>; why: Array<{ id: string; text: string }> };
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
    puzzle: boolean;
    lab: string | null;
    testimony: boolean;
  }>;
  clues: Array<{ id: string; text: string }>;
  suspects: Array<{
    id: string;
    agent: string;
    name: string;
    role: string;
    cracked: number;
    gone: boolean;
    /** Their story, one lie per line; broken ones are marked. */
    claims: Array<{ text: string; broken: boolean }>;
  }>;
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
  /** Which evidence broke each lie. */
  crackedBy = new Map<Crack, EvidenceId>();
  ghostRecalled = new Set<GhostMemory>();
  valeGone = false;
  labTestsLeft: number;
  searched = new Set<string>();
  verdict?: Verdict;
  /** "story" moves on when the chapter's goals are done; "timed" also puts a clock on each chapter. */
  pace: Pace = "story";
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
      chapters: this.data.acts.length,
      actTitle: this.data.acts.find((a) => a.number === this.act)?.title ?? "",
      goals: this.goals(),
      progress: this.progress(),
      findable: this.phase === "playing" ? this.findable().map((e) => ({ id: e.id, location: e.location })) : [],
      puzzle: this.puzzle(),
      links: [...this.crackedBy].map(([c, ev]) => ({
        evidence: ev,
        agent: this.data.suspects.find((s) => s.cracks.includes(c))!.agent,
      })),
      accusation: {
        how: this.data.accusation.how.map((c) => ({ id: c.id, text: c.text })),
        why: this.data.accusation.why.map((c) => ({ id: c.id, text: c.text })),
      },
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
          testable: Boolean(e.lab) && !e.puzzle,
          tested: this.labDone.has(e.id),
          puzzle: Boolean(e.puzzle),
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
        claims: s.cracks.map((c) => ({ text: c.claim, broken: this.cracked.has(c) })),
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
      if (this.phase === "lobby") this.pace = mentions(text, "timed") || mentions(text, "hard") ? "timed" : "story";
      return this.start(player, roomId, now);
    }
    if (this.phase === "lobby") return reply("The inquest has not begun. Everyone say `@game-master join`, then `@game-master start`.");
    if (this.phase === "over") return reply("This case is closed. Say `@game-master reset` to play again.");

    if (verb === "search" || verb === "look") return reply(this.search(text.slice(verb.length)));
    if (verb === "find" || verb === "examine" || verb === "inspect") return reply(this.find(text.slice(verb.length)));
    if (verb === "restore" || verb === "piece") return this.restore(player, roomId, text.slice(verb.length));
    if (verb === "hint") return reply(`🕯️ ${this.hint()}`);
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
      "• `@game-master restore letter`: piece the burned letter together",
      "• `@game-master hint` (or ask `@ghost-of-verity` for one)",
      "• `@game-master case`: the evidence found so far",
      "• `@game-master next`: skip to the next chapter (host)",
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

  private chapterMinutes(n: number): number {
    return n === this.data.acts.length ? Math.min(this.opts.carriageMinutes, 6) : Math.min(this.opts.actMinutes, 8);
  }

  private beginAct(n: number, now: number): Post[] {
    this.act = n;
    this.actStartedAt = now;
    const act = this.data.acts.find((a) => a.number === n)!;
    this.nextActAt = this.pace === "timed" ? now + this.chapterMinutes(n) * 60_000 : Infinity;
    let opening = act.opening;
    if (this.pace === "timed" && n === this.data.acts.length) {
      opening += `\n\n⏳ He leaves in **${this.chapterMinutes(n)} minutes**, and after that he answers no more questions.`;
    }
    const goals = act.goals.map((g) => `☐ ${g.text}`).join("\n");
    return [{ agent: GM, roomId: this.rooms.shared, text: `${opening}\n\n**Goals**\n${goals}` }];
  }

  private advance(now: number): Post[] {
    if (this.act >= this.data.acts.length) {
      return [{ agent: GM, roomId: this.rooms.shared, text: "It is already midnight. Make your accusation." }];
    }
    return this.beginAct(this.act + 1, now);
  }

  /** Call regularly: moves to the next chapter when its goals are done, or (timed) when its clock runs out. */
  tick(now: number): Post[] {
    if (this.phase !== "playing") return [];
    const last = this.act >= this.data.acts.length;
    if (!last && this.goals().every((g) => g.done)) {
      return [{ agent: GM, roomId: this.rooms.shared, text: `✅ **Chapter ${roman(this.act)} complete.**` }, ...this.advance(now)];
    }
    if (now < this.nextActAt) return [];
    if (last) {
      this.nextActAt = Infinity;
      this.valeGone = true;
      return [{ agent: GM, roomId: this.rooms.shared, text: "🐎 *Wheels on the gravel. Dr. Vale's carriage has left Ashgrave.* He will answer no more questions, but you can still name the killer." }];
    }
    return this.advance(now);
  }

  // ---------- chapters ----------

  goals(): Snapshot["goals"] {
    const act = this.data.acts.find((a) => a.number === this.act);
    if (!act) return [];
    return act.goals.map((g) => this.goalState(g));
  }

  private goalState(g: Goal): Snapshot["goals"][number] {
    const physical = [...this.found].filter((id) => this.evidence(id)?.location !== "testimony").length;
    const tested = [...this.labDone].filter((id) => !this.evidence(id)?.puzzle).length;
    const restored = this.data.evidence.filter((e) => e.puzzle).every((e) => this.labDone.has(e.id));
    switch (g.kind) {
      case "found":
        return { text: g.text, done: physical >= (g.count ?? 1), have: Math.min(physical, g.count ?? 1), need: g.count ?? 1 };
      case "tested":
        return { text: g.text, done: tested >= (g.count ?? 1), have: Math.min(tested, g.count ?? 1), need: g.count ?? 1 };
      case "lies":
        return { text: g.text, done: this.liesCaught >= (g.count ?? 1), have: Math.min(this.liesCaught, g.count ?? 1), need: g.count ?? 1 };
      case "restored":
        return { text: g.text, done: restored };
      case "accused":
        return { text: g.text, done: this.phase === "over" };
    }
  }

  progress(): number {
    const physical = this.data.evidence.filter((e) => e.location !== "testimony");
    const testable = physical.filter((e) => e.lab);
    const cracks = this.data.suspects.flatMap((s) => s.cracks);
    const found = physical.filter((e) => this.found.has(e.id)).length / physical.length;
    const tested = testable.filter((e) => this.labDone.has(e.id)).length / testable.length;
    const lies = this.cracked.size / cracks.length;
    return Math.round(found * 30 + tested * 25 + lies * 45);
  }

  /** Unfound evidence that searching could turn up right now. */
  findable(): Evidence[] {
    return this.data.evidence.filter(
      (e) => e.location !== "testimony" && !this.found.has(e.id) && (e.appearsInAct ?? 1) <= this.act,
    );
  }

  private puzzle(): Snapshot["puzzle"] {
    const e = this.data.evidence.find((x) => x.puzzle && this.found.has(x.id) && !this.labDone.has(x.id));
    if (!e || !e.lab) return null;
    return { id: e.id, name: e.name, pieces: pieces(e.lab, 5) };
  }

  /** Someone pieced a fragile item back together. */
  private restore(player: { name: string }, roomId: string, what: string): Post[] {
    const candidates = this.data.evidence.filter((e) => e.puzzle && this.found.has(e.id));
    const e = candidates.find((c) => matchItems(what, [c]).length > 0) ?? candidates[0];
    if (!e) return [{ agent: GM, roomId, text: "There is nothing to piece together yet." }];
    if (this.labDone.has(e.id)) return [{ agent: GM, roomId, text: `📜 The ${e.name.toLowerCase()} is already restored:\n\n> ${e.lab}` }];
    this.labDone.add(e.id);
    return [{ agent: GM, roomId: this.rooms.shared, text: `📜 **${player.name} pieced the ${e.name.toLowerCase()} back together.** It reads:\n\n> ${e.lab}` }];
  }

  /** One nudge toward the next useful thing to do. Never names the killer. */
  hint(): string {
    if (this.phase === "lobby") return "Join the inquest and begin.";
    if (this.phase === "over") return "The case is closed.";
    const label = (place: string) => this.data.locations[place]!.replace(/[.,].*$/, "").replace(/^The /, "the ");
    const physicalFound = [...this.found].filter((id) => this.evidence(id)?.location !== "testimony").length;
    const hidden = this.findable();

    if (this.act === 1 && physicalFound < 4 && hidden[0]) return `Search ${label(hidden[0].location)}. Something there is waiting to be found.`;
    const untested = [...this.found].map((id) => this.evidence(id)!).find((e) => e.lab && !e.puzzle && !this.labDone.has(e.id));
    if (this.act === 1 && untested) return `Take the ${untested.name.toLowerCase()} to the lab and try the ${REAGENTS[untested.reagent ?? "poison"].name}.`;
    const letter = this.data.evidence.find((e) => e.puzzle && (e.appearsInAct ?? 1) <= this.act);
    if (letter && !this.found.has(letter.id)) return `Search ${label(letter.location)} again: the fireplace hides something.`;
    if (letter && !this.labDone.has(letter.id)) return `Piece the ${letter.name.toLowerCase()} together. It is in your case file.`;

    const proofs = new Set([...this.found, ...this.dealt.keys()].filter((id) => {
      const e = this.evidence(id);
      return !e || !e.lab || this.labDone.has(id) || e.location === "testimony";
    }));
    for (const s of this.data.suspects) {
      if (s.id === this.data.solution.killer && this.valeGone) continue;
      for (const c of s.cracks) {
        if (this.cracked.has(c)) continue;
        const proof = c.triggers.find((t) => proofs.has(t));
        if (proof) return `${s.name} says: "${c.claim}" But the ${this.itemName(proof)} says otherwise. Show it to ${s.name.split(" ")[0] === "Dr." ? "the doctor" : s.name.split(" ")[0]}.`;
      }
    }
    for (const s of this.data.suspects) {
      for (const c of s.cracks) {
        if (this.cracked.has(c)) continue;
        const raw = c.triggers.map((t) => this.evidence(t)).find((e) => e && this.found.has(e.id) && e.lab && !this.labDone.has(e.id));
        if (raw) return `Have the lab test the ${raw.name.toLowerCase()}: it could break ${s.name}'s story.`;
      }
    }
    if (hidden[0]) return `Search ${label(hidden[0].location)}. You have not found everything there.`;
    if (this.act < this.data.acts.length) return "Question the household. Ask each of them where they were.";
    return "You know enough. Name the killer, how and why.";
  }

  private itemName(id: EvidenceId): string {
    const e = this.evidence(id);
    if (e) return e.name.toLowerCase().replace(/'s testimony: /, "'s word about ");
    const c = this.clue(id);
    return c ? `private clue about the ${c.keywords[0]}` : id;
  }

  /** Find one hidden item (the hidden-object search in the game window). */
  private find(what: string): string {
    const hidden = this.findable();
    const e = hidden.find((x) => mentions(what, x.id) || mentions(what, x.id.replace(/-/g, " "))) ?? matchItems(what, hidden)[0];
    if (!e) return this.search(what);
    this.found.add(e.id);
    if (!this.findable().some((x) => x.location === e.location)) this.searched.add(e.location);
    return `🔎 **${e.name}** *(new)*: ${e.description}`;
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
    const lines = [`📁 **Case file.** Chapter ${roman(this.act)} · lies caught: ${this.liesCaught} · case ${this.progress()}% uncovered`];
    if (this.found.size === 0) lines.push("Nothing found yet.");
    for (const id of this.found) {
      const e = this.evidence(id)!;
      const lab = e.lab ? (this.labDone.has(id) ? " · 🔬 tested" : " · untested") : "";
      lines.push(`• ${e.name}${lab}`);
    }
    return lines.join("\n");
  }

  // ---------- forensics lab ----------

  /** The lab's answer. Deterministic: the lab only reports facts in the case file.
   *  Naming a test ("poison", "soil", "ink", "metal") runs that test; the wrong one shows nothing. */
  lab(raw: string): { text: string; tested?: Evidence; miss?: Evidence } {
    if (this.phase !== "playing") return { text: "The lab is closed until the inquest begins." };
    const found = this.data.evidence.filter((e) => this.found.has(e.id) && e.location !== "testimony");
    const text = stripMentions(raw);
    const reagent = (Object.keys(REAGENTS) as Reagent[]).find((r) => REAGENTS[r].words.some((w) => mentions(text, w)));
    // Reagent words must not pick the item ("ink" is not evidence), so match on the text without them.
    const itemText = reagent ? REAGENTS[reagent].words.reduce((t, w) => t.replace(new RegExp(`\\b${w}\\b`, "gi"), " "), text) : text;
    let [e] = matchItems(itemText, found);
    if (!e) {
      // Be forgiving at the lab bench: "test the tonic" can mean any item with "tonic" in its name.
      const loose = found.filter((f) => f.name.toLowerCase().split(/\W+/).some((w) => w.length > 3 && mentions(itemText, w)));
      if (loose.length > 1) return { text: `🔬 Which one? ${loose.map((f) => f.name).join(" or ")}.` };
      e = loose[0];
    }
    if (!e) {
      const names = found.map((f) => f.name).join(", ");
      return { text: `🔬 Bring me something you have actually found. ${names ? `On the bench: ${names}.` : "The bench is empty."}` };
    }
    if (e.puzzle) {
      if (this.labDone.has(e.id)) return { text: `🔬 **${e.name}** (restored): ${e.lab}` };
      return { text: `🔬 The ${e.name.toLowerCase()} is far too fragile for reagents. Piece it together by hand (\`@game-master restore letter\`).` };
    }
    if (!e.lab) return { text: `🔬 **${e.name}**: there is nothing more the lab can tell you.` };
    if (this.labDone.has(e.id)) return { text: `🔬 **${e.name}** (already tested): ${e.lab}` };
    if (reagent && e.reagent && reagent !== e.reagent) {
      return { text: `🔬 The ${REAGENTS[reagent].name} shows nothing on the ${e.name.toLowerCase()}. Try another test.`, miss: e };
    }
    this.labDone.add(e.id);
    const how = e.reagent ? ` (${REAGENTS[e.reagent].name})` : "";
    return { text: `🔬 **Laboratory report: ${e.name}**${how}\n\n${e.lab}`, tested: e };
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
      const by = c.triggers.find((t) => proof.has(t));
      if (!this.cracked.has(c) && by) {
        this.cracked.add(c);
        this.crackedBy.set(c, by);
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
    const sol = this.data.solution;
    const pick = (part: string, choices: Choice[]) =>
      choices.find((c) => mentions(part, c.id) || c.keywords.some((k) => mentions(part, k)));
    const howChoice = pick(howPart, this.data.accusation.how);
    const whyChoice = pick(whyPart, this.data.accusation.why);
    // Chat players may name evidence instead of a choice; that still counts.
    const howEv = this.presented(howPart).mentioned;
    const whyEv = this.presented(whyPart).mentioned;
    const right = suspect.id === sol.killer;
    const howOk = right && (howChoice ? howChoice.id === sol.howChoice : howEv.some((id) => sol.how.includes(id)));
    const whyOk = right && (whyChoice ? whyChoice.id === sol.whyChoice : whyEv.some((id) => sol.why.includes(id)));
    const score = (right ? 3 : -2) + (howOk ? 2 : 0) + (whyOk ? 2 : 0) + this.liesCaught;
    const text = (cs: Choice[], id: string) => cs.find((c) => c.id === id)!.text;
    this.phase = "over";
    this.verdict = {
      by: player.name,
      accused: suspect.id,
      right,
      howOk,
      whyOk,
      liesCaught: this.liesCaught,
      score,
      reveal: sol.reveal,
      killer: sol.killer,
      how: howChoice?.text ?? (howPart.trim() || "not given"),
      why: whyChoice?.text ?? (whyPart.trim() || "not given"),
      rightHow: text(this.data.accusation.how, sol.howChoice),
      rightWhy: text(this.data.accusation.why, sol.whyChoice),
      panels: sol.panels,
    };
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

const roman = (n: number) => ["", "I", "II", "III", "IV", "V"][n] ?? String(n);

/** Split a text into about n pieces at word boundaries, in reading order. */
export function pieces(text: string, n: number): string[] {
  const words = text.split(/\s+/);
  const size = Math.ceil(words.length / n);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(" "));
  return out;
}
