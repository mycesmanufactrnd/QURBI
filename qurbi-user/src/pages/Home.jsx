import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Leaf,
  ShoppingCart,
  Package,
  User,
  ChevronRight,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useReveal } from "@/hooks/useReveal";
import SplashScreen from "@/components/SplashScreen";
import { useAuth } from "@/lib/AuthContext";
import AppHeader from "@/components/AppHeader";
import ViewCartCard from "@/components/ViewCartCard";
import cowImage from "@/assets/home-categories/Lembu-white.png";
import goatImage from "@/assets/home-categories/Kambing-white.png";

const QUICK_ACTIONS = [
  { icon: Leaf, label: "Browse", path: "/browse" },
  { icon: Boxes, label: "Bulk Buy", path: "/bulk-buy" },
  { icon: ShoppingCart, label: "Cart", path: "/cart" },
  { icon: Package, label: "Orders", path: "/history" },
  { icon: User, label: "Profile", path: "/profile" },
];

const CHIP_TINTS = ["bg-gradient-to-br from-[#41362D] to-[#6B594A]"];
const HOME_SPECIES = ["Cow", "Goat"];
const HOME_SPECIES_IMAGES = { Cow: cowImage, Goat: goatImage };
const HIGHLIGHTS = [
  {
    title: "Find Your Qurban Livestock",
    description: "Explore available cattle and goats from trusted farmers.",
    path: "/browse",
    action: "Browse Livestock",
    icon: Leaf,
    gradient: "from-[#41362D] to-[#6B594A]",
  },
  {
    title: "Buy Complete Bulk Lots",
    description: "Secure a full livestock lot with one simple purchase.",
    path: "/bulk-buy",
    action: "Explore Bulk Buy",
    icon: Boxes,
    gradient: "from-[#6B594A] to-[#41362D]",
  },
  {
    title: "Follow Every Order Stage",
    description: "Review progress updates and track your active purchases.",
    path: "/orders",
    action: "Track Orders",
    icon: Package,
    gradient: "from-[#41362D] via-[#6B594A] to-[#4B3E34]",
  },
];
const BOOTSTRAP_FAILSAFE_MS = 6500;
const SPLASH_DURATION_MS = 3200;

export default function Home() {
  const { totalItems, totalPrice } = useCart();

  const { reveal } = useReveal();

  const { authChecked, isLoadingAuth, isLoadingPublicSettings } = useAuth();

  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem("gh_splash_shown"),
  );
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const [bootstrapReleased, setBootstrapReleased] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState(0);
  const [highlightsPaused, setHighlightsPaused] = useState(false);
  const [highlightDragX, setHighlightDragX] = useState(0);
  const highlightTouchStartX = useRef(null);
  const highlightDragXRef = useRef(0);
  const blockHighlightClick = useRef(false);

  const sessionReady =
    authChecked && !isLoadingAuth && !isLoadingPublicSettings;

  useEffect(() => {
    if (sessionReady) return undefined;
    const timer = window.setTimeout(
      () => setBootstrapReleased(true),
      BOOTSTRAP_FAILSAFE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [sessionReady]);

  useEffect(() => {
    if (showSplash) {
      sessionStorage.setItem("gh_splash_shown", "1");
    }
  }, [showSplash]);

  useEffect(() => {
    const allowSplashAfterReload = () => {
      sessionStorage.removeItem("gh_splash_shown");
    };
    window.addEventListener("beforeunload", allowSplashAfterReload);
    return () =>
      window.removeEventListener("beforeunload", allowSplashAfterReload);
  }, []);

  useEffect(() => {
    if (highlightsPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveHighlight((current) => (current + 1) % HIGHLIGHTS.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [highlightsPaused]);

  useEffect(() => {
    if (
      showSplash &&
      splashAnimationDone &&
      (sessionReady || bootstrapReleased)
    ) {
      setShowSplash(false);
    }
  }, [
    bootstrapReleased,
    sessionReady,
    showSplash,
    splashAnimationDone,
  ]);

  const handleHighlightTouchStart = (event) => {
    highlightTouchStartX.current = event.touches[0]?.clientX ?? null;
    highlightDragXRef.current = 0;
    blockHighlightClick.current = false;
    setHighlightsPaused(true);
  };

  const handleHighlightTouchMove = (event) => {
    if (highlightTouchStartX.current === null) return;
    const currentX = event.touches[0]?.clientX;
    if (currentX === undefined) return;
    const distance = currentX - highlightTouchStartX.current;
    const clampedDistance = Math.max(-90, Math.min(90, distance));
    highlightDragXRef.current = clampedDistance;
    setHighlightDragX(clampedDistance);
    if (Math.abs(distance) > 10) blockHighlightClick.current = true;
  };

  const handleHighlightTouchEnd = () => {
    const swipeDistance = highlightDragXRef.current;
    if (Math.abs(swipeDistance) >= 45) {
      setActiveHighlight((current) =>
        swipeDistance < 0
          ? (current + 1) % HIGHLIGHTS.length
          : (current - 1 + HIGHLIGHTS.length) % HIGHLIGHTS.length,
      );
    }
    highlightTouchStartX.current = null;
    highlightDragXRef.current = 0;
    setHighlightDragX(0);
    setHighlightsPaused(false);
  };

  // Keep the existing launch/transition splash on screen until both the
  // minimum animation and authentication bootstrap have completed.
  if (showSplash || (!sessionReady && !bootstrapReleased)) {
    return (
      <SplashScreen
        duration={SPLASH_DURATION_MS}
        onDone={() => {
          setSplashAnimationDone(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] pb-24">
      <AppHeader
        title="Browse Livestock"
        subtitle="Browse livestock, manage your cart and track your orders."
        guestActionsOnLeft
        titleClassName="text-2xl sm:text-3xl"
        subtitleClassName="text-base"
      />

      <ViewCartCard totalItems={totalItems} totalPrice={totalPrice} />

      {/* ========================================================= */}
      {/* MAIN CONTENT */}
      {/* ========================================================= */}

      <div className="space-y-6 px-5 pt-5">
        {/* ======================================================= */}
        {/* QUICK ACTIONS */}
        {/* ======================================================= */}

        <section
          className={`${reveal()} rounded-3xl border border-[#41362D]/20 bg-white/55 p-4 shadow-sm sm:p-5`}
          style={{ animationDelay: "140ms" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#41362D] sm:text-lg">
              Quick Actions
            </h2>
            <span className="flex items-center gap-1 text-xs font-bold text-[#41362D]/65">
              Swipe <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
            {QUICK_ACTIONS.map(({ icon: Icon, label, path }, i) => (
              <Link
                key={label}
                to={path}
                viewTransition
                className={`${reveal()} flex w-24 flex-none flex-col items-center gap-2.5 text-center transition-all duration-200 ease-out active:scale-[0.98]`}
                style={{
                  animationDelay: `${180 + i * 60}ms`,
                }}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-lg shadow-black/20 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <p className="w-full break-words text-base font-bold text-[#41362D]">
                  {label}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ======================================================= */}
        {/* ANIMAL CATEGORIES */}
        {/* ======================================================= */}

        <div className={reveal()} style={{ animationDelay: "260ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#41362D] sm:text-lg">
              Categories
            </h2>
          </div>

          <div className="grid grid-cols-2 justify-items-center gap-3 sm:gap-4">
            {/* Categories */}
            {HOME_SPECIES.map((label, i) => (
              <Link
                key={label}
                to="/browse"
                state={{ species: label }}
                className={`
                    flex
                    w-full
                    flex-col
                    items-center
                    gap-2
                    rounded-2xl
                    qurbi-category-card
                    transition-[translate,box-shadow]
                    duration-300
                    ease-out
                    px-3
                    py-5
                    ${CHIP_TINTS[i % CHIP_TINTS.length]}
                    ${reveal()}
                  `}
                style={{
                  animationDelay: `${300 + i * 50}ms`,
                }}
              >
                <span className="flex h-5 w-[140px] sm:w-[180px] items-center justify-center rounded-xl sm:h-20">
                  <img
                    data-no-contrast-outline
                    src={HOME_SPECIES_IMAGES[label]}
                    alt={label}
                    className="h-10 w-10 object-contain px-1"
                  />
                </span>

                <span className="text-base font-bold text-white sm:text-lg">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <section
          className={`${reveal()} touch-pan-y select-none`}
          style={{ animationDelay: "360ms" }}
          aria-label="Highlights"
          onMouseEnter={() => setHighlightsPaused(true)}
          onMouseLeave={() => setHighlightsPaused(false)}
          onTouchStart={handleHighlightTouchStart}
          onTouchMove={handleHighlightTouchMove}
          onTouchEnd={handleHighlightTouchEnd}
          onTouchCancel={handleHighlightTouchEnd}
          onClickCapture={(event) => {
            if (blockHighlightClick.current) {
              event.preventDefault();
              event.stopPropagation();
              blockHighlightClick.current = false;
            }
          }}
          onFocus={() => setHighlightsPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setHighlightsPaused(false);
            }
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#41362D] sm:text-lg">
              Highlights
            </h2>
            <span className="text-xs font-semibold text-[#6B594A]">
              {activeHighlight + 1} / {HIGHLIGHTS.length}
            </span>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/20 shadow-[0_16px_35px_-15px_rgba(65,54,45,0.65),0_6px_14px_-8px_rgba(65,54,45,0.45)] ring-1 ring-[#41362D]/10">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(calc(-${activeHighlight * 100}% + ${highlightDragX}px))`,
                transitionDuration: highlightDragX ? "0ms" : undefined,
              }}
            >
              {HIGHLIGHTS.map(
                ({ title, description, path, action, icon: Icon, gradient }) => (
                  <Link
                    key={title}
                    to={path}
                    viewTransition
                    className={`relative flex min-h-40 w-full min-w-full items-center gap-4 overflow-hidden bg-gradient-to-br ${gradient} p-5 text-left text-white before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-70 sm:min-h-44 sm:p-6`}
                  >
                    <span className="relative z-10 flex h-14 w-14 flex-none items-center justify-center rounded-2xl border border-white/25 bg-white/10 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.65)] backdrop-blur-sm">
                      <Icon className="h-7 w-7" />
                    </span>
                    <span className="relative z-10 min-w-0 flex-1">
                      <span className="block text-lg font-extrabold leading-tight sm:text-xl">
                        {title}
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-white/70">
                        {description}
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#F1DFCD]">
                        {action} <ChevronRight className="h-4 w-4" />
                      </span>
                    </span>
                  </Link>
                ),
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-center gap-2">
            {HIGHLIGHTS.map((highlight, index) => (
              <button
                key={highlight.title}
                type="button"
                onClick={() => setActiveHighlight(index)}
                aria-label={`Show highlight ${index + 1}: ${highlight.title}`}
                aria-current={activeHighlight === index ? "true" : undefined}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  activeHighlight === index
                    ? "w-7 bg-[#41362D]"
                    : "w-2.5 bg-[#E3C19F]"
                }`}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
