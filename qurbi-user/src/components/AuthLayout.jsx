import React from "react";
import { Leaf } from "lucide-react";

export default function AuthLayout({
  mode = "login",
  icon: Icon = null,
  title,
  subtitle = "",
  footer = null,
  onModeChange = null,
  iconClassName = "text-white",
  cardClassName = "",
  titleClassName = "",
  children,
}) {
  const isRegister = mode === "register";
  return (
    <div
      data-page-description={subtitle || undefined}
      className="relative isolate min-h-screen overflow-x-hidden flex flex-col items-center justify-center px-4 py-10 bg-[#F7EDE2]"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] transition-opacity duration-500 ${isRegister ? "opacity-0" : "opacity-100"}`} />
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-[#E8C7A5] to-[#F7EDE2] transition-opacity duration-500 ${isRegister ? "opacity-100" : "opacity-0"}`} />
      {/* Brand */}
      <div className="relative z-10 flex items-center gap-2 mb-6 animate-fade-in-up">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/20">
          <Leaf className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#41362D]">
          QURBI
        </span>
      </div>

      {/* Title block */}
      <div
        className="relative z-10 text-center mb-5 animate-fade-in-up"
        style={{ animationDelay: "60ms" }}
      >
        {Icon && (
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-[#41362D]/20">
            <Icon className={`h-7 w-7 ${iconClassName}`} aria-hidden="true" />
          </div>
        )}
        <h1 className={`text-2xl font-bold text-[#41362D] ${titleClassName}`}>{title}</h1>
      </div>

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-md bg-[#F7EDE2]/90 rounded-3xl shadow-xl shadow-[#41362D]/15 border border-[#E3C19F] p-6 animate-fade-in-up ${cardClassName}`}
        style={{ animationDelay: "120ms" }}
      >
        {onModeChange && <div className="mb-5 grid grid-cols-2 rounded-2xl bg-[#41362D]/10 p-1" aria-label="Authentication mode">
          <button
            type="button"
            onClick={() => onModeChange("login")}
            aria-pressed={!isRegister}
            className={`rounded-xl px-3 py-2 text-center text-sm font-bold transition-all duration-300 ${!isRegister ? "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-md" : "text-[#6B594A]"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onModeChange("register")}
            aria-pressed={isRegister}
            className={`rounded-xl px-3 py-2 text-center text-sm font-bold transition-all duration-300 ${isRegister ? "bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-md" : "text-[#6B594A]"}`}
          >
            Sign Up
          </button>
        </div>}
        {children}
      </div>

      {footer && (
        <p
          className="relative z-10 mt-5 text-center text-sm text-[#6B594A] animate-fade-in-up"
          style={{ animationDelay: "180ms" }}
        >
          {footer}
        </p>
      )}
    </div>
  );
}
