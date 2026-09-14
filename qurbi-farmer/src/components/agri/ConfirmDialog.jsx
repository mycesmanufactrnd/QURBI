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

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-3">
          <AlertDialogCancel className="mt-0 flex-1 rounded-full">{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm?.();
            }}
            disabled={loading}
            className={`flex-1 rounded-full ${destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}