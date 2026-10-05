import { useTranslation } from "react-i18next";
import { ageInMonths, listingExpiry, livestockStatusMeta } from "@/lib/agri";

/**
 * Display-only helpers for livestock data. Raw values (species, status, gender,
 * breed) are never changed; they are only translated when shown to the user.
 */
export function useLivestockDisplay() {
  const { t, i18n } = useTranslation("livestock");
  const locale = i18n.language?.startsWith("ms") ? "ms-MY" : "en-MY";

  const species = (value) => (value ? t(`species.${value}`, { defaultValue: value }) : "");
  const gender = (value) => (value ? t(`gender.${value}`, { defaultValue: value }) : "");
  const breed = (value) => (value === "Unspecified" ? t("breed.Unspecified") : value);
  const delivery = (value, fallback) => t(`delivery.${value}`, { defaultValue: fallback || value });

  const title = (livestock) => {
    const breedName = livestock?.breed && livestock.breed !== "Unspecified" ? livestock.breed : "";
    const generated = [livestock?.species, breedName].filter(Boolean).join(" - ");
    const custom = livestock?.title && livestock.title !== generated ? livestock.title : "";
    return custom || breedName || species(livestock?.species) || t("display.livestockFallback");
  };

  /** Raw (untranslated) title, used only to decide whether a breed repeats the title. */
  const rawTitle = (livestock) => {
    const breedName = livestock?.breed && livestock.breed !== "Unspecified" ? livestock.breed : "";
    const generated = [livestock?.species, breedName].filter(Boolean).join(" - ");
    const custom = livestock?.title && livestock.title !== generated ? livestock.title : "";
    return custom || breedName || livestock?.species || "";
  };

  const subtitle = (livestock) => {
    const raw = rawTitle(livestock);
    return [
      species(livestock?.species),
      livestock?.breed && livestock.breed !== "Unspecified" && livestock.breed !== raw ? livestock.breed : "",
    ].filter(Boolean).join(" · ");
  };

  const status = (value, livestock) => {
    const meta = livestockStatusMeta(value, livestock);
    const key = livestock && value === "Available" && listingExpiry(livestock).expired ? "Expired" : value;
    return { tone: meta.tone, label: t(`status.${key}`, { defaultValue: meta.label }) };
  };

  const age = (livestock) => {
    const months = ageInMonths(livestock);
    if (months === null) return livestock.age || "—";
    if (months < 12) return t("display.months", { count: months });
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest
      ? `${t("display.years", { count: years })} ${t("display.months", { count: rest })}`
      : t("display.years", { count: years });
  };

  const expiryLabel = (livestock) => {
    const { expiresAt } = listingExpiry(livestock);
    if (!expiresAt) return t("display.renewalUnavailable");
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(expiresAt);
  };

  /** Translate the English reason produced by marketplaceVisibility(). */
  const visibilityReason = (reason) => {
    if (!reason) return "";
    const map = {
      "Species is waiting for superadmin approval": "speciesPending",
      "Species request was rejected": "speciesRejected",
      "Breed is waiting for superadmin approval": "breedPending",
      "Breed request was rejected": "breedRejected",
      "Listing expired after 14 days; farmer confirmation is required": "expired",
      "Age could not be verified": "ageUnverified",
    };
    if (map[reason]) return t(`visibilityReason.${map[reason]}`);
    const threshold = reason.match(/^Below the (\d+)-month marketplace threshold$/);
    if (threshold) return t("visibilityReason.belowThreshold", { months: Number(threshold[1]) });
    return reason;
  };

  return { t, locale, species, gender, breed, delivery, title, subtitle, status, age, expiryLabel, visibilityReason };
}
