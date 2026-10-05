import React from "react";
import { SPECIES } from "@/lib/agri";
import { cn } from "@/lib/utils";

export default function SpeciesSelector({ value, onChange }) {
  const supportedValue = SPECIES.includes(value) ? value : "";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Species">
        {SPECIES.map((species) => {
          const selected = supportedValue === species;
          return (
            <button
              key={species}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({
                species,
                speciesRequestId: "",
                speciesApprovalStatus: "Approved",
              })}
              className={cn(
                "h-12 rounded-xl border px-3 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {species}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">QURBI currently supports Cow and Goat listings only.</p>
      {value && !supportedValue && (
        <p className="text-xs font-medium text-destructive">This legacy species is no longer supported. Select Cow or Goat to continue.</p>
      )}
    </div>
  );
}
