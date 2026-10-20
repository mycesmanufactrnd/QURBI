import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNotice, ListSkeleton, PageHeader } from "@/components/ui-kit";
import { notificationApi } from "@/api/apiClient";
import { errorText, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const { t, i18n } = useTranslation(["notifications", "common"]);
  const navigate = useNavigate();
  const locale = i18n.language === "ms" ? "ms-MY" : "en-MY";
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  const load = useCallback(async () => {
    try {
      const items = await notificationApi.list();
      setState({ loading: false, error: "", items });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: errorText(error, t) }));
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const open = async (item) => {
    if (!item.isRead) {
      setState((current) => ({ ...current, items: current.items.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)) }));
      notificationApi.markRead(item.id).catch(() => {});
    }
    // Only follow in-app paths the backend wrote; anything else is ignored.
    if (typeof item.linkUrl === "string" && item.linkUrl.startsWith("/") && !item.linkUrl.startsWith("//")) navigate(item.linkUrl);
  };

  const markAll = async () => {
    setState((current) => ({ ...current, items: current.items.map((row) => ({ ...row, isRead: true })) }));
    notificationApi.markAllRead().catch(() => load());
  };

  const unread = state.items.filter((item) => !item.isRead).length;

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title={t("title", { ns: "notifications" })}
        actions={unread > 0 ? <Button variant="outline" className="h-11" onClick={markAll}><CheckCheck className="h-4 w-4" />{t("markAll", { ns: "notifications" })}</Button> : null}
      />
      <ErrorNotice message={state.error} onRetry={load} retryLabel={t("retry", { ns: "common" })} />
      {state.loading ? <ListSkeleton /> : state.items.length ? (
        <ul className="grid gap-2.5">
          {state.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={cn(
                  "soft-card flex w-full min-w-0 items-start gap-3 p-4 text-left transition-colors hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !item.isRead && "border-primary/30 bg-primary/[0.04]",
                )}
              >
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-extrabold">{item.title}{!item.isRead && <span className="sr-only"> ({t("unread", { ns: "notifications" })})</span>}</span>
                  <span className="mt-0.5 block break-words text-sm text-muted-foreground">{item.body}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(item.createdAt, locale)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !state.error && <EmptyState icon={Bell} title={t("empty", { ns: "notifications" })} description={t("emptyHint", { ns: "notifications" })} />
      )}
    </div>
  );
}
