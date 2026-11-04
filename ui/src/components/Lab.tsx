import { useEffect, useState } from "react";
import type { FeedMessage, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, ICONS } from "../data.ts";
import { Md } from "../md.tsx";

export function Lab({ item, state, feed, thinking, actions, onClose }: { item?: string; state: Snapshot; feed: FeedMessage[]; thinking: string[]; actions: Actions; onClose(): void }) {
  const bench = state.evidence.filter((e) => !e.testimony);
  const [pick, setPick] = useState<string | undefined>(item ?? bench.find((e) => e.testable && !e.tested)?.id);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const chosen = bench.find((e) => e.id === pick);
  const busy = thinking.includes("forensics-lab");
  const reply = sentAt ? [...feed].reverse().find((m) => m.agent === "forensics-lab" && m.ts >= sentAt && !/The lab takes/.test(m.text)) : undefined;
  const running = sentAt !== null && !reply;

  useEffect(() => { setSentAt(null); }, [pick]);

  return (
    <div className="overlay lab" role="dialog" aria-label="Forensics lab" style={{ backgroundImage: `url(${ART("lab")})` }}>
      <button className="close big" onClick={onClose} aria-label="Close">×</button>
      <div className="lab-layout">
        <div className="bench">
          <p className="eyebrow">Forensics Lab · {state.labTestsLeft} tests left tonight</p>
          <h2>What shall we test?</h2>
          {bench.length === 0 && <p className="muted">The bench is empty. Search the house first.</p>}
          <div className="bench-items">
            {bench.map((e) => (
              <button key={e.id} className={`bench-item ${pick === e.id ? "on" : ""}`} onClick={() => setPick(e.id)} aria-pressed={pick === e.id}>
                <span className="big-icon">{ICONS[e.id] ?? "🔍"}</span>
                <span>{e.name}</span>
                <span className="pill">{e.tested ? "tested" : e.testable ? "untested" : "nothing to test"}</span>
              </button>
            ))}
          </div>
          {chosen && (
            <button
              className="btn big"
              disabled={!chosen.testable || running || busy || (!chosen.tested && state.labTestsLeft <= 0)}
              onClick={() => {
                setSentAt(Date.now() - 500);
                actions.say(`@forensics-lab ${chosen.name}`);
              }}
            >
              {running ? "Testing…" : chosen.tested ? "Read the report again" : `Run analysis on the ${chosen.name.toLowerCase()}`}
            </button>
          )}
        </div>

        <div className={`apparatus ${running ? "running" : ""}`} aria-hidden="true">
          <div className="flask f1"><i /><b /><b /></div>
          <div className="flask f2"><i /><b /></div>
          <div className="flask f3"><i /><b /><b /></div>
          <div className="specimen">{chosen ? ICONS[chosen.id] : "⚗️"}</div>
        </div>

        <div className={`report ${reply || chosen?.lab ? "ready" : ""}`}>
          <h3>Laboratory report</h3>
          {running && <p className="muted">The flame hisses. Reagents darken…</p>}
          {reply && <Md text={reply.text.replace(/^🔬\s*(\*\*Laboratory report: )?/, "**")} className="md" />}
          {!reply && !running && chosen?.lab && (
            <>
              <p><b>{chosen.name}</b></p>
              <p>{chosen.lab}</p>
            </>
          )}
          {!reply && !running && !chosen?.lab && <p className="muted">Choose an item and run the analysis.</p>}
        </div>
      </div>
    </div>
  );
}
