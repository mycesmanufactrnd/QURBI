import React from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";

/**
 * Language picker. `compact` renders two small pills for the login page;
 * the default is a two-button card for the Profile page.
 * @param {{ compact?: boolean, className?: string }} props
 */
export default function LanguageSwitcher({ compact = false, className = "" }) {
  const { t, i18n } = useTranslation("profile");

  return (
    <div role="radiogroup" aria-label={t("language")} className={compact ? `flex items-center gap-2 ${className}` : `grid grid-cols-2 gap-2 ${className}`}>
      {SUPPORTED_LANGUAGES.map((code) => {
        const selected = i18n.resolvedLanguage === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => i18n.changeLanguage(code)}
            className={compact
              ? `inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-bold ring-1 transition-colors ${selected ? "bg-white text-primary ring-white" : "bg-white/10 text-white ring-white/25 hover:bg-white/20"}`
              : `flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-[15px] font-bold transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary/40"}`}
          >
            {selected && <Check className="h-4 w-4 flex-none" aria-hidden="true" />}
            {t(`languages.${code}`)}
          </button>
        );
      })}
    </div>
  );
}
