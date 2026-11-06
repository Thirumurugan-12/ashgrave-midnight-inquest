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
import { Board } from "./components/Board.tsx";
import { LetterPuzzle } from "./components/LetterPuzzle.tsx";
import { FoundCard } from "./components/FoundCard.tsx";
import { ICONS } from "./data.ts";
import { sound } from "./sound.ts";

export type Modal =
  | { kind: "talk"; agent: string; present?: string[] }
  | { kind: "lab"; item?: string }
  | { kind: "accuse" }
  | { kind: "board" }
  | { kind: "letter" }
  | null;

export interface Actions {
  say(text: string, room?: "shared" | "private"): void;
  open(m: Modal): void;
  go(place: string): void;
  /** Ask Lady Verity's ghost for a nudge. */
  hint(): void;
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
    () => ({
      say: conn.say,
      open: setModal,
      go: setPlace,
      hint: () => {
        setModal({ kind: "talk", agent: "ghost-of-verity" });
        conn.say("@ghost-of-verity I'm stuck. Give me a hint.");
      },
    }),
    [conn.say],
  );

  // A card flips up for each new piece of evidence, then flies to the case file.
  const [flying, setFlying] = useState<Array<{ id: string; name: string; testimony: boolean }>>([]);
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!state) return;
    const ids = state.evidence.map((e) => e.id);
    if (known.current === null || state.phase !== "playing") {
      known.current = new Set(ids);
      return;
    }
    const fresh = state.evidence.filter((e) => !known.current!.has(e.id));
    for (const e of fresh) known.current.add(e.id);
    if (fresh.length) {
      sound.chime();
      setFlying((f) => [...f, ...fresh.map((e) => ({ id: e.id, name: e.name, testimony: e.testimony }))]);
    }
  }, [state?.evidence.length, state?.phase]);

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
    if (state?.phase === "lobby") {
      setActShown(0);
      setFlying([]);
    }
  }, [state?.act, state?.phase]);
  const [actCardOpen, setActCardOpen] = useState(false);
  useEffect(() => {
    if (actShown > 0) setActCardOpen(true);
  }, [actShown]);

  if (conn.status !== "ready" || !state) {
    return <Login conn={conn} />;
  }

  const actOpening = [...feed].reverse().find((m) => m.agent === "game-master" && /\*\*Chapter [IV]+/.test(m.text))?.text;

  return (
    <div className="app">
      <TopBar state={state} conn={conn} actions={actions} onTour={() => setTouring(true)} />
      <main className="stage">
        <section className="scene-col">
          <Goals state={state} actions={actions} place={place} />
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
      {modal?.kind === "board" && <Board state={state} actions={actions} onClose={() => setModal(null)} />}
      {modal?.kind === "letter" && <LetterPuzzle state={state} actions={actions} onClose={() => setModal(null)} />}
      {flying[0] && !touring && (
        <FoundCard key={flying[0].id} card={flying[0]} icon={ICONS[flying[0].id] ?? "🔍"} onDone={() => setFlying((f) => f.slice(1))} />
      )}
      {actCardOpen && !touring && !modal && !flying[0] && state.phase === "playing" && (
        <ActCard act={state.act} title={state.actTitle} opening={actOpening} goals={state.goals} onClose={() => setActCardOpen(false)} />
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
  if (/Laboratory report/.test(m.text)) return { id, kind: "lab", title: "Lab report ready", body: "Added to your case file." };
  if (/pieced the .* back together/.test(m.text)) return { id, kind: "found", title: "The letter is restored", body: "Read it in your case file." };
  if (/Chapter [IV]+ complete/.test(m.text)) return { id, kind: "goal", title: "Chapter complete", body: "A new chapter begins." };
  return undefined;
}

function Goals({ state, actions, place }: { state: Snapshot; actions: Actions; place: string }) {
  if (state.phase === "lobby") return <div className="goals preview" data-tour="goals">Your goals for each chapter appear here.</div>;
  if (state.phase !== "playing") return null;
  const h = nextHint(state, place);
  return (
    <div className="goals" role="status" data-tour="goals">
      <div className="goals-head">
        <span className="hint-label">Chapter {["", "I", "II", "III"][state.act]}</span>
        <ul>
          {state.goals.map((g) => (
            <li key={g.text} className={g.done ? "done" : ""}>
              <span className="tick" aria-hidden="true">{g.done ? "✓" : ""}</span>
              {g.text}
              {g.need && g.need > 1 && !g.done && <span className="count-pill">{g.have}/{g.need}</span>}
            </li>
          ))}
        </ul>
      </div>
      {h && (
        <div className="goals-next">
          <span className="hint-text">{h.text}</span>
          {h.action && (
            <button className="btn small" onClick={() => h.action!(actions)}>
              {h.cta}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function nextHint(s: Snapshot, place: string): { text: string; cta?: string; action?: (a: Actions) => void } | null {
  const hiddenHere = s.findable.some((f) => f.location === place);
  const untested = s.evidence.find((e) => e.testable && !e.tested);
  const goal = s.goals.find((g) => !g.done);
  if (s.puzzle) return { text: "A scorched letter, in pieces. Put it back together.", cta: "Piece it together", action: (a) => a.open({ kind: "letter" }) };
  if (s.act === 3) return { text: "You may know enough. Check the board, then name who, how and why.", cta: "Make your accusation", action: (a) => a.open({ kind: "accuse" }) };
  if (goal?.text.startsWith("Find") || (s.act === 2 && !s.evidence.some((e) => e.puzzle))) {
    if (hiddenHere) return { text: "Sweep the lantern over this room and click whatever glints." };
    const next = s.findable[0];
    if (next) return { text: "Other rooms still hide things. Look for ✨ on the map below.", cta: "Go there", action: (a) => a.go(next.location) };
  }
  if (untested) return { text: `The lab can tell you more about the ${untested.name.toLowerCase()}.`, cta: "Send to the lab", action: (a) => a.open({ kind: "lab", item: untested.id }) };
  if (goal?.text.includes("lie")) return { text: "Open a suspect, read their story, and drag in the evidence that proves a line false.", cta: "Stuck? Get a hint", action: (a) => a.hint() };
  return { text: "Stuck? Lady Verity's ghost can point the way.", cta: "Get a hint", action: (a) => a.hint() };
}
