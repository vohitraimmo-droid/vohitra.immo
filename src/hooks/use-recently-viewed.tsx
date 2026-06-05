import { useCallback, useEffect, useState } from "react";

const KEY = "vohitra-recent";
const MAX = 12;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function trackRecentlyViewed(id: string) {
  if (typeof window === "undefined") return;
  const cur = read().filter((x) => x !== id);
  cur.unshift(id);
  localStorage.setItem(KEY, JSON.stringify(cur.slice(0, MAX)));
  window.dispatchEvent(new Event("vohitra-recent-change"));
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const on = () => setIds(read());
    window.addEventListener("vohitra-recent-change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("vohitra-recent-change", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("vohitra-recent-change"));
  }, []);
  return { ids, clear };
}
