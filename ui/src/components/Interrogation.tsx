import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedMessage, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, CLUE_NAMES, ICONS, moodOf, PORTRAITS } from "../data.ts";
import { Md } from "../md.tsx";
import { useTypewriter } from "../typewriter.ts";

const QUESTIONS: Record<string, string[]> = {
  "thomas-reed": ["Where were you at eleven o'clock?", "Tell me about the foxglove.", "Why are your boots so muddy?"],
  "clara-ashgrave": ["What did you argue about at dinner?", "Where were you after ten?", "Who gains from her death?"],
  "dr-vale": ["When did you leave tonight?", "What was in her tonic?", "Did she have enemies?"],
  "mrs-holloway": ["Walk me through your evening.", "Where is the glass from her tray?", "Has the doctor seemed himself lately?"],
  "ghost-of-verity": ["What do you remember?", "Who was with you at the end?", "What were you afraid of?"],
};

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
  const [text, setText] = useState("");
  const [present, setPresent] = useState<string[]>(preset ?? []);
  const [stamp, setStamp] = useState(false);
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
      const t = setTimeout(() => setStamp(false), 2600);
      prevCracked.current = cracked;
      return () => clearTimeout(t);
    }
    prevCracked.current = cracked;
  }, [cracked]);
  const mood = moodOf(last?.text, stamp);

  const items = [
    ...state.evidence.map((e) => ({ id: e.id, name: e.name })),
    ...state.clues.map((c) => ({ id: c.id, name: CLUE_NAMES[c.id] ?? c.id })),
  ];
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  const ask = (q: string) => {
    const shown = present.map((id) => nameOf(id).replace(/^The /, "the "));
    const body = shown.length ? `${q} ${isGhost ? "Look:" : "I have"} ${shown.join(" and ")}.` : q;
    actions.say(`@${agent} ${body.trim()}`);
    setText("");
    setPresent([]);
  };

  // The latest reply types itself out.
  const typed = useTypewriter(last?.id ?? "", last?.text ?? "");

  return (
    <div className={`overlay talk ${isGhost ? "ghostly" : ""}`} role="dialog" aria-label={`Questioning ${name}`}>
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="talk-layout">
        <div className={`portrait mood-${mood}`}>
          <img src={ART(PORTRAITS[agent] ?? "ghost")} alt={name} />
          <div className="portrait-glow" />
          {stamp && <div className="stamp">LIE<br />CAUGHT</div>}
          <div className="nameplate">
            <h2>{name}</h2>
            <p>{isGhost ? "Her memory returns when you show her evidence" : suspect?.role}</p>
            {!isGhost && <span className={`mood-chip ${mood}`}>{busy ? "thinking…" : mood}</span>}
          </div>
        </div>

        <div className="dialogue">
          <div className="log">
            {log.length === 0 && (
              <p className="muted intro">
                {isGhost
                  ? "A cold draught. The candles gutter. Show her something you found, or ask what she remembers."
                  : `${name} waits. Ask anything: they will answer in character, and protect their secrets.`}
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
            {items.length > 0 && (
              <div className="present">
                <span className="eyebrow">{isGhost ? "Show her" : "Present evidence"}</span>
                <div className="chips">
                  {items.map((i) => (
                    <button
                      key={i.id}
                      className={`chip ${present.includes(i.id) ? "on" : ""}`}
                      aria-pressed={present.includes(i.id)}
                      onClick={() => setPresent((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))}
                    >
                      {ICONS[i.id] ?? "🔍"} {i.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="suggest">
              {(QUESTIONS[agent] ?? []).map((q) => (
                <button key={q} className="chip line" onClick={() => ask(q)} disabled={busy}>
                  {q}
                </button>
              ))}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim() || present.length) ask(text.trim() || (isGhost ? "Do you remember this?" : "Explain this."));
              }}
            >
              <input
                id="talk-input"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={isGhost ? "Speak to the ghost…" : `Ask ${name.split(" ").slice(-1)[0]} anything…`}
              />
              <button className="btn" disabled={busy || (!text.trim() && present.length === 0)}>
                {present.length ? "Confront" : "Ask"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
