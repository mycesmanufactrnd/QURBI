import React from "react";
import { SPECIES } from "@/lib/agri";
import { useLivestockDisplay } from "@/lib/livestockDisplay";
import { cn } from "@/lib/utils";

/**
 * @param {{ value?: string, onChange: (selection: { species: string, speciesRequestId: string, speciesApprovalStatus: string }) => void }} props
 */
export default function SpeciesSelector({ value, onChange }) {
  const { t, species: speciesLabel } = useLivestockDisplay();
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
      >
        <SelectTrigger className="h-12"><SelectValue placeholder={t("speciesSelector.placeholder")} /></SelectTrigger>
        <SelectContent>
          {SPECIES.map((species) => <SelectItem key={species} value={species}>{speciesLabel(species)}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t("speciesSelector.supportedNote")}</p>
      {value && !supportedValue && (
        <p className="text-xs font-medium text-destructive">{t("speciesSelector.legacyNote")}</p>
      )}
    </div>
  );
}
