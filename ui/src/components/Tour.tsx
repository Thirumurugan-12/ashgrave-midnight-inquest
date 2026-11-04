import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { ART } from "../data.ts";

// A spotlight tour over the real game screen. Each step highlights one part of the
// window and says, in a line or two, what it is for.

interface Step {
  target?: string;
  title: string;
  body: ReactNode;
  art?: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Ashgrave",
    body: (
      <>
        Lady Verity Ashgrave lies dead in her conservatory. Before midnight you must prove three things: <b>who</b> killed her,{" "}
        <b>how</b>, and <b>why</b>. This tour takes about a minute.
      </>
    ),
    art: <img className="tour-art wide" src={ART("conservatory")} alt="" />,
  },
  {
    target: "[data-tour=scene]",
    title: "Search the house",
    body: (
      <>
        Each painted room hides evidence. Press <b>Search</b>, then click the glowing markers to inspect what you find.
      </>
    ),
  },
  {
    target: "[data-tour=map]",
    title: "Six rooms to explore",
    body: <>Move between rooms here. A room marked <i>unsearched</i> still holds secrets, and some clues only appear after the bell tolls.</>,
  },
  {
    target: "[data-tour=household]",
    title: "Question the household",
    body: <>Click a suspect to question them. Ask anything you like: they answer in character, and every one of them is hiding something.</>,
  },
  {
    target: "[data-tour=household]",
    title: "Catch them lying",
    body: (
      <>
        When a story doesn't fit, <b>present the evidence</b> that contradicts it. If you're right, their lie breaks, you score a point, and they may
        give up new testimony. Not every liar is the killer.
      </>
    ),
    art: (
      <div className="tour-stamp-demo">
        <img src={ART("thomas")} alt="" />
        <span className="stamp small">LIE<br />CAUGHT</span>
      </div>
    ),
  },
  {
    target: "[data-tour=others]",
    title: "The ghost and the lab",
    body: (
      <>
        Show <b>Lady Verity's ghost</b> what you found and her memory returns, though not always correctly. The <b>Forensics Lab</b> tells you what
        evidence really means. You get six tests.
      </>
    ),
  },
  {
    target: "[data-tour=tabs]",
    title: "Your case file",
    body: (
      <>
        The <b>Case file</b> keeps your evidence, testimony and your <b>secret clues</b>. Playing alone? You hold all four. <b>Room</b> shows the live
        chat everyone shares.
      </>
    ),
  },
  {
    target: "[data-tour=clock]",
    title: "The clock is ticking",
    body: <>A bell tolls each new act. In Act III the doctor calls for his carriage, and once he leaves he answers no more questions.</>,
  },
  {
    target: "[data-tour=accuse]",
    title: "Make your accusation",
    body: <>When you're sure, accuse: pick the suspect, then the evidence for how and why. You get one shot, so agree with your team first.</>,
  },
  {
    target: "[data-tour=switch]",
    title: "Behind the curtain: Switch",
    body: (
      <>
        Every suspect is an <b>AI agent</b> in a <b>Switch room</b> on Mattermost. Everything you do here is posted there as you, so friends can play
        from chat too. Click this badge to watch the room live.
      </>
    ),
  },
];

export function Tour({ onDone }: { onDone(): void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = step.target ? document.querySelector(step.target) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : onDone());
  const pad = 8;
  const card = placeCard(rect);

  return (
    <div className="tour" role="dialog" aria-label="How to play">
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className={`tour-card ${rect ? "" : "center"}`} style={card}>
        {step.art}
        <p className="eyebrow">
          How to play · {i + 1} of {STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, n) => (
            <span key={n} className={n === i ? "on" : n < i ? "done" : ""} />
          ))}
        </div>
        <div className="row">
          {i > 0 && (
            <button className="btn line small" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button className="btn small" onClick={next} autoFocus>
            {i < STEPS.length - 1 ? "Next" : "I'm ready"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Put the card beside the highlighted area, wherever there is room. */
function placeCard(rect: DOMRect | null): React.CSSProperties | undefined {
  if (!rect) return undefined;
  const W = 360;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 20;
  if (rect.right + gap + W < vw) return { left: rect.right + gap, top: clamp(rect.top, 16, vh - 340) };
  if (rect.left - gap - W > 0) return { left: rect.left - gap - W, top: clamp(rect.top, 16, vh - 340) };
  if (rect.bottom + gap + 300 < vh) return { left: clamp(rect.left, 16, vw - W - 16), top: rect.bottom + gap };
  return { left: clamp(rect.left + rect.width / 2 - W / 2, 16, vw - W - 16), top: clamp(rect.top - 320, 16, vh - 340) };
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
