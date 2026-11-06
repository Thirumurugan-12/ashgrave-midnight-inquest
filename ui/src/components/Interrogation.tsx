import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedMessage, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, CLUE_NAMES, ICONS, moodOf, PORTRAITS } from "../data.ts";
import { Md } from "../md.tsx";
import { useTypewriter } from "../typewriter.ts";
import { sound } from "../sound.ts";

const QUESTIONS: Record<string, string[]> = {
  "thomas-reed": ["Where were you at eleven o'clock?", "Tell me about the foxglove.", "What was her ladyship like tonight?"],
  "clara-ashgrave": ["What did you argue about at dinner?", "Where were you after ten?", "What did your aunt say about Friday?"],
  "dr-vale": ["When did you leave tonight?", "What was in her tonic?", "What is digitalis?"],
  "mrs-holloway": ["Walk me through your evening.", "Where is the glass from her tray?", "Has the doctor seemed himself lately?"],
  "ghost-of-verity": ["What do you remember?", "Who was with you at the end?", "I'm stuck. Give me a hint."],
};

interface Item {
  id: string;
  name: string;
  /** Why it can't be used as proof yet, if it can't. */
  blocked?: "test" | "piece";
}

export function Interrogation({
  agent,
  present: preset,
  state,
  feed,
  thinking,
  actions,
  onClose,
}: {
  agent: string;
  present?: string[];
  state: Snapshot;
  feed: FeedMessage[];
  thinking: string[];
  actions: Actions;
  onClose(): void;
}) {
  const isGhost = agent === state.ghost.agent;
  const suspect = state.suspects.find((s) => s.agent === agent);
  const name = isGhost ? state.ghost.name : suspect?.name ?? agent;
  const short = name.startsWith("Dr.") ? "the doctor" : name.split(" ")[0]!;
  const [text, setText] = useState("");
  const [held, setHeld] = useState<string | null>(preset?.[0] ?? null);
  const [stamp, setStamp] = useState(false);
  const [note, setNote] = useState<{ claim: number; text: string; action?: { label: string; run(): void } } | null>(null);
  const [pending, setPending] = useState<{ claim: number; at: number; cracked: number } | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const busy = thinking.includes(agent);

  // This character's side of the room: what was said to them and what they said.
  const log = useMemo(
    () =>
      feed.filter(
        (m) =>
          m.agent === agent ||
          (!m.agent && m.text.toLowerCase().includes(`@${agent}`)) ||
          (m.agent === "game-master" && /Lie caught!/.test(m.text) && m.text.includes(name)),
      ),
    [feed, agent, name],
  );
  const last = [...log].reverse().find((m) => m.agent === agent);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [log.length, busy]);

  // A stamp when a lie breaks while you watch.
  const cracked = suspect?.cracked ?? 0;
  const prevCracked = useRef(cracked);
  useEffect(() => {
    if (cracked > prevCracked.current) {
      setStamp(true);
      setNote(null);
      const t = setTimeout(() => setStamp(false), 2600);
      prevCracked.current = cracked;
      return () => clearTimeout(t);
    }
    prevCracked.current = cracked;
  }, [cracked]);

  // A contradiction that didn't land: once they've answered and nothing broke, say so.
  useEffect(() => {
    if (!pending || busy) return;
    const answered = log.some((m) => m.agent === agent && m.ts >= pending.at);
    if (!answered) return;
    const t = setTimeout(() => {
      if ((suspect?.cracked ?? 0) <= pending.cracked) {
        setNote({ claim: pending.claim, text: "That doesn't break this story. Try another piece of evidence." });
        sound.thud();
      }
      setPending(null);
    }, 700);
    return () => clearTimeout(t);
  }, [pending, busy, log, suspect?.cracked]);

  const mood = moodOf(last?.text, stamp);

  const items: Item[] = [
    ...state.evidence.map((e) => ({
      id: e.id,
      name: e.name,
      blocked: e.puzzle && !e.tested ? ("piece" as const) : e.testable && !e.tested ? ("test" as const) : undefined,
    })),
    ...state.clues.map((c) => ({ id: c.id, name: CLUE_NAMES[c.id] ?? c.id })),
  ];
  const itemOf = (id: string) => items.find((i) => i.id === id);
  const plain = (n: string) => (/^The /.test(n) ? n.replace(/^The /, "the ") : /testimony/.test(n) ? n : `the ${n.toLowerCase()}`);

  const ask = (q: string) => {
    actions.say(`@${agent} ${q}`);
    setText("");
  };

  const contradict = (claimIndex: number, id: string) => {
    const it = itemOf(id);
    const claim = suspect?.claims[claimIndex];
    if (!it || !claim || claim.broken) return;
    setHeld(null);
    if (it.blocked === "test") {
      setNote({ claim: claimIndex, text: `The ${it.name.toLowerCase()} isn't proof until the lab has tested it.`, action: { label: "Send to the lab", run: () => actions.open({ kind: "lab", item: id }) } });
      return;
    }
    if (it.blocked === "piece") {
      setNote({ claim: claimIndex, text: "Piece the letter together first, so you can read it.", action: { label: "Piece it together", run: () => actions.open({ kind: "letter" }) } });
      return;
    }
    setNote(null);
    setPending({ claim: claimIndex, at: Date.now() - 500, cracked: suspect?.cracked ?? 0 });
    actions.say(`@${agent} You told us: "${claim.text}" Then explain this: I have ${plain(it.name)}.`);
  };

  const showGhost = (id: string) => {
    const it = itemOf(id);
    if (it) ask(`Do you remember this? Look: ${plain(it.name)}.`);
  };

  // The latest reply types itself out.
  const typed = useTypewriter(last?.id ?? "", last?.text ?? "");

  return (
    <div className={`overlay talk ${isGhost ? "ghostly" : ""}`} role="dialog" aria-label={`Questioning ${name}`}>
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="talk-layout">
        <div className={`portrait mood-${mood} ${note ? "flinch" : ""}`}>
          <img src={ART(PORTRAITS[agent] ?? "ghost")} alt={name} />
          <div className="portrait-glow" />
          {stamp && <div className="stamp">LIE<br />CAUGHT</div>}
          <div className="nameplate">
            <h2>{name}</h2>
            <p>{isGhost ? "Ask her for a hint, or show her what you found" : suspect?.role}</p>
            {!isGhost && <span className={`mood-chip ${mood}`}>{busy ? "thinking…" : mood}</span>}
          </div>
        </div>

        <div className="dialogue">
          {suspect && (
            <div className="claims" data-tour="claims">
              <p className="eyebrow">{suspect.name.split(" ")[0] === "Dr." ? "His" : "Their"} story · drag evidence onto a line you can disprove</p>
              {suspect.claims.map((c, i) => (
                <div
                  key={i}
                  className={`claim ${c.broken ? "broken" : ""} ${over === i ? "over" : ""} ${note?.claim === i ? "shake" : ""} ${pending?.claim === i ? "pending" : ""}`}
                  onDragOver={(e) => {
                    if (c.broken) return;
                    e.preventDefault();
                    setOver(i);
                  }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    contradict(i, e.dataTransfer.getData("text/plain"));
                  }}
                >
                  <span className="claim-quote">“{c.text}”</span>
                  {c.broken ? (
                    <span className="claim-stamp">LIE</span>
                  ) : held ? (
                    <button className="btn tiny" disabled={busy} onClick={() => contradict(i, held)}>
                      Use {ICONS[held] ?? "🔍"} here
                    </button>
                  ) : null}
                  {note?.claim === i && (
                    <span className="claim-note">
                      {note.text}
                      {note.action && (
                        <button className="btn tiny line" onClick={note.action.run}>{note.action.label}</button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="log">
            {log.length === 0 && (
              <p className="muted intro">
                {isGhost
                  ? "A cold draught. The candles gutter. Ask her for a hint, or show her something you found."
                  : `${name} waits. Tap a question, or prove a line of their story false.`}
              </p>
            )}
            {log.map((m) =>
              m.agent === "game-master" ? (
                <div key={m.id} className="line system">🧩 Lie caught. The story has cracked.</div>
              ) : m.agent === agent ? (
                <div key={m.id} className="line them">
                  <Md text={m.id === last?.id ? typed : m.text} className="md" />
                </div>
              ) : (
                <div key={m.id} className="line you">
                  <span className="who">{m.from}</span> {m.text.replace(new RegExp(`@${agent}\\s*`, "i"), "")}
                </div>
              ),
            )}
            {busy && <div className="line them typing-line">•••</div>}
            <div ref={end} />
          </div>

          <div className="ask">
            <div className="suggest">
              {(QUESTIONS[agent] ?? []).map((q) => (
                <button key={q} className="chip line ask-chip" onClick={() => ask(q)} disabled={busy}>
                  💬 {q}
                </button>
              ))}
            </div>
            {items.length > 0 && (
              <div className="present">
                <span className="eyebrow">{isGhost ? "Show her something" : "Your evidence · drag onto their story, or tap then choose a line"}</span>
                <div className="chips">
                  {items.map((i) => (
                    <button
                      key={i.id}
                      draggable={!isGhost}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", i.id)}
                      className={`chip ev-chip ${held === i.id ? "on" : ""} ${i.blocked ? "blocked" : ""}`}
                      aria-pressed={held === i.id}
                      disabled={busy && isGhost}
                      onClick={() => (isGhost ? showGhost(i.id) : setHeld(held === i.id ? null : i.id))}
                      title={i.blocked === "test" ? "Test it at the lab to use it as proof" : i.blocked === "piece" ? "Piece it together first" : undefined}
                    >
                      {ICONS[i.id] ?? "🔍"} {i.name}
                      {i.blocked && <span className="chip-flag">{i.blocked === "test" ? "🔬" : "🧩"}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) ask(text.trim());
              }}
            >
              <input
                id="talk-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={isGhost ? "Or say something to her…" : `Or ask ${short} your own question…`}
              />
              <button className="btn" disabled={busy || !text.trim()}>Ask</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
