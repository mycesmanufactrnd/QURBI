import React, { useEffect, useRef, useState } from "react";
import { Image } from "@/components/ui/image";
import StatusBadge from "@/components/agri/StatusBadge";
import { formatMYR } from "@/lib/agri";

const STATUS_TONE = {
  Available: "success",
  Reserved: "warning",
  Sold: "muted",
  Sick: "danger",
};

export default function FeaturedListingsCarousel({ items, onView }) {
  const viewportRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const scrollToSlide = (index) => {
    const viewport = viewportRef.current;
    const slide = viewport?.children[index];
    if (!viewport || !slide) return;
    viewport.scrollTo({ left: slide.offsetLeft - viewport.offsetLeft, behavior: "smooth" });
  };

  useEffect(() => {
    if (items.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      const next = (activeIndex + 1) % items.length;
      scrollToSlide(next);
      setActiveIndex(next);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeIndex, items.length, paused]);

  const updateActiveSlide = () => {
    const viewport = viewportRef.current;
    if (!viewport?.children.length) return;
    const nearest = Array.from(viewport.children).reduce((best, child, index) => {
      const distance = Math.abs(child.offsetLeft - viewport.scrollLeft - viewport.offsetLeft);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    setActiveIndex(nearest.index);
  };

  return (
    <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div
        ref={viewportRef}
        onScroll={updateActiveSlide}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2"
      >
        {items.map((livestock) => {
          const cover = livestock.coverImage || livestock.images?.[0];
          return (
            <article
              key={livestock.id}
              role="button"
              tabIndex={0}
              onClick={() => onView(livestock)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onView(livestock);
                }
              }}
              aria-label={`View ${livestock.species || "livestock"} listing`}
              className="soft-card min-w-full cursor-pointer snap-start overflow-hidden transition-all hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[calc(50%-0.375rem)] lg:min-w-[calc(33.333%-0.5rem)]"
            >
              <div className="relative aspect-[16/10] bg-muted">
                <Image src={cover} fittingType="fill" alt={`${livestock.species || "Livestock"} listing`} className="h-full w-full" />
              </div>
              <div className="p-4">
                <h3 className="truncate text-xl font-extrabold leading-tight text-primary">{livestock.species || "Livestock"}</h3>
                <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{livestock.breed || "Unspecified"}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="truncate text-xl font-extrabold tracking-tight text-foreground">{formatMYR(livestock.price)}</p>
                  <StatusBadge className="shrink-0" tone={STATUS_TONE[livestock.status] || "muted"} dot>{livestock.status || "Listing"}</StatusBadge>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-label={`Slide ${activeIndex + 1} of ${items.length}`}>
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                scrollToSlide(index);
                setActiveIndex(index);
              }}
              className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-6 bg-primary" : "w-2 bg-primary/20"}`}
              aria-label={`Show listing ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
