import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { n: 1, label: "Listing Details" },
  { n: 2, label: "Review & Sign" },
];

export default function StepIndicator({ current, className, steps = STEPS }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((s, i) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <React.Fragment key={s.n}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold",
                  active
                    ? "bg-primary-foreground/20"
                    : done
                      ? "bg-primary/20"
                      : "bg-muted-foreground/15"
                )}
              >
                {done ? <Check className="w-3 h-3" /> : s.n}
              </span>
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1 min-w-3", current > s.n ? "bg-primary/40" : "bg-border")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
