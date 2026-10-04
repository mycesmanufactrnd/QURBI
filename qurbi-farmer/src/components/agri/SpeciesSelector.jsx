import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPECIES } from "@/lib/agri";
import { useLivestockDisplay } from "@/lib/livestockDisplay";

/**
 * @param {{ value?: string, onChange: (selection: { species: string, speciesRequestId: string, speciesApprovalStatus: string }) => void }} props
 */
export default function SpeciesSelector({ value, onChange }) {
  const { t, species: speciesLabel } = useLivestockDisplay();
  const supportedValue = SPECIES.includes(value) ? value : "";

  return (
    <div className="space-y-2">
      <Select
        value={supportedValue}
        onValueChange={(species) => onChange({
          species,
          speciesRequestId: "",
          speciesApprovalStatus: "Approved",
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
