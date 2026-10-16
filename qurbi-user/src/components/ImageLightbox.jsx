import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.35;

const imageUrl = (value) => {
  if (typeof value === "string") return value.trim();
  return value?.url || value?.file_url || value?.src || "";
};

const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export default function ImageLightbox({
  image = "",
  images = [],
  initialIndex = 0,
  alt = "",
  onClose,
}) {
  const { t } = useTranslation("listings");
  const resolvedAlt = alt || t("imageLightbox.imagePreview");
  const gallery = useMemo(() => {
    const sources = Array.isArray(images) && images.length ? images : image ? [image] : [];
    return sources
      .map(imageUrl)
      .filter((source, index, entries) => source && entries.indexOf(source) === index);
  }, [image, images]);
  const requestedIndex = image ? gallery.indexOf(imageUrl(image)) : initialIndex;
  const galleryKey = gallery.join("\u001f");
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, requestedIndex));
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [failed, setFailed] = useState(false);
  const [closing, setClosing] = useState(false);
  const touchRef = useRef(null);
  const closeButtonRef = useRef(null);
  const closeTimerRef = useRef(null);
  const currentImage = image
    ? gallery[currentIndex] || gallery[0] || ""
    : "";
  const hasMultipleImages = gallery.length > 1;

  const resetZoom = useCallback(() => setZoom(MIN_ZOOM), []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 160);
  }, [closing, onClose]);

  const showImage = useCallback((nextIndex) => {
    if (!gallery.length) return;
    setCurrentIndex((nextIndex + gallery.length) % gallery.length);
    setFailed(false);
    setZoom(MIN_ZOOM);
  }, [gallery.length]);

  const showPrevious = useCallback(() => {
    showImage(currentIndex - 1);
  }, [currentIndex, showImage]);

  const showNext = useCallback(() => {
    showImage(currentIndex + 1);
  }, [currentIndex, showImage]);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setCurrentIndex(Math.max(0, requestedIndex));
    setFailed(false);
    setZoom(MIN_ZOOM);
    setClosing(false);
  }, [galleryKey, image, requestedIndex]);

  useEffect(() => {
    if (!currentImage) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
      else if (event.key === "ArrowLeft" && hasMultipleImages) showPrevious();
      else if (event.key === "ArrowRight" && hasMultipleImages) showNext();
      else if (event.key === "+" || event.key === "=") {
        setZoom((current) => clampZoom(current + ZOOM_STEP));
      } else if (event.key === "-") {
        setZoom((current) => clampZoom(current - ZOOM_STEP));
      } else if (event.key === "0") {
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentImage, hasMultipleImages, requestClose, resetZoom, showNext, showPrevious]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!currentImage) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [currentImage]);

  if (!currentImage || typeof document === "undefined") return null;

  const controlClass =
    "flex h-10 w-10 items-center justify-center rounded-full border border-[#E3C19F]/70 bg-[#41362D]/90 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

  const touchDistance = (touches) => {
    const [first, second] = touches;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/85 p-3 backdrop-blur-md duration-200 sm:p-6 ${closing ? "animate-out fade-out-0" : "animate-in fade-in-0"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("imageLightbox.imagePreview")}
      onClick={requestClose}
    >
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center justify-between sm:inset-x-6 sm:top-6">
        <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
          {currentIndex + 1} / {gallery.length}
        </span>
        <div className="pointer-events-auto flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <button type="button" aria-label={t("imageLightbox.zoomOut")} title={t("imageLightbox.zoomOut")}
            onClick={() => setZoom((current) => clampZoom(current - ZOOM_STEP))} disabled={zoom <= MIN_ZOOM} className={controlClass}>
            <ZoomOut className="h-5 w-5" />
          </button>
          <button type="button" aria-label={t("imageLightbox.resetZoom")} title={t("imageLightbox.resetZoom")}
            onClick={resetZoom} disabled={zoom === MIN_ZOOM} className={controlClass}>
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" aria-label={t("imageLightbox.zoomIn")} title={t("imageLightbox.zoomIn")}
            onClick={() => setZoom((current) => clampZoom(current + ZOOM_STEP))} disabled={zoom >= MAX_ZOOM} className={controlClass}>
            <ZoomIn className="h-5 w-5" />
          </button>
          <button ref={closeButtonRef} type="button" aria-label={t("imageLightbox.closePreview")} title={t("imageLightbox.closePreview")}
            onClick={requestClose} className={controlClass}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {hasMultipleImages && (
        <>
          <button type="button" aria-label={t("imageLightbox.previousImage")}
            onClick={(event) => { event.stopPropagation(); showPrevious(); }}
            className={`${controlClass} absolute left-5 top-1/2 z-30 hidden -translate-y-1/2 sm:flex`}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" aria-label={t("imageLightbox.nextImage")}
            onClick={(event) => { event.stopPropagation(); showNext(); }}
            className={`${controlClass} absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 sm:flex`}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="flex h-full w-full touch-none select-none items-center justify-center px-0 pb-10 pt-16 sm:px-14 sm:pb-0 sm:pt-12"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.stopPropagation();
            requestClose();
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            touchRef.current = { pinching: true, distance: touchDistance(event.touches), zoom };
          } else if (event.touches.length === 1) {
            touchRef.current = {
              pinching: false,
              startX: event.touches[0].clientX,
              startY: event.touches[0].clientY,
              lastX: event.touches[0].clientX,
              lastY: event.touches[0].clientY,
            };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2 && touchRef.current?.pinching) {
            event.preventDefault();
            const ratio = touchDistance(event.touches) / Math.max(touchRef.current.distance, 1);
            setZoom(clampZoom(touchRef.current.zoom * ratio));
          } else if (event.touches.length === 1 && touchRef.current && !touchRef.current.pinching) {
            touchRef.current.lastX = event.touches[0].clientX;
            touchRef.current.lastY = event.touches[0].clientY;
          }
        }}
        onTouchEnd={() => {
          const gesture = touchRef.current;
          touchRef.current = null;
          if (!gesture || gesture.pinching || zoom > MIN_ZOOM || !hasMultipleImages) return;
          const deltaX = (gesture.lastX ?? gesture.startX) - gesture.startX;
          const deltaY = (gesture.lastY ?? gesture.startY) - gesture.startY;
          if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
            if (deltaX > 0) showPrevious();
            else showNext();
          }
        }}
      >
        {failed ? (
          <div className="rounded-2xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-8 py-7 text-center text-sm font-bold text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}>
            {t("imageLightbox.loadError")}
          </div>
        ) : (
          <img src={currentImage} alt={resolvedAlt} draggable="false" onError={() => setFailed(true)}
            onClick={(event) => event.stopPropagation()}
            className={`max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-transform duration-200 ease-out ${closing ? "animate-out zoom-out-95" : "animate-in zoom-in-95"}`}
            style={{ transform: `scale(${zoom})` }} />
        )}
      </div>
    </div>,
    document.body,
  );
}
