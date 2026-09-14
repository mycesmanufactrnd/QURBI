import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Leaf } from "lucide-react";

/**
 * Minimal branded splash screen shown on Home entry and as the logged-out transition.
 * Fades itself out near the end of `duration`, then calls onDone.
 */
export default function SplashScreen({ duration = 3200, onDone }) {
  const [hiding, setHiding] = useState(false);
  const [showName, setShowName] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const timingScale = duration / 7200;
  const exitDuration = 1200 * timingScale;

  useEffect(() => {
    const nameTimer = window.setTimeout(
      () => setShowName(true),
      400 * timingScale,
    );
    const descriptionTimer = window.setTimeout(
      () => setShowDescription(true),
      1000 * timingScale,
    );
    const exitTimer = window.setTimeout(
      () => setHiding(true),
      Math.max(duration - exitDuration, 0),
    );
    const completionTimer = window.setTimeout(() => onDone?.(), duration);

    return () => {
      window.clearTimeout(nameTimer);
      window.clearTimeout(descriptionTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(completionTimer);
    };
  }, [duration, exitDuration, timingScale]);

  return createPortal(
    <div
      className={`qurbi-splash-background fixed inset-0 z-[9999] isolate flex h-[100dvh] w-screen overflow-hidden flex-col items-center justify-center bg-[#41362D] px-6 transition-opacity ${
        hiding ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${exitDuration}ms` }}
    >
      <Leaf
        className="animate-splash-pop relative z-10 h-20 w-20 text-[#F7EDE2]"
        strokeWidth={1.25}
        style={{ animationDuration: `${1250 * timingScale}ms` }}
      />
      <h1
        className={`relative z-10 mt-6 text-3xl font-extrabold tracking-tight text-[#F1DFCD] transition-all ease-out ${
          showName ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        style={{ transitionDuration: `${1000 * timingScale}ms` }}
      >
        QURBI
      </h1>
      <p
        className={`relative z-10 mt-2 text-center text-sm font-medium tracking-wide text-[#F1DFCD] transition-all ease-out ${
          showDescription
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }`}
        style={{ transitionDuration: `${1000 * timingScale}ms` }}
      >
        Sembelih lembu anda
      </p>
    </div>,
    document.body,
  );
}
