import { Link } from "@tanstack/react-router";
import { useCompare } from "@/hooks/use-compare";
import { X, GitCompare } from "lucide-react";

export function CompareBar() {
  const { ids, remove, clear } = useCompare();
  if (ids.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card border border-border shadow-2xl rounded-2xl px-3 py-2 flex items-center gap-2 max-w-[95vw]">
      <GitCompare className="size-4 text-primary shrink-0" />
      <span className="text-xs font-medium hidden sm:inline">
        Comparer ({ids.length}/3)
      </span>
      <div className="flex items-center gap-1">
        {ids.map((id) => (
          <button
            key={id}
            onClick={() => remove(id)}
            className="text-[10px] font-mono bg-muted hover:bg-destructive hover:text-destructive-foreground px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
            title="Retirer"
          >
            {id.slice(0, 6)}
            <X className="size-3" />
          </button>
        ))}
      </div>
      {ids.length >= 2 ? (
        <Link
          to="/compare"
          className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90"
        >
          Comparer
        </Link>
      ) : (
        <span className="text-[10px] text-muted-foreground italic px-2">
          Ajouter au moins 2 biens
        </span>
      )}
      <button onClick={clear} className="text-muted-foreground hover:text-destructive p-1" title="Tout effacer">
        <X className="size-4" />
      </button>
    </div>
  );
}
