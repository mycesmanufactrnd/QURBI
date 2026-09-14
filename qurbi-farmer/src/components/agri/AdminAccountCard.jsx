import React from "react";
import { ChevronRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

export default function AdminAccountCard({
  name,
  email,
  subtitle,
  badge,
  meta = [],
  onClick,
  accent = "primary",
}) {
  const Component = onClick ? "button" : "article";
  const accentClass = accent === "buyer"
    ? "bg-sky-100 text-sky-700"
    : "bg-secondary text-primary";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "soft-card group w-full overflow-hidden p-0 text-left",
        onClick && "transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold", accentClass)}>
          {initials(name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-extrabold text-foreground sm:text-base">{name}</h2>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{subtitle}</p>}
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{email || "Email unavailable"}</span>
          </p>
        </div>
      </div>

      {meta.length > 0 && (
        <div className={cn("grid border-t border-border/70 bg-muted/30", meta.length > 1 && "sm:grid-cols-2 sm:divide-x sm:divide-border/70")}>
          {meta.map(({ icon: Icon, label, value }) => (
            <div key={label} className="min-w-0 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                {label}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      {onClick && (
        <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-xs font-bold text-primary">
          <span>View account</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </Component>
  );
}
