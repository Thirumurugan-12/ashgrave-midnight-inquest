import { useEffect, useRef, useState } from "react";
import type { FeedMessage, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, HOTSPOTS, ICONS, PLACES } from "../data.ts";

// A painted room you search with a lantern-lens: hidden things glint where they lie.
export function Scene({ state, place, actions }: { state: Snapshot; feed: FeedMessage[]; thinking: string[]; place: string; actions: Actions }) {
  const meta = PLACES[place]!;
  const here = state.evidence.filter((e) => e.location === place);
  const hidden = state.findable.filter((f) => f.location === place);
  const [inspect, setInspect] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => { setInspect(null); }, [place]);
  // Forget clicks once the server has confirmed them.
  useEffect(() => { setPicked((p) => p.filter((id) => hidden.some((h) => h.id === id))); }, [state.findable.length]);

  const glints = hidden.filter((h) => !picked.includes(h.id));
  const lens = glints.length > 0 && state.phase === "playing";
  const item = here.find((e) => e.id === inspect);

  const move = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    frame.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
    frame.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="scene">
      <div className={`scene-frame ${lens ? "lens-on" : ""}`} key={place} data-tour="scene" ref={frame} onPointerMove={move}>
        <img className="scene-art" src={ART(meta.art)} alt={meta.title} />
        <div className="scene-rain" aria-hidden="true" />
        <div className="scene-fog" aria-hidden="true" />
        {lens && <div className="scene-dark" aria-hidden="true" />}
        <div className="scene-vignette" aria-hidden="true" />

        <div className="scene-title">
          <h2>{meta.title}</h2>
          <p>{meta.blurb}</p>
        </div>

        {lens && (
          <div className="lens-help">
            <span>🔍 Sweep the lantern over the room and click whatever glints.</span>
            <b>{glints.length} hidden here</b>
            <button className="btn tiny line" onClick={() => actions.say(`@game-master search ${place}`)}>Light every lamp</button>
          </div>
        )}
        {!lens && here.length === 0 && state.phase === "playing" && <div className="scene-empty">Nothing of note here. Not yet, at least.</div>}

        {glints.map((g) => {
          const pos = HOTSPOTS[g.id] ?? { x: 50, y: 60 };
          return (
            <button
              key={g.id}
              className="glint"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => {
                setPicked((p) => [...p, g.id]);
                actions.say(`@game-master find ${g.id.replace(/-/g, " ")}`);
              }}
              aria-label="Something glints here"
            >
              <span className="spark" />
            </button>
          );
        })}

        {here.map((e) => {
          const pos = HOTSPOTS[e.id] ?? { x: 50, y: 60 };
          return (
            <button
              key={e.id}
              className={`hotspot ${e.tested ? "tested" : ""} ${inspect === e.id ? "active" : ""}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => setInspect(inspect === e.id ? null : e.id)}
              aria-label={`Inspect ${e.name}`}
            >
              <span className="ring" />
              <span className="hotspot-icon">{ICONS[e.id] ?? "🔍"}</span>
              <span className="tag">{e.name}</span>
            </button>
          );
        })}

        {item && (
          <div className="inspect" role="dialog" aria-label={item.name}>
            <button className="close" onClick={() => setInspect(null)} aria-label="Close">×</button>
            <p className="eyebrow">{ICONS[item.id]} Evidence</p>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            {item.lab && (
              <div className="lab-result">
                <span className="eyebrow">{item.puzzle ? "📜 Restored" : "🔬 Lab report"}</span>
                <p>{item.lab}</p>
              </div>
            )}
            <div className="row">
              {item.puzzle && !item.tested && (
                <button className="btn small" onClick={() => actions.open({ kind: "letter" })}>Piece it together</button>
              )}
              {item.testable && !item.tested && (
                <button className="btn small" onClick={() => actions.open({ kind: "lab", item: item.id })}>Send to the lab</button>
              )}
              <button className="btn small ghosty" onClick={() => actions.open({ kind: "talk", agent: state.ghost.agent, present: [item.id] })}>
                Show the ghost
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="map" aria-label="Rooms of the house" data-tour="map">
        {state.locations.map((l) => {
          const left = state.findable.filter((f) => f.location === l.id).length;
          return (
            <button key={l.id} className={`map-room ${l.id === place ? "here" : ""}`} onClick={() => actions.go(l.id)}>
              <img src={ART(PLACES[l.id]!.art)} alt="" />
              <span className="map-name">{PLACES[l.id]!.title.replace(/^The /, "")}</span>
              {left > 0 ? <span className="badge unsearched">✨ {left} hidden</span> : <span className="badge done">✓</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
