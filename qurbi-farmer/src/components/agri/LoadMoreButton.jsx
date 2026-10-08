import React from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LoadMoreButton({ shown, total, onClick }) {
  const { t } = useTranslation("shared");
  const remaining = Math.max(0, total - shown);
  if (!remaining) return null;

  return (
    <button type="button" onClick={onClick} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-bold text-primary transition-colors hover:bg-muted/40">
      {t("progressiveList.loadMore", { count: remaining })}
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}
