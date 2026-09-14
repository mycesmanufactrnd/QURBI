import React from "react";
import { cn } from "@/lib/utils";

export default function CowSilhouetteIcon({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: "url('/images/cow-silhouette-taupe.png?v=2')",
        maskImage: "url('/images/cow-silhouette-taupe.png?v=2')",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
