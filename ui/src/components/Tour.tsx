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
        Lady Verity Ashgrave lies dead in her conservatory. Find out <b>who</b> killed her, <b>how</b>, and <b>why</b>. The case runs in three
        short chapters, and this tour takes under a minute.
      </>
    ),
    art: <img className="tour-art wide" src={ART("conservatory")} alt="" />,
  },
  {
    target: "[data-tour=goals]",
    title: "Always know what to do",
    body: <>Each chapter has a couple of goals. Tick them off and the next chapter begins. The button beside them suggests your next move.</>,
  },
  {
    target: "[data-tour=scene]",
    title: "Search with your lantern",
    body: (
      <>
        Sweep your mouse over the painted room. Hidden things <b>glint</b>: click them to pick them up. Rooms marked ✨ on the map still hide
        something.
      </>
    ),
  },
  {
    target: "[data-tour=others]",
    title: "The lab and the ghost",
    body: (
      <>
        At the <b>Forensics Lab</b>, pick the test you think fits. A wrong guess costs nothing. Stuck? <b>Lady Verity's ghost</b> gives you a hint.
      </>
    ),
  },
  {
    target: "[data-tour=household]",
    title: "Catch them lying",
    body: (
      <>
        Open a suspect to see <b>their story</b>, line by line. Drag in the evidence that proves a line false and their lie breaks. Not every liar
        is the killer.
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
    target: "[data-tour=board]",
    title: "The evidence board",
    body: <>Everything you find gets pinned here. Red string links each clue to the story it broke, and the meter shows how much of the case you've uncovered.</>,
  },
  {
    target: "[data-tour=accuse]",
    title: "Name the killer",
    body: <>When you're ready, make three picks: who, how and why. You only get one try, so agree with your team first.</>,
  },
  {
    target: "[data-tour=switch]",
    title: "Behind the curtain: Switch",
    body: (
      <>
        Every character is an <b>AI agent</b> in a <b>Switch room</b> on Mattermost. Everything you do here is posted there as you, so friends can
        play from chat too.
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
