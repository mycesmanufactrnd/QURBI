import React, { useLayoutEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AuthLayout({
  mode = "login",
  icon: Icon = null,
  title,
  subtitle = "",
  onModeChange = null,
  showLanguageToggle = false,
  iconClassName = "text-white",
  cardClassName = "",
  titleClassName = "",
  children,
}) {
  const { t, i18n } = useTranslation("auth");
  const isRegister = mode === "register";
  const contentRef = useRef(null);
  const previousContentHeightRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    let animationFrame = null;

    const updateHeight = () => {
      const nextHeight = content.scrollHeight;
      const previousHeight = previousContentHeightRef.current;

      if (previousHeight == null) {
        setContentHeight(nextHeight);
      } else {
        setContentHeight(previousHeight);
        animationFrame = requestAnimationFrame(() => setContentHeight(nextHeight));
      }
      previousContentHeightRef.current = nextHeight;
    };

    updateHeight();
    const observer = new ResizeObserver(() => {
      const nextHeight = content.scrollHeight;
      previousContentHeightRef.current = nextHeight;
      setContentHeight(nextHeight);
    });
    observer.observe(content);
    return () => {
      if (animationFrame != null) cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [mode]);

  return (
    <div
      data-page-description={subtitle || undefined}
      className={`relative isolate min-h-screen overflow-x-hidden flex flex-col items-center justify-start px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] ${
        showLanguageToggle
          ? "bg-gradient-to-br from-[#41362D] to-[#6B594A]"
          : "bg-[#F7EDE2]"
      }`}
    >
      {showLanguageToggle ? (
        <div className="qurbi-auth-abstract-background pointer-events-none absolute inset-0" aria-hidden="true" />
      ) : null}

      {showLanguageToggle ? (
        <div
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 grid grid-cols-2 rounded-xl border border-[#6B594A]/25 bg-[#F7EDE2]/55 p-1 shadow-sm backdrop-blur-md"
          role="radiogroup"
          aria-label="Language / Bahasa"
        >
          {[
            { code: "en", label: "EN", fullLabel: "English" },
            { code: "ms", label: "BM", fullLabel: "Bahasa Melayu" },
          ].map(({ code, label, fullLabel }) => {
            const selected = i18n.resolvedLanguage === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={fullLabel}
                title={fullLabel}
                onClick={() => i18n.changeLanguage(code)}
                className={`flex h-9 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-extrabold transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B594A] ${
                  selected
                    ? "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-md"
                    : "text-[#6B594A] hover:bg-[#E3C19F]/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Brand */}
      <div className="relative z-10 mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/20">
          <Leaf className="h-3.5 w-3.5 text-white" />
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-[0.28em] ${showLanguageToggle ? "text-white" : "text-[#41362D]"}`}>
          QURBI
        </span>
      </div>

      {/* Title block */}
      <div
        className="relative z-10 mb-5 text-center"
      >
        {Icon && (
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-[#41362D]/20">
            <Icon className={`h-7 w-7 ${iconClassName}`} aria-hidden="true" />
          </div>
        )}
        <h1 className={`text-2xl font-bold ${showLanguageToggle ? "text-white" : "text-[#41362D]"} ${titleClassName}`}>{title}</h1>
        {subtitle && (
          <p className={`mt-1 max-w-sm text-[15px] ${showLanguageToggle ? "text-white/80" : "text-[#5A493C]"}`}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-md bg-[#FFFDF9]/95 rounded-3xl shadow-xl shadow-[#41362D]/15 border border-[#E3C19F] p-5 sm:p-6 ${cardClassName}`}
      >
        {onModeChange && <div className="mb-5 grid grid-cols-2 rounded-2xl bg-[#41362D]/10 p-1" aria-label={t("authButtons.signIn") + " / " + t("authButtons.signUp")}>
          <button
            type="button"
            onClick={() => onModeChange("login")}
            aria-pressed={!isRegister}
            className={`min-h-11 rounded-xl px-3 py-2 text-center text-sm font-bold transition-all duration-300 ${!isRegister ? "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-md" : "text-[#6B594A]"}`}
          >
            {t("authButtons.signIn")}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("register")}
            aria-pressed={isRegister}
            className={`min-h-11 rounded-xl px-3 py-2 text-center text-sm font-bold transition-all duration-300 ${isRegister ? "bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-md" : "text-[#6B594A]"}`}
          >
            {t("authButtons.signUp")}
          </button>
        </div>}
        <div
          className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
          style={contentHeight == null ? undefined : { height: `${contentHeight}px` }}
        >
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}
