export interface Toast {
  id: string;
  kind: "lie" | "found" | "lab";
  title: string;
  body: string;
}

const ICON = { lie: "🧩", found: "🔎", lab: "🔬" };

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
