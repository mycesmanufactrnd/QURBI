import React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  muted: "bg-muted text-muted-foreground",
  info: "bg-sky-100 text-sky-700",
  primary: "bg-primary/10 text-primary",
};

const DOTS = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  muted: "bg-muted-foreground/50",
  info: "bg-sky-500",
  primary: "bg-primary",
};

export default function StatusBadge({ tone = "muted", dot = false, children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        TONES[tone] || TONES.muted,
        className
      )}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", DOTS[tone] || DOTS.muted)} />}
      {children}
    </span>
  );
}
