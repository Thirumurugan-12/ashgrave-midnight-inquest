import { test } from "node:test";
import assert from "node:assert/strict";
import { blackOrchid } from "../src/case/black-orchid.ts";
import { Game } from "../src/engine/game.ts";

const rooms = { shared: "room-shared", private: { thiru: "room-thiru", priya: "room-priya" } };
const opts = { actMinutes: 10, carriageMinutes: 8, labTests: 6 };
const thiru = { id: "@u-thiru", name: "thiru" };
const priya = { id: "@u-priya", name: "priya" };
const t0 = 1_000_000;

function started() {
  const g = new Game(blackOrchid, rooms, opts);
  g.command(thiru, "room-shared", "@game-master join", t0);
  g.command(priya, "room-shared", "@game-master join", t0);
  const posts = g.command(thiru, "room-shared", "@game-master start", t0);
  return { g, posts };
}

test("start deals every private clue into the holders' private rooms", () => {
  const { g, posts } = started();
  assert.equal(g.act, 1);
  const clues = posts.filter((p) => p.text.includes("Your private clue"));
  assert.equal(clues.length, 4);
  assert.deepEqual(new Set(clues.map((p) => p.roomId)), new Set(["room-thiru", "room-priya"]));
});

test("searching reveals only evidence for the current act", () => {
  const { g } = started();
  g.command(thiru, "room-shared", "@game-master search the study", t0);
  assert.ok(g.found.has("tonic-bottle"));
  assert.ok(!g.found.has("burned-letter"), "letter must wait for act II");
  g.command(thiru, "room-shared", "@game-master next", t0);
  g.command(thiru, "room-shared", "@game-master search study", t0);
  assert.ok(g.found.has("burned-letter"));
});

test("the lab only tests found evidence, and the wrong test costs nothing", () => {
  const { g } = started();
  assert.match(g.lab("@forensics-lab the orchid").text, /Bring me something/);
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  const miss = g.lab("@forensics-lab test the black orchid with the ink-and-paper test");
  assert.ok(miss.miss && !miss.tested);
  assert.match(miss.text, /shows nothing/);
  assert.ok(!g.labDone.has("orchid"));
  const r = g.lab("@forensics-lab test the black orchid with Keller's poison test");
  assert.match(r.text, /digitalis/);
  assert.ok(g.labDone.has("orchid"));
  assert.match(g.lab("@forensics-lab please test the tonic tray").text, /digitalis/, "no test named: just run it");
});

test("a lie cracks only on proof, and testimony is unlocked", () => {
  const { g } = started();
  const thomas = g.suspectByAgent("thomas-reed")!;
  g.command(thiru, "room-shared", "@game-master search back-door", t0);
  // Boots found but untested: not proof yet.
  assert.equal(g.suspect(thomas, "explain these muddy boots").fresh.length, 0);
  g.lab("@forensics-lab boots");
  const r = g.suspect(thomas, "the lab says your boots carry greenhouse soil");
  assert.equal(r.fresh.length, 1);
  assert.ok(g.found.has("study-lamp"));
  assert.equal(g.liesCaught, 1);
});

test("private clues are proof as soon as they are dealt", () => {
  const { g } = started();
  const holloway = g.suspectByAgent("mrs-holloway")!;
  const r = g.suspect(holloway, "the scullery maid saw you at the sink");
  assert.equal(r.fresh.length, 1);
  assert.ok(g.found.has("vale-mixed-tonic"));
});

test("timed: the doctor cannot be questioned after his carriage leaves", () => {
  const g = new Game(blackOrchid, rooms, opts);
  g.command(thiru, "room-shared", "@game-master start timed", t0);
  assert.equal(g.pace, "timed");
  const vale = g.suspectByAgent("dr-vale")!;
  g.tick(t0 + 8 * 60_000); // chapter II
  g.tick(t0 + 16 * 60_000); // chapter III
  assert.equal(g.act, 3);
  assert.equal(g.suspect(vale, "where were you").gone, false);
  g.tick(t0 + 22 * 60_000); // carriage leaves
  assert.equal(g.suspect(vale, "where were you").gone, true);
  assert.equal(g.phase, "playing", "you can still accuse");
});

test("the ghost recalls only what she is shown", () => {
  const { g } = started();
  assert.equal(g.ghost("who are you").fresh.length, 1);
  assert.equal(g.ghost("what about the tonic bottle").fresh.length, 0, "not found yet");
  g.command(thiru, "room-shared", "@game-master search study", t0);
  assert.match(g.ghost("look at this tonic bottle").fresh[0]!, /Edmund/);
});

test("a proven accusation scores full marks and ends the game", () => {
  const { g } = started();
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  g.command(thiru, "room-shared", "@game-master next", t0);
  g.command(thiru, "room-shared", "@game-master search study", t0);
  const posts = g.command(priya, "room-shared", "@game-master accuse Dr. Vale how: the tonic bottle why: the burned letter", t0);
  assert.equal(g.phase, "over");
  assert.match(posts[0]!.text, /Score: 7/);
  assert.match(posts[1]!.text, /What really happened/);
});

test("accusing an innocent loses points", () => {
  const { g } = started();
  const posts = g.command(priya, "room-shared", "@game-master accuse thomas how: boots why: crate", t0);
  assert.match(posts[0]!.text, /innocent/);
  assert.match(posts[0]!.text, /Score: -2/);
});

test("the solution only references evidence that exists", () => {
  const ids = new Set([...blackOrchid.evidence.map((e) => e.id), ...blackOrchid.privateClues.map((c) => c.id)]);
  const s = blackOrchid.solution;
  for (const id of [...s.who, ...s.how, ...s.why]) assert.ok(ids.has(id), id);
  for (const sus of blackOrchid.suspects) for (const c of sus.cracks) {
    for (const t of c.triggers) assert.ok(ids.has(t), `${sus.id} trigger ${t}`);
    for (const u of c.unlocks ?? []) assert.ok(ids.has(u), `${sus.id} unlock ${u}`);
  }
  for (const m of blackOrchid.ghost.memories) if (m.trigger !== "none") assert.ok(ids.has(m.trigger), m.trigger);
});

test("no innocent prompt material names the killer as guilty", () => {
  for (const s of blackOrchid.suspects.filter((x) => !x.isKiller)) {
    const all = [s.persona, s.story, s.secret, ...s.knows, ...s.cracks.map((c) => c.admit)].join(" ");
    assert.doesNotMatch(all, /\b(killed|murdered|poisoned)\b/i, s.id);
  }
  const ghost = [blackOrchid.ghost.persona, ...blackOrchid.ghost.memories.map((m) => m.memory)].join(" ");
  assert.doesNotMatch(ghost, /\bVale\b/);
});

test("ordinary questions don't count as presenting evidence", () => {
  const { g } = started();
  const vale = g.suspectByAgent("dr-vale")!;
  g.command(thiru, "room-shared", "@game-master search study", t0);
  g.lab("@forensics-lab the tonic bottle");
  for (const q of [
    "you mixed the tonic. When did you leave tonight?",
    "was it digitalis that stopped her heart?",
    "why is the glass so cold in here?",
  ]) {
    assert.equal(g.suspect(vale, q).fresh.length, 0, q);
  }
  assert.equal(g.suspect(vale, "the lab says your tonic bottle holds twenty times a safe dose").fresh.length, 1);
});

test("the washed glass still cracks the housekeeper once tested", () => {
  const { g } = started();
  const holloway = g.suspectByAgent("mrs-holloway")!;
  g.command(thiru, "room-shared", "@game-master search kitchen", t0);
  g.lab("@forensics-lab the damp glass");
  assert.equal(g.suspect(holloway, "you washed the glass, didn't you?").fresh.length, 1);
});

test("the lab understands loose names and asks when unsure", () => {
  const { g } = started();
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  g.command(thiru, "room-shared", "@game-master search study", t0);
  assert.match(g.lab("@forensics-lab test the tonic").text, /Which one\? .*Tonic tray.*Tonic bottle|Which one\? .*Tonic bottle.*Tonic tray/);
  assert.match(g.lab("@forensics-lab the desk please").text, /surgeon's probe/);
});

test("a player's snapshot never leaks the solution or other players' clues", () => {
  const { g } = started();
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  const snap = g.snapshot("thiru");
  const json = JSON.stringify(snap);
  assert.equal(snap.verdict, null);
  assert.doesNotMatch(json, /What really happened|killer/i);
  assert.ok(snap.evidence.every((e) => e.lab === null), "untested lab results stay hidden");
  const priyaClues = g.snapshot("priya").clues.map((c) => c.id);
  assert.ok(snap.clues.length > 0 && snap.clues.every((c) => !priyaClues.includes(c.id)));
  assert.ok(snap.locations.find((l) => l.id === "conservatory")!.searched);
});

test("story mode has no clock: chapters open when their goals are done", () => {
  const { g } = started();
  assert.equal(g.pace, "story");
  assert.equal(g.snapshot("thiru").nextActAt, null);
  assert.deepEqual(g.tick(t0 + 60 * 60_000), [], "time alone does nothing");
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  g.command(thiru, "room-shared", "@game-master find the tonic bottle", t0);
  assert.equal(g.goals()[0]!.done, true);
  assert.equal(g.act, 1);
  g.lab("@forensics-lab orchid");
  const posts = g.tick(t0);
  assert.equal(g.act, 2);
  assert.ok(posts.some((p) => /Chapter I complete/.test(p.text)));
  assert.ok(posts.some((p) => /Goals/.test(p.text)));
});

test("finding one item at a time marks a room searched only when it is empty", () => {
  const { g } = started();
  assert.match(g.command(thiru, "room-shared", "@game-master find orchid", t0)[0]!.text, /Black orchid/);
  assert.ok(!g.searched.has("conservatory"));
  g.command(thiru, "room-shared", "@game-master find tonic-tray", t0);
  g.command(thiru, "room-shared", "@game-master find writing-desk", t0);
  assert.ok(g.searched.has("conservatory"));
  assert.ok(!g.snapshot("thiru").findable.some((f) => f.location === "conservatory"));
});

test("the burned letter is pieced together by hand and then counts as proof", () => {
  const { g } = started();
  g.command(thiru, "room-shared", "@game-master next", t0);
  g.command(thiru, "room-shared", "@game-master search study", t0);
  const snap = g.snapshot("thiru");
  assert.ok(snap.puzzle && snap.puzzle.pieces.length >= 4);
  assert.equal(snap.evidence.find((e) => e.id === "burned-letter")!.testable, false);
  assert.match(g.lab("@forensics-lab burned letter").text, /fragile/);
  const vale = g.suspectByAgent("dr-vale")!;
  assert.equal(g.suspect(vale, "Explain the burned letter").fresh.length, 0);
  const posts = g.command(thiru, "room-shared", "@game-master restore letter", t0);
  assert.match(posts[0]!.text, /Edmund presented/);
  assert.equal(g.snapshot("thiru").puzzle, null);
  assert.equal(g.suspect(vale, "Explain the burned letter").fresh.length, 1);
  assert.deepEqual(g.snapshot("thiru").links, [{ evidence: "burned-letter", agent: "dr-vale" }]);
});

test("hints point at the next useful step and never name the killer", () => {
  const { g } = started();
  assert.match(g.hint(), /Search/);
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  g.command(thiru, "room-shared", "@game-master search study", t0);
  assert.match(g.hint(), /lab/);
  g.lab("@forensics-lab orchid");
  g.tick(t0);
  assert.equal(g.act, 2);
  assert.match(g.hint(), /study/);
  // Private clues are proof: the hint shows where one breaks a story.
  g.command(thiru, "room-shared", "@game-master search study", t0);
  g.command(thiru, "room-shared", "@game-master restore letter", t0);
  assert.match(g.hint(), /says: "/);
  for (let i = 0; i < 12; i++) assert.doesNotMatch(g.hint(), /killer|murderer|guilty/i);
});

test("the accusation takes multiple-choice answers", () => {
  const { g } = started();
  const snap = g.snapshot("thiru");
  assert.equal(snap.accusation.how.length, 3);
  assert.equal(snap.accusation.why.length, 3);
  g.command(thiru, "room-shared", "@game-master accuse dr vale how: poison why: stolen-work", t0);
  assert.equal(g.verdict!.right && g.verdict!.howOk && g.verdict!.whyOk, true);
  assert.equal(g.verdict!.panels.length, 4);
});

test("a wrong motive loses the why points", () => {
  const { g } = started();
  g.command(thiru, "room-shared", "@game-master accuse vale how: poisoned why: inherit", t0);
  assert.equal(g.verdict!.howOk, true);
  assert.equal(g.verdict!.whyOk, false);
});

test("playing alone deals every private clue to you", () => {
  const g = new Game(blackOrchid, rooms, opts);
  g.command(thiru, "room-shared", "@game-master start", t0);
  assert.equal(g.snapshot("thiru").clues.length, 4);
});
