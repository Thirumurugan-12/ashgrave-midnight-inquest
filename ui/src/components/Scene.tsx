import { useEffect, useState } from "react";
import type { FeedMessage, Snapshot } from "../net.ts";
import type { Actions } from "../App.tsx";
import { ART, HOTSPOTS, ICONS, PLACES } from "../data.ts";

export function Scene({ state, thinking, place, actions }: { state: Snapshot; feed: FeedMessage[]; thinking: string[]; place: string; actions: Actions }) {
  const meta = PLACES[place]!;
  const loc = state.locations.find((l) => l.id === place);
  const here = state.evidence.filter((e) => e.location === place);
  const [inspect, setInspect] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => { setInspect(null); }, [place]);
  useEffect(() => {
    if (searching && !thinking.includes("game-master")) {
      const t = setTimeout(() => setSearching(false), 400);
      return () => clearTimeout(t);
    }
  }, [thinking, searching]);
  // After the second bell, the study fireplace holds something new.
  const newInStudy = (p: string) =>
    p === "study" && state.act >= 2 && !state.evidence.some((e) => e.id === "burned-letter");
  const canSearchAgain = loc?.searched && newInStudy(place);
  const item = here.find((e) => e.id === inspect);

  const search = () => {
    setSearching(true);
    actions.say(`@game-master search ${place}`);
  };

  return (
    <div className="scene">
      <div className="scene-frame" key={place} data-tour="scene">
        <img className="scene-art" src={ART(meta.art)} alt={meta.title} />
        <div className="scene-rain" aria-hidden="true" />
        <div className="scene-fog" aria-hidden="true" />
        <div className="scene-vignette" aria-hidden="true" />

        <div className="scene-title">
          <h2>{meta.title}</h2>
          <p>{meta.blurb}</p>
        </div>

        {(!loc?.searched || canSearchAgain) && (
          <div className="search-cta">
            <button className="btn big lantern" onClick={search} disabled={searching}>
              {searching ? "Searching by lamplight…" : canSearchAgain ? "Search the fireplace" : `Search ${meta.title.replace(/^The /, "the ")}`}
            </button>
          </div>
        )}
        {loc?.searched && here.length === 0 && !canSearchAgain && <div className="scene-empty">Nothing of note here. Not yet, at least.</div>}

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
                <span className="eyebrow">🔬 Lab report</span>
                <p>{item.lab}</p>
              </div>
            )}
            <div className="row">
              {item.testable && !item.tested && (
                <button className="btn small" onClick={() => actions.open({ kind: "lab", item: item.id })} disabled={state.labTestsLeft <= 0}>
                  Send to the lab
                </button>
              )}
              <button className="btn small ghosty" onClick={() => actions.open({ kind: "talk", agent: state.ghost.agent, present: [item.id] })}>
                Show the ghost
              </button>
              <ConfrontMenu state={state} onPick={(agent) => actions.open({ kind: "talk", agent, present: [item.id] })} />
            </div>
          </div>
        )}
      </div>

      <nav className="map" aria-label="Rooms of the house" data-tour="map">
        {state.locations.map((l) => {
          const count = state.evidence.filter((e) => e.location === l.id).length;
          const fresh = l.searched && newInStudy(l.id);
          return (
            <button key={l.id} className={`map-room ${l.id === place ? "here" : ""}`} onClick={() => actions.go(l.id)}>
              <img src={ART(PLACES[l.id]!.art)} alt="" />
              <span className="map-name">{PLACES[l.id]!.title.replace(/^The /, "")}</span>
              {!l.searched && <span className="badge unsearched">unsearched</span>}
              {l.searched && count > 0 && <span className="badge">{count} found</span>}
              {fresh && <span className="badge alert">!</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ConfrontMenu({ state, onPick }: { state: Snapshot; onPick(agent: string): void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu">
      <button className="btn small line" onClick={() => setOpen(!open)} aria-expanded={open}>
        Confront… ▾
      </button>
      {open && (
        <div className="menu-list">
          {state.suspects.map((s) => (
            <button key={s.agent} disabled={s.gone} onClick={() => onPick(s.agent)}>
              {s.name}
              {s.gone ? " (gone)" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
