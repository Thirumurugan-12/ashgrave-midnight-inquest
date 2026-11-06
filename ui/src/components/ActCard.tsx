import { ACT_SUBTITLES, ROMAN } from "../data.ts";
import { Md } from "../md.tsx";

export function ActCard({ act, title, opening, goals, onClose }: { act: number; title: string; opening?: string; goals: Array<{ text: string }>; onClose(): void }) {
  // The opening without its first heading line and the command list (the window has buttons for those).
  const body = opening
    ?.split("\n\n")
    .slice(1)
    .map((p) => p.replace(/\s*\(`@[^)]*\)/g, ""))
    .filter((p) => !p.startsWith("•") && !/`@/.test(p) && !p.startsWith("**Goals**"))
    .join("\n\n");
  return (
    <div className="overlay actcard" role="dialog" aria-label={`Chapter ${ROMAN[act]}`} onClick={onClose}>
      <div className="actcard-inner" onClick={(e) => e.stopPropagation()}>
        <p className="act-roman">Chapter {ROMAN[act]}</p>
        <h2>{title}</h2>
        <p className="act-sub">{ACT_SUBTITLES[act]}</p>
        {body && <Md text={body} className="md act-body" />}
        {goals.length > 0 && (
          <div className="act-goals">
            <p className="eyebrow">Your goals</p>
            <ul>{goals.map((g) => <li key={g.text}>☐ {g.text}</li>)}</ul>
          </div>
        )}
        <button className="btn big" onClick={onClose} autoFocus>Continue</button>
      </div>
    </div>
  );
}
