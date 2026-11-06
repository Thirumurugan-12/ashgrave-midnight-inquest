import { useEffect, useState } from "react";
import type { FeedMessage, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, ICONS, REAGENTS } from "../data.ts";
import { Md } from "../md.tsx";
import { sound } from "../sound.ts";

// The lab as a small game: pick the evidence, pick the test you think fits, watch the flask.
export function Lab({ item, state, feed, thinking, actions, onClose }: { item?: string; state: Snapshot; feed: FeedMessage[]; thinking: string[]; actions: Actions; onClose(): void }) {
  const bench = state.evidence.filter((e) => !e.testimony && !e.puzzle);
  const [pick, setPick] = useState<string | undefined>(item ?? bench.find((e) => e.testable && !e.tested)?.id);
  const [reagent, setReagent] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const chosen = bench.find((e) => e.id === pick);
  const busy = thinking.includes("forensics-lab");
  const reply = sentAt ? [...feed].reverse().find((m) => m.agent === "forensics-lab" && m.ts >= sentAt && !/The lab takes/.test(m.text)) : undefined;
  const running = sentAt !== null && !reply;
  const missed = reply && /shows nothing/.test(reply.text);
  const colour = REAGENTS.find((r) => r.id === reagent)?.color ?? "#e0a95c";

  useEffect(() => { setSentAt(null); setReagent(null); }, [pick]);
  useEffect(() => {
    if (!reply) return;
    if (missed) sound.thud();
    else sound.success();
  }, [reply?.id]);

  const run = () => {
    if (!chosen || !reagent) return;
    const r = REAGENTS.find((x) => x.id === reagent)!;
    setSentAt(Date.now() - 500);
    actions.say(`@forensics-lab test the ${chosen.name.toLowerCase()} with the ${r.name}`);
  };

  return (
    <div className="overlay lab" role="dialog" aria-label="Forensics lab" style={{ backgroundImage: `url(${ART("lab")})` }}>
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="lab-layout">
        <div className="bench">
          <p className="eyebrow">Forensics Lab · unlimited tests</p>
          <h2>1 · What shall we test?</h2>
          {bench.length === 0 && <p className="muted">The bench is empty. Search the house first.</p>}
          <div className="bench-items">
            {bench.map((e) => (
              <button key={e.id} className={`bench-item ${pick === e.id ? "on" : ""}`} onClick={() => setPick(e.id)} aria-pressed={pick === e.id}>
                <span className="big-icon">{ICONS[e.id] ?? "🔍"}</span>
                <span>{e.name}</span>
                <span className={`pill ${e.tested ? "ok" : ""}`}>{e.tested ? "✓ tested" : e.testable ? "untested" : "nothing to test"}</span>
              </button>
            ))}
          </div>

          {chosen?.testable && !chosen.tested && (
            <>
              <h2 className="lab-step">2 · Which test?</h2>
              <div className="reagents">
                {REAGENTS.map((r) => (
                  <button
                    key={r.id}
                    className={`reagent ${reagent === r.id ? "on" : ""}`}
                    style={{ "--rc": r.color } as React.CSSProperties}
                    onClick={() => { setReagent(r.id); setSentAt(null); }}
                    aria-pressed={reagent === r.id}
                    disabled={running}
                  >
                    <span className="vial" aria-hidden="true"><i /></span>
                    <span className="reagent-text">
                      <b>{r.icon} {r.name}</b>
                      <small>{r.detects}</small>
                    </span>
                  </button>
                ))}
              </div>
              <button className="btn big" disabled={!reagent || running || busy || Boolean(missed)} onClick={run}>
                {running ? "Testing…" : missed ? "Pick another test" : reagent ? "Run the test" : "Pick a test"}
              </button>
            </>
          )}
        </div>

        <div
          className={`apparatus ${running ? "running" : ""} ${reply && !missed ? "reacted" : ""} ${missed ? "missed" : ""}`}
          style={{ "--rc": colour } as React.CSSProperties}
          aria-hidden="true"
        >
          <div className="flask f1"><i /><b /><b /></div>
          <div className="flask f2"><i /><b /></div>
          <div className="flask f3"><i /><b /><b /></div>
          <div className="specimen">{chosen ? ICONS[chosen.id] : "⚗️"}</div>
          {missed && <div className="fizzle">Nothing reacts…</div>}
        </div>

        <div className={`report ${(reply && !missed) || chosen?.lab ? "ready" : ""}`}>
          <h3>Laboratory report</h3>
          {running && <p className="muted">The flame hisses. Reagents darken…</p>}
          {missed && (
            <p className="muted">
              The {REAGENTS.find((r) => r.id === reagent)?.name.toLowerCase()} shows nothing on the {chosen?.name.toLowerCase()}. No harm done: pick another test.
            </p>
          )}
          {reply && !missed && <Md text={reply.text.replace(/^🔬\s*(\*\*Laboratory report: )?/, "**")} className="md" />}
          {!reply && !running && chosen?.lab && (
            <>
              <p><b>{chosen.name}</b></p>
              <p>{chosen.lab}</p>
            </>
          )}
          {!reply && !running && !chosen?.lab && <p className="muted">Pick an item, then the test you think will tell you most. A wrong guess costs nothing.</p>}
        </div>
      </div>
    </div>
  );
}
