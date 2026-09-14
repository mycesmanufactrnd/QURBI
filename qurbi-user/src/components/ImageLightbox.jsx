import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function ImageLightbox({ image, alt = "Image preview", onClose }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image]);

  useEffect(() => {
    if (!image) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [image, onClose]);

  useEffect(() => {
    if (!image) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [image]);

  if (!image) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-4xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close image preview"
          onClick={onClose}
          className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-lg active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        {failed ? (
          <div className="rounded-2xl bg-white px-6 py-5 text-center text-sm font-medium text-gray-500">
            This image could not be loaded.
          </div>
        ) : (
          <img
            src={image}
            alt={alt}
            onError={() => setFailed(true)}
            className="max-h-[calc(100dvh-3rem)] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
