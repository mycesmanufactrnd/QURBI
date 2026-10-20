import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  muted: "bg-muted text-muted-foreground",
  info: "bg-sky-100 text-sky-800",
  primary: "bg-primary/10 text-primary",
};

/** @param {{ tone?: keyof typeof TONES, className?: string, children?: React.ReactNode, icon?: React.ElementType }} props */
export function StatusBadge({ tone = "muted", className, children, icon: Icon }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", TONES[tone] || TONES.muted, className)}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** @param {{ icon?: React.ElementType, title: React.ReactNode, description?: React.ReactNode, action?: React.ReactNode, className?: string }} props */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("soft-card flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem_1.4rem_1.4rem_.55rem] bg-secondary text-secondary-foreground">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function BackButton({ to }) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label={t("back")}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-[0_2px_8px_rgba(65,54,45,0.07)] ring-1 ring-border/70 transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}

/** One clear page title with an optional back button and trailing actions. */
export function PageHeader({ title, description, backTo, actions, className }) {
  return (
    <header className={cn("flex items-start gap-3", className)}>
      {backTo !== undefined && <BackButton to={backTo} />}
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Titled card section. */
export function Card({ title, description, action, children, className, bodyClassName }) {
  return (
    <section className={cn("soft-card overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-extrabold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-primary", className)} aria-hidden="true" />;
}

export function FullPageSpinner({ label }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label={label}>
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function ErrorNotice({ message, onRetry, retryLabel }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="min-w-0 flex-1 break-words text-sm font-semibold text-destructive">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-secondary/40">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-[1.25rem] bg-muted" />)}
    </div>
  );
}
