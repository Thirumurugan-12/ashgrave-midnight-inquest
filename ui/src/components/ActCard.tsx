import { ACT_SUBTITLES, ROMAN } from "../data.ts";
import { Md } from "../md.tsx";

export function ActCard({ act, title, opening, onClose }: { act: number; title: string; opening?: string; onClose(): void }) {
  // The opening without its first heading line and the command list (the window has buttons for those).
  const body = opening
    ?.split("\n\n")
    .slice(1)
    .filter((p) => !p.startsWith("•") && !/`@/.test(p))
    .join("\n\n");
  return (
    <div className="overlay actcard" role="dialog" aria-label={`Act ${ROMAN[act]}`} onClick={onClose}>
      <div className="actcard-inner" onClick={(e) => e.stopPropagation()}>
        <p className="act-roman">Act {ROMAN[act]}</p>
        <h2>{title}</h2>
        <p className="act-sub">{ACT_SUBTITLES[act]}</p>
        {body && <Md text={body} className="md act-body" />}
        <button className="btn big" onClick={onClose} autoFocus>Continue</button>
      </div>
    </div>
  );
}
