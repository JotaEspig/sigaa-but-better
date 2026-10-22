import { useEffect, useState } from "react";

/** Current timestamp that re-renders every `intervalMs` (keeps "open/closed" deadlines honest). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
