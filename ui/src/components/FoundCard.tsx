import { useEffect, useState } from "react";

// A found item: the card flips over in the middle of the screen, then flies off to the case file.
export function FoundCard({ card, icon, onDone }: { card: { id: string; name: string; testimony: boolean }; icon: string; onDone(): void }) {
  const [phase, setPhase] = useState<"flip" | "fly">("flip");
  useEffect(() => {
    const a = setTimeout(() => setPhase("fly"), 1500);
    const b = setTimeout(onDone, 2300);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return (
    <div className={`found-card ${phase}`} aria-live="polite">
      <div className="found-inner">
        <div className="found-back" aria-hidden="true">?</div>
        <div className="found-front">
          <span className="found-icon">{icon}</span>
          <p className="eyebrow">{card.testimony ? "New testimony" : "Evidence found"}</p>
          <b>{card.name}</b>
        </div>
      </div>
    </div>
  );
}
