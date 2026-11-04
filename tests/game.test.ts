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
  const clues = posts.filter((p) => p.text.includes("private clue"));
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

test("the lab only tests found evidence and spends tests", () => {
  const { g } = started();
  assert.match(g.lab("@forensics-lab the orchid").text, /Bring me something/);
  g.command(thiru, "room-shared", "@game-master search conservatory", t0);
  const r = g.lab("@forensics-lab please test the black orchid");
  assert.match(r.text, /digitalis/);
  assert.equal(g.labTestsLeft, 5);
  g.lab("@forensics-lab orchid again");
  assert.equal(g.labTestsLeft, 5, "re-testing is free");
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

test("the doctor cannot be questioned after his carriage leaves", () => {
  const { g } = started();
  const vale = g.suspectByAgent("dr-vale")!;
  g.tick(t0 + 10 * 60_000); // act II
  g.tick(t0 + 20 * 60_000); // act III
  assert.equal(g.act, 3);
  assert.equal(g.suspect(vale, "where were you").gone, false);
  g.tick(t0 + 28 * 60_000); // carriage leaves, act IV
  assert.equal(g.act, 4);
  assert.equal(g.suspect(vale, "where were you").gone, true);
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
