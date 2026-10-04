import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  loading = false,
  onConfirm,
}) {
  const { t } = useTranslation("shared");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">{title ?? t("confirmDialog.title")}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <AlertDialogCancel className="mt-0 flex-1 rounded-full">{cancelText ?? t("confirmDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm?.();
            }}
            disabled={loading}
            className={`flex-1 rounded-full ${destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {confirmText ?? t("confirmDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}