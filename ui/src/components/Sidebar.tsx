import { useEffect, useRef, useState } from "react";
import type { GameConnection, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, CLUE_NAMES, ICONS, PORTRAITS } from "../data.ts";
import { Md } from "../md.tsx";

type Tab = "household" | "case" | "room";

export function Sidebar({ state, conn, actions }: { state: Snapshot; conn: GameConnection; actions: Actions }) {
  const [tab, setTab] = useState<Tab>("household");
  const [unread, setUnread] = useState(0);
  const lastLen = useRef(conn.feed.length);
  useEffect(() => {
    if (tab !== "room") setUnread((u) => u + Math.max(0, conn.feed.length - lastLen.current));
    lastLen.current = conn.feed.length;
  }, [conn.feed.length]);
  useEffect(() => {
    if (tab === "room") setUnread(0);
  }, [tab]);

  return (
    <aside className="sidebar">
      <div className="tabs" role="tablist" data-tour="tabs">
        <button role="tab" aria-selected={tab === "household"} onClick={() => setTab("household")}>Household</button>
        <button role="tab" aria-selected={tab === "case"} onClick={() => setTab("case")}>
          Case file <span className="count">{state.evidence.length + state.clues.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "room"} onClick={() => setTab("room")}>
          Room {unread > 0 && <span className="count hot">{unread}</span>}
        </button>
      </div>
      <div className="tab-body">
        {tab === "household" && <Household state={state} thinking={conn.thinking} actions={actions} />}
        {tab === "case" && <CaseFile state={state} conn={conn} actions={actions} />}
        {tab === "room" && <Room conn={conn} />}
      </div>
    </aside>
  );
}

function Household({ state, thinking, actions }: { state: Snapshot; thinking: string[]; actions: Actions }) {
  return (
    <div className="household">
      <div data-tour="household">
      <p className="section-label">Suspects</p>
      {state.suspects.map((s) => (
        <button key={s.agent} className={`person ${s.gone ? "gone" : ""}`} onClick={() => actions.open({ kind: "talk", agent: s.agent })} disabled={s.gone}>
          <img src={ART(PORTRAITS[s.agent]!)} alt="" />
          <span className="person-text">
            <span className="person-name">{s.name}</span>
            <span className="person-role">{s.gone ? "Has left Ashgrave" : s.role}</span>
            {s.cracked > 0 && <span className="cracks">{"🧩".repeat(s.cracked)} lie{s.cracked > 1 ? "s" : ""} broken</span>}
          </span>
          {thinking.includes(s.agent) && <span className="typing" aria-label="replying">•••</span>}
        </button>
      ))}
      </div>
      <div data-tour="others">
      <p className="section-label">The others</p>
      <button className="person ghost-card" onClick={() => actions.open({ kind: "talk", agent: state.ghost.agent })}>
        <img src={ART("ghost")} alt="" />
        <span className="person-text">
          <span className="person-name">{state.ghost.name}</span>
          <span className="person-role">{state.ghost.memories.length} memor{state.ghost.memories.length === 1 ? "y" : "ies"} recovered</span>
        </span>
        {thinking.includes(state.ghost.agent) && <span className="typing">•••</span>}
      </button>
      <button className="person lab-card" onClick={() => actions.open({ kind: "lab" })}>
        <img src={ART("lab")} alt="" />
        <span className="person-text">
          <span className="person-name">Forensics Lab</span>
          <span className="person-role">{state.labTestsLeft} tests left tonight</span>
        </span>
      </button>
      </div>
    </div>
  );
}

function CaseFile({ state, conn, actions }: { state: Snapshot; conn: GameConnection; actions: Actions }) {
  const physical = state.evidence.filter((e) => !e.testimony);
  const testimony = state.evidence.filter((e) => e.testimony);
  const clerk = [...conn.feed].reverse().find((m) => m.agent === "evidence-clerk");
  const clerkBusy = conn.thinking.includes("evidence-clerk");
  return (
    <div className="casefile">
      {state.clues.length > 0 && (
        <>
          <p className="section-label">🤫 Your private clues: only you can see these</p>
          {state.clues.map((c) => (
            <div key={c.id} className="clue">
              <b>{ICONS[c.id]} {CLUE_NAMES[c.id] ?? c.id}</b>
              <p>{c.text}</p>
              <button className="btn tiny line" onClick={() => actions.say(`📜 ${conn.username} shares a private clue: ${c.text}`)}>
                Share with the room
              </button>
            </div>
          ))}
        </>
      )}
      <p className="section-label">Evidence</p>
      {physical.length === 0 && <p className="muted">Nothing yet. Search the rooms.</p>}
      {physical.map((e) => (
        <div key={e.id} className="ev">
          <span className="ev-icon">{ICONS[e.id] ?? "🔍"}</span>
          <div>
            <b>{e.name}</b>
            <p>{e.lab ?? e.description}</p>
            {e.testable && !e.tested && (
              <button className="btn tiny line" onClick={() => actions.open({ kind: "lab", item: e.id })}>Test it</button>
            )}
            {e.tested && <span className="pill">🔬 tested</span>}
          </div>
        </div>
      ))}
      {testimony.length > 0 && <p className="section-label">Testimony</p>}
      {testimony.map((e) => (
        <div key={e.id} className="ev testimony">
          <span className="ev-icon">{ICONS[e.id] ?? "🗣️"}</span>
          <div>
            <b>{e.name}</b>
            <p>{e.description}</p>
          </div>
        </div>
      ))}
      <div className="clerk">
        <p className="section-label">The Evidence Clerk</p>
        {clerk ? <Md text={clerk.text} className="md" /> : <p className="muted">The clerk can line up who said what and spot contradictions.</p>}
        <button className="btn small" disabled={clerkBusy} onClick={() => actions.say("@evidence-clerk what contradictions do we have so far?")}>
          {clerkBusy ? "The clerk is reading…" : "Ask for contradictions"}
        </button>
      </div>
    </div>
  );
}

function Room({ conn }: { conn: GameConnection }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [conn.feed.length]);
  const [text, setText] = useState("");
  return (
    <div className="room">
      <p className="room-note">
        This is <b>#conservatory</b>, the Switch room in Mattermost. Everything you do in the game appears here, and friends can play from chat.
        {conn.mattermostUrl && (
          <>
            {" "}
            <a href={conn.mattermostUrl} target="_blank" rel="noreferrer">Open in Mattermost ↗</a>
          </>
        )}
      </p>
      <div className="feed">
        {conn.feed.map((m) => (
          <div key={m.id} className={`msg ${m.agent ? "agent" : "human"} ${m.agent === "game-master" ? "gm" : ""}`}>
            {m.agent && PORTRAITS[m.agent] ? <img className="av" src={ART(PORTRAITS[m.agent]!)} alt="" /> : <span className="av letter">{m.from.slice(0, 1).toUpperCase()}</span>}
            <div className="msg-body">
              <span className="msg-from">{m.from}</span>
              <Md text={m.text} className="md" />
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) conn.say(text.trim());
          setText("");
        }}
      >
        <input id="room-say" value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something to the room…" />
        <button className="btn small">Send</button>
      </form>
    </div>
  );
}
