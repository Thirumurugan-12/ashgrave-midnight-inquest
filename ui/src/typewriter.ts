import { useEffect, useRef, useState } from "react";

/** Types `text` out once per `key`. Respects reduced-motion. */
export function useTypewriter(key: string, text: string, cps = 55): string {
  const [shown, setShown] = useState(text);
  const done = useRef(new Set<string>());
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!key || done.current.has(key) || reduce) {
      setShown(text);
      return;
    }
    done.current.add(key);
    let i = 0;
    setShown("");
    const t = setInterval(() => {
      i = Math.min(text.length, i + Math.max(1, Math.round(cps / 30)));
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, 1000 / 30);
    return () => {
      clearInterval(t);
      setShown(text);
    };
  }, [key, text, cps]);
  return shown;
}
