import React from "react";
import { Leaf } from "lucide-react";

export default function AuthLayout({
  icon: Icon,
  title,
  subtitle,
  footer,
  children,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] flex flex-col items-center justify-center px-4 py-10">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-6 animate-fade-in-up">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#41362D] to-[#6B594A] flex items-center justify-center shadow-md shadow-[#41362D]/20">
          <Leaf className="w-4 h-4 text-white" />
        </div>
        <span className="text-[#41362D] font-bold text-sm tracking-[0.16em]">
          QURBI
        </span>
      </div>

      {/* Title block */}
      <div
        className="text-center mb-5 animate-fade-in-up"
        style={{ animationDelay: "60ms" }}
      >
        {Icon && (
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-[#41362D]/20 mb-3">
            <Icon className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-[#41362D]">{title}</h1>
        {subtitle && <p className="text-[#6B594A] text-sm mt-1">{subtitle}</p>}
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md bg-[#F7EDE2]/90 rounded-3xl shadow-xl shadow-[#41362D]/15 border border-[#E3C19F] p-6 animate-fade-in-up"
        style={{ animationDelay: "120ms" }}
      >
        {children}
      </div>

      {footer && (
        <p
          className="text-center text-sm text-[#6B594A] mt-5 animate-fade-in-up"
          style={{ animationDelay: "180ms" }}
        >
          {footer}
        </p>
      )}
    </div>
  );
}
