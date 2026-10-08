import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function StepIndicator({ current, className, steps: stepsProp }) {
  const { t } = useTranslation("shared");
  const trackRef = useRef(null);
  const stepRefs = useRef(new Map());
  const steps = stepsProp || [
    { n: 1, label: t("stepIndicator.listingDetails") },
    { n: 2, label: t("stepIndicator.reviewSign") },
  ];

  useEffect(() => {
    const track = trackRef.current;
    const activeStep = stepRefs.current.get(current);
    if (!track || !activeStep) return;
    const targetLeft = activeStep.offsetLeft - (track.clientWidth - activeStep.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [current]);

  return (
    <div ref={trackRef} className={cn("no-scrollbar w-full overflow-x-auto scroll-smooth", className)}>
      <div className="flex min-w-max items-center px-1 py-0.5">
        {steps.map((s, i) => {
          const active = current === s.n;
          const done = current > s.n;
          return (
            <React.Fragment key={s.n}>
              <div
                ref={(element) => { if (element) stepRefs.current.set(s.n, element); else stepRefs.current.delete(s.n); }}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300",
                  active
                    ? "scale-[1.02] bg-primary text-primary-foreground shadow-sm"
                    : done
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    active
                      ? "bg-primary-foreground/20"
                      : done
                        ? "bg-primary/20"
                        : "bg-muted-foreground/15"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : s.n}
                </span>
                {s.label}
              </div>
              {i < steps.length - 1 && <div className={cn("mx-2 h-px w-12 shrink-0 transition-colors duration-300", current > s.n ? "bg-primary/40" : "bg-border")} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
