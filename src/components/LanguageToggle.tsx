import { Languages } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { LOCALES, type Locale } from "@/i18n/translations";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <details className={`relative group ${className}`}>
      <summary
        className="list-none cursor-pointer select-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-muted transition-colors min-h-9"
        aria-label={t("nav.language")}
      >
        <Languages className="size-4 text-primary" />
        <span className="text-xs font-semibold uppercase">{current.code}</span>
      </summary>
      <div className="absolute right-0 mt-2 w-44 bg-popover border border-border rounded-xl shadow-lg p-1.5 z-50 flex flex-col">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={(e) => {
              setLocale(l.code as Locale);
              // close the <details>
              const d = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
              if (d) d.open = false;
            }}
            className={`text-left px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 text-sm ${
              l.code === locale ? "font-semibold text-primary" : ""
            }`}
          >
            <span aria-hidden>{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === locale && <span className="text-xs">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}
