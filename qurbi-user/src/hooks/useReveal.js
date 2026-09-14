/**
 * Shared entrance transition for all pages.
 * Returns a `reveal()` class helper that plays a fade-in-up CSS animation
 * on element mount — works for both static and async-loaded content.
 * Apply `reveal()` + inline `style={{ animationDelay: "Nms" }}` for staggered sections.
 */
export function useReveal() {
  const reveal = () => "animate-fade-in-up";
  return { mounted: true, reveal };
}