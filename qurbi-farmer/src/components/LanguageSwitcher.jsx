import React from "react";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/i18n";

/**
 * Language picker. `compact` renders two small pills (for the login page);
 * the default is a titled card for the Profile page.
 */
export default function LanguageSwitcher({ compact = false, className = "" }) {
  const { t, i18n } = useTranslation("common");
  const options = SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: code === "ms" ? t("language.malay") : t("language.english"),
  }));

  const buttons = options.map(({ code, label }) => {
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
        {label}
      </button>
    );
  });

  if (compact) {
    return <div role="radiogroup" aria-label={t("language.title")} className={`flex items-center gap-2 ${className}`}>{buttons}</div>;
  }

  return (
    <section className={`soft-card p-4 ${className}`} aria-label={t("language.title")}>
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/60"><Languages className="h-4 w-4 text-primary" /></span>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{t("language.title")}</p>
          <p className="text-sm text-muted-foreground">{t("language.subtitle")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("language.title")}>{buttons}</div>
    </section>
  );
}
