import { useEffect, useMemo, useRef, useState } from "react";
import { useGame, type FeedMessage, type Snapshot } from "./net.ts";
import { Login } from "./components/Login.tsx";
import { Lobby } from "./components/Lobby.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { Scene } from "./components/Scene.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Interrogation } from "./components/Interrogation.tsx";
import { Lab } from "./components/Lab.tsx";
import { Accuse } from "./components/Accuse.tsx";
import { Verdict } from "./components/Verdict.tsx";
import { ActCard } from "./components/ActCard.tsx";
import { Toasts, type Toast } from "./components/Toasts.tsx";
import { Tour } from "./components/Tour.tsx";
import { sound } from "./sound.ts";

export type Modal =
  | { kind: "talk"; agent: string; present?: string[] }
  | { kind: "lab"; item?: string }
  | { kind: "accuse" }
  | null;

export interface Actions {
  say(text: string, room?: "shared" | "private"): void;
  open(m: Modal): void;
  go(place: string): void;
}

export default function App() {
  const conn = useGame();
  const { state, feed } = conn;
  const [modal, setModal] = useState<Modal>(null);
  const [place, setPlace] = useState("conservatory");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actShown, setActShown] = useState(0);
  const [touring, setTouring] = useState(false);
  const [toured, setToured] = useState(() => {
    try {
      return localStorage.getItem("ashgrave.toured") === "1";
    } catch {
      return false;
    }
  });
  const finishTour = () => {
    setTouring(false);
    setToured(true);
    try {
      localStorage.setItem("ashgrave.toured", "1");
    } catch {
      /* private mode: the tour just shows again next time */
    }
  };

  const actions: Actions = useMemo(
    () => ({ say: conn.say, open: setModal, go: setPlace }),
    [conn.say],
  );

  // Toasts and sounds from what happens in the room.
  const seen = useRef(0);
  useEffect(() => {
    if (seen.current === 0) {
      seen.current = feed.length; // don't replay history
      return;
    }
    const fresh = feed.slice(seen.current);
    seen.current = feed.length;
    for (const m of fresh) {
      const t = toastFor(m);
      if (t) {
        setToasts((ts) => [...ts, t]);
        if (t.kind === "lie") sound.sting();
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== t.id)), 6000);
      }
    }
  }, [feed]);

  // The act card, once per act.
  useEffect(() => {
    if (state && state.phase === "playing" && state.act > actShown) {
      setActShown(state.act);
      sound.bell();
    }
    if (state?.phase === "lobby") setActShown(0);
  }, [state?.act, state?.phase]);
  const [actCardOpen, setActCardOpen] = useState(false);
  useEffect(() => {
    if (actShown > 0) setActCardOpen(true);
  }, [actShown]);

  if (conn.status !== "ready" || !state) {
    return <Login conn={conn} />;
  }

  const actOpening = [...feed].reverse().find((m) => m.agent === "game-master" && /\*\*Act [IV]+/.test(m.text))?.text;

  return (
    <div className="app">
      <TopBar state={state} conn={conn} onAccuse={() => setModal({ kind: "accuse" })} onTour={() => setTouring(true)} />
      <main className="stage">
        <section className="scene-col">
          <Hint state={state} actions={actions} place={place} />
          <Scene state={state} feed={feed} thinking={conn.thinking} place={place} actions={actions} />
        </section>
        <Sidebar state={state} conn={conn} actions={actions} />
      </main>

      {state.phase === "lobby" && !touring && <Lobby state={state} conn={conn} toured={toured} onTour={() => setTouring(true)} />}
      {touring && <Tour onDone={finishTour} />}
      {modal?.kind === "talk" && (
        <Interrogation key={modal.agent} agent={modal.agent} present={modal.present} state={state} feed={feed} thinking={conn.thinking} actions={actions} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "lab" && <Lab item={modal.item} state={state} feed={feed} thinking={conn.thinking} actions={actions} onClose={() => setModal(null)} />}
      {modal?.kind === "accuse" && <Accuse state={state} actions={actions} onClose={() => setModal(null)} />}
      {actCardOpen && !touring && state.phase === "playing" && (
        <ActCard act={state.act} title={state.actTitle} opening={actOpening} onClose={() => setActCardOpen(false)} />
      )}
      {state.verdict && <Verdict state={state} actions={actions} />}
      <Toasts toasts={toasts} />
    </div>
  );
}

function toastFor(m: FeedMessage): Toast | undefined {
  const id = m.id;
  if (m.agent !== "game-master" && m.agent !== "forensics-lab") return undefined;
  if (/Lie caught!/.test(m.text)) {
    const who = /\*\*Lie caught!\*\* (.+?)'s story/.exec(m.text)?.[1] ?? "A suspect";
    const testimony = /New testimony/.test(m.text);
    return { id, kind: "lie", title: "Lie caught!", body: `${who}'s story has cracked.${testimony ? " New testimony added to your case file." : ""}` };
  }
  if (/\*\(new\)\*/.test(m.text)) {
    const n = (m.text.match(/\(new\)/g) ?? []).length;
    return { id, kind: "found", title: n === 1 ? "New evidence" : `${n} new pieces of evidence`, body: "Added to your case file." };
  }
  if (/Laboratory report/.test(m.text)) return { id, kind: "lab", title: "Lab report ready", body: "See the Forensics Lab." };
  return undefined;
}

function Hint({ state, actions, place }: { state: Snapshot; actions: Actions; place: string }) {
  const h = nextHint(state, place);
  if (!h) return null;
  return (
    <div className="hint" role="status">
      <span className="hint-label">Next</span>
      <span className="hint-text">{h.text}</span>
      {h.action && (
        <button className="btn small" onClick={() => h.action!(actions)}>
          {h.cta}
        </button>
      )}
    </div>
  );
}

function nextHint(s: Snapshot, place: string): { text: string; cta?: string; action?: (a: Actions) => void } | null {
  if (s.phase !== "playing") return null;
  const searched = s.locations.filter((l) => l.searched).length;
  const untested = s.evidence.find((e) => e.testable && !e.tested && !e.testimony);
  if (searched === 0) {
    return place === "conservatory"
      ? { text: "Start where she was found. Search the conservatory." , cta: "Search it", action: (a) => a.say("@game-master search conservatory") }
      : { text: "Start where she was found: the conservatory.", cta: "Go there", action: (a) => a.go("conservatory") };
  }
  if (untested && s.labTestsLeft > 0) {
    return { text: `The lab can tell you more about the ${untested.name.toLowerCase()}.`, cta: "Send to the lab", action: (a) => a.open({ kind: "lab", item: untested.id }) };
  }
  if (s.ghost.memories.length <= 1 && s.evidence.length > 0) {
    return { text: "Lady Verity's ghost lingers. Show her what you found and she may remember.", cta: "Visit the ghost", action: (a) => a.open({ kind: "talk", agent: s.ghost.agent }) };
  }
  if (searched < 3) return { text: "Other rooms hold secrets. Pick a room from the map below and search it." };
  if (s.liesCaught === 0) {
    return { text: "Question a suspect, then present evidence that contradicts their story. Check your private clues too." };
  }
  if (s.act >= 4 || s.liesCaught >= 3) {
    return { text: "You may have enough. Name who, how and why.", cta: "Make your accusation", action: (a) => a.open({ kind: "accuse" }) };
  }
  return { text: "Keep pressing. Every suspect hides something, and not every lie is murder." };
}
