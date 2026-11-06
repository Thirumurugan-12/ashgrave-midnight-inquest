export interface Toast {
  id: string;
  kind: "lie" | "found" | "lab" | "goal";
  title: string;
  body: string;
}

const ICON = { lie: "🧩", found: "🔎", lab: "🔬", goal: "✅" };

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="toast-icon">{ICON[t.kind]}</span>
          <div>
            <b>{t.title}</b>
            <p>{t.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
