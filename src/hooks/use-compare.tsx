import { useCallback, useEffect, useState } from "react";

const KEY = "vohitra-compare";
export const MAX_COMPARE = 3;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function emit() {
  window.dispatchEvent(new Event("vohitra-compare-change"));
}

export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const onChange = () => setIds(read());
    window.addEventListener("vohitra-compare-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("vohitra-compare-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    let next: string[];
    if (cur.includes(id)) next = cur.filter((x) => x !== id);
    else if (cur.length >= MAX_COMPARE) next = cur;
    else next = [...cur, id];
    localStorage.setItem(KEY, JSON.stringify(next));
    emit();
    return next;
  }, []);

  const remove = useCallback((id: string) => {
    const next = read().filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
    emit();
  }, []);

  const clear = useCallback(() => {
    localStorage.setItem(KEY, JSON.stringify([]));
    emit();
  }, []);

  return { ids, toggle, remove, clear, isFull: ids.length >= MAX_COMPARE };
}
