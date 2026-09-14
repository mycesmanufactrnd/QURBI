const CART_ARRIVAL_EVENT = "qurbi:cart-arrived";

export function captureCartAnimationSource(trigger, fallbackImageUrl = "") {
  const scope = trigger?.closest?.("[data-cart-product]") || document;
  const image = scope.querySelector?.("[data-cart-product-image]");
  const rect = (image || trigger)?.getBoundingClientRect?.();
  if (!rect) return null;

  return {
    imageUrl: image?.currentSrc || image?.src || fallbackImageUrl,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}

export function animateProductToCart(source) {
  if (!source || typeof document === "undefined") return;
  const destination = document.querySelector("[data-cart-nav-icon]");
  if (!destination) return;

  const announceArrival = () =>
    document.dispatchEvent(new CustomEvent(CART_ARRIVAL_EVENT));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    announceArrival();
    return;
  }

  const destinationRect = destination.getBoundingClientRect();
  const size = Math.max(
    40,
    Math.min(72, source.rect.width, source.rect.height),
  );
  const startLeft = source.rect.left + source.rect.width / 2 - size / 2;
  const startTop = source.rect.top + source.rect.height / 2 - size / 2;
  const endLeft = destinationRect.left + destinationRect.width / 2 - size / 2;
  const endTop = destinationRect.top + destinationRect.height / 2 - size / 2;

  const flyer = source.imageUrl
    ? Object.assign(document.createElement("img"), {
        src: source.imageUrl,
        alt: "",
      })
    : document.createElement("div");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${startLeft}px`,
    top: `${startTop}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "cover",
    borderRadius: "16px",
    border: "2px solid rgba(247, 237, 226, 0.9)",
    background: "#e3c19f",
    boxShadow: "0 12px 28px rgba(65, 54, 45, 0.32)",
    pointerEvents: "none",
    zIndex: "100",
  });
  document.body.appendChild(flyer);

  const animation = flyer.animate(
    [
      { transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 },
      {
        transform: `translate3d(${(endLeft - startLeft) * 0.55}px, ${(endTop - startTop) * 0.42 - 42}px, 0) scale(0.72)`,
        opacity: 0.92,
        offset: 0.58,
      },
      {
        transform: `translate3d(${endLeft - startLeft}px, ${endTop - startTop}px, 0) scale(0.2)`,
        opacity: 0.25,
      },
    ],
    {
      duration: 980,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );

  animation.finished
    .catch(() => {})
    .finally(() => {
      flyer.remove();
      announceArrival();
    });
}

export { CART_ARRIVAL_EVENT };
