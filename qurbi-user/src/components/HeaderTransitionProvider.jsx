import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";

const NORMAL_EXIT_MS = 280;
const ICON_OPEN_DELAY_MS = 48;
const ICON_EXIT_MS = 560;
const ENTER_MS = 680;
const PRODUCT_EXPAND_MS = 760;
const PRODUCT_REVEAL_MS = 480;
const FAILSAFE_MS = 2400;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const HeaderTransitionContext = createContext({
  phase: "idle",
  isContracting: false,
  isIconOpening: false,
  isIconClosing: false,
  iconOrigin: null,
  transitionType: null,
  productTransition: null,
  /** @type {(...args: any[]) => any} */
  beginIconTransition: () => {},
  /** @type {(...args: any[]) => any} */
  navigateWithTransition: () => {},
  /** @type {(...args: any[]) => any} */
  navigateFromIconPage: () => {},
  /** @type {(...args: any[]) => any} */
  navigateFromProductCard: () => {},
  /** @type {(...args: any[]) => any} */
  completeProductTransition: () => {},
  /** @type {(...args: any[]) => any} */
  requestIconClose: () => {},
  /** @type {(...args: any[]) => any} */
  completeIconClose: () => {},
});

export function useHeaderTransition() {
  return useContext(HeaderTransitionContext);
}

const iconTypeForPath = (pathname) =>
  pathname === "/notifications"
    ? "notification"
    : pathname === "/profile"
      ? "profile"
      : null;

export default function HeaderTransitionProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const persistedIconOrigin = location.state?.iconOrigin || null;
  const [phase, setPhase] = useState("idle");
  const [iconOrigin, setIconOrigin] = useState(persistedIconOrigin);
  const [transitionType, setTransitionType] = useState(null);
  const [productTransition, setProductTransition] = useState(null);
  const productTransitionRef = useRef(null);
  const lockedRef = useRef(false);
  const transitionRunRef = useRef(0);
  const iconOriginRef = useRef(persistedIconOrigin);
  const iconExitLocationKeyRef = useRef(null);
  const closingFromIconRef = useRef(false);
  const iconOpenLocationKeyRef = useRef(null);
  const openingToIconRef = useRef(false);
  const pendingIconCloseRef = useRef(false);
  const timersRef = useRef(new Set());
  const locationKeyRef = useRef(location.key);
  const scrollPositionsRef = useRef(new Map());

  const schedule = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  }, []);

  const unlock = useCallback(() => {
    lockedRef.current = false;
    closingFromIconRef.current = false;
    openingToIconRef.current = false;
    setPhase("idle");
    setTransitionType(null);
  }, []);

  const unlockRun = useCallback(
    (runId) => {
      if (transitionRunRef.current === runId) unlock();
    },
    [unlock],
  );

  const beginIconTransition = useCallback((type, element) => {
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const origin = {
      type,
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
    iconOriginRef.current = origin;
    setIconOrigin(origin);
  }, []);

  const completeIconClose = useCallback(() => {
    if (!pendingIconCloseRef.current) return false;
    pendingIconCloseRef.current = false;
    flushSync(() => navigate(-1));
    return true;
  }, [navigate]);

  const requestIconClose = useCallback(
    (type) => {
      if (
        lockedRef.current ||
        !location.state?.qurbiIconOverlay ||
        (iconOriginRef.current?.type || location.state?.iconType) !== type
      ) return false;

      const runId = ++transitionRunRef.current;
      lockedRef.current = true;
      pendingIconCloseRef.current = true;
      iconExitLocationKeyRef.current = location.key;
      closingFromIconRef.current = true;
      openingToIconRef.current = false;
      setTransitionType(type);
      setPhase("exiting");
      schedule(() => {
        if (transitionRunRef.current === runId) completeIconClose();
      }, 1000);
      return true;
    },
    [completeIconClose, location.key, location.state, schedule],
  );

  const navigateWithTransition = useCallback(
    (destination, options = {}) => {
      if (lockedRef.current) return false;
      const currentType = iconTypeForPath(location.pathname);
      const destinationPath =
        typeof destination === "string"
          ? new URL(destination, window.location.href).pathname
          : "";
      const destinationType = iconTypeForPath(destinationPath);
      const requestedType =
        options.transitionType || currentType || destinationType || null;
      const closingFromIcon = Boolean(
        currentType && iconOriginRef.current?.type === currentType,
      );
      const openingToIcon = Boolean(
        destinationType &&
          destinationType !== currentType &&
          iconOriginRef.current?.type === destinationType,
      );
      const runId = ++transitionRunRef.current;

      lockedRef.current = true;
      iconExitLocationKeyRef.current = location.key;
      closingFromIconRef.current = closingFromIcon;
      iconOpenLocationKeyRef.current = location.key;
      openingToIconRef.current = openingToIcon;
      setTransitionType(requestedType);
      setPhase("exiting");

      schedule(() => {
        if (typeof destination === "number") {
          navigate(destination);
          return;
        }
        const navigateOptions = openingToIcon
          ? {
              ...options.navigateOptions,
              state: {
                ...(options.navigateOptions?.state || {}),
                qurbiIconOverlay: true,
                iconType: destinationType,
                iconOrigin: iconOriginRef.current,
                backgroundLocation:
                  location.state?.backgroundLocation || location,
              },
            }
          : options.navigateOptions;
        flushSync(() => navigate(destination, navigateOptions));
      }, openingToIcon
        ? ICON_OPEN_DELAY_MS
        : closingFromIcon
          ? ICON_EXIT_MS
          : NORMAL_EXIT_MS);
      schedule(() => unlockRun(runId), FAILSAFE_MS);
      return true;
    },
    [location, navigate, schedule, unlockRun],
  );

  const navigateFromIconPage = useCallback(
    (destination, navigateOptions) =>
      navigateWithTransition(destination, { navigateOptions }),
    [navigateWithTransition],
  );

  const completeProductTransition = useCallback(() => {
    if (!productTransitionRef.current) return;
    const runId = transitionRunRef.current;
    productTransitionRef.current = {
      ...productTransitionRef.current,
      stage: "revealing",
    };
    setProductTransition(productTransitionRef.current);
    schedule(() => {
      productTransitionRef.current = null;
      setProductTransition(null);
      unlockRun(runId);
    }, PRODUCT_REVEAL_MS);
  }, [schedule, unlockRun]);

  const navigateFromProductCard = useCallback(
    (destination, element, product = {}) => {
      if (lockedRef.current || !element) return false;
      const runId = ++transitionRunRef.current;
      const bounds = element.getBoundingClientRect();
      lockedRef.current = true;
      setTransitionType("product");
      setPhase("exiting");
      const initialTransition = {
        stage: "preparing",
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        image: product.image || "",
        label: product.label || "Livestock details",
      };
      productTransitionRef.current = initialTransition;
      setProductTransition(initialTransition);

      schedule(() => {
        if (!productTransitionRef.current) return;
        productTransitionRef.current = {
          ...productTransitionRef.current,
          stage: "expanding",
        };
        setProductTransition(productTransitionRef.current);
      }, 24);
      schedule(() => {
        flushSync(() => navigate(destination));
        if (!productTransitionRef.current) return;
        productTransitionRef.current = {
          ...productTransitionRef.current,
          stage: "loading",
        };
        setProductTransition(productTransitionRef.current);
      }, PRODUCT_EXPAND_MS);
      schedule(() => {
        if (!productTransitionRef.current) return;
        productTransitionRef.current = {
          ...productTransitionRef.current,
          stage: "revealing",
        };
        setProductTransition(productTransitionRef.current);
        schedule(() => {
          productTransitionRef.current = null;
          setProductTransition(null);
          unlockRun(runId);
        }, PRODUCT_REVEAL_MS);
      }, 10000);
      return true;
    },
    [navigate, schedule, unlockRun],
  );

  useIsomorphicLayoutEffect(() => {
    if (locationKeyRef.current === location.key) {
      if (location.pathname === "/profile") window.scrollTo(0, 0);
      return;
    }
    scrollPositionsRef.current.set(locationKeyRef.current, window.scrollY);
    locationKeyRef.current = location.key;
    const destinationScroll =
      location.pathname === "/profile"
        ? 0
        : navigationType === "POP"
        ? scrollPositionsRef.current.get(location.key) || 0
        : 0;
    window.scrollTo(0, destinationScroll);
    // The previous page's exit lock is no longer needed once the next route is
    // mounted. Its entrance animation can continue while remaining interactive.
    lockedRef.current = false;
    const runId = transitionRunRef.current;
    setPhase("entering");
    if (transitionType !== "product") {
      schedule(() => unlockRun(runId), ENTER_MS);
    }
  }, [location.key, location.pathname, navigationType, schedule, transitionType, unlockRun]);

  useEffect(() => {
    const handleLinkClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const link = event.target.closest("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const destination = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (destination === current) {
        const currentType = iconTypeForPath(location.pathname);
        if (currentType && location.state?.qurbiIconOverlay) {
          event.preventDefault();
          requestIconClose(currentType);
        }
        return;
      }

      event.preventDefault();
      if (lockedRef.current) return;
      const destinationType = iconTypeForPath(url.pathname);
      if (destinationType) {
        const headerIcon =
          destinationType === "notification"
            ? document.querySelector('a[href="/notifications"][aria-label]')
            : document.querySelector('a[aria-label="Open profile"]');
        beginIconTransition(destinationType, headerIcon || link);
      }
      navigateWithTransition(destination, {
        transitionType: destinationType || iconOriginRef.current?.type,
      });
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [beginIconTransition, location.pathname, location.state, navigateWithTransition, requestIconClose]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  const currentIconType = iconTypeForPath(location.pathname);
  const isIconClosing =
    phase === "exiting" &&
    closingFromIconRef.current &&
    iconExitLocationKeyRef.current === location.key &&
    Boolean(currentIconType && iconOrigin?.type === currentIconType);
  const isIconOpening =
    phase === "exiting" &&
    openingToIconRef.current &&
    iconOpenLocationKeyRef.current === location.key;

  return (
    <HeaderTransitionContext.Provider
      value={{
        phase,
        isContracting:
          phase === "exiting" && !isIconClosing && !isIconOpening,
        isIconOpening,
        isIconClosing,
        iconOrigin,
        transitionType,
        productTransition,
        beginIconTransition,
        navigateWithTransition,
        navigateFromIconPage,
        navigateFromProductCard,
        completeProductTransition,
        requestIconClose,
        completeIconClose,
      }}
    >
      {children}
      {productTransition && (
        <div
          className={`qurbi-product-transition-layer qurbi-product-transition-${productTransition.stage}`}
          style={/** @type {React.CSSProperties} */ ({
            "--product-left": `${productTransition.left}px`,
            "--product-top": `${productTransition.top}px`,
            "--product-width": `${productTransition.width}px`,
            "--product-height": `${productTransition.height}px`,
          })}
          role="status"
          aria-live="polite"
          aria-label={`Loading ${productTransition.label}`}
        >
          <div className="qurbi-product-transition-media">
            {productTransition.image ? (
              <img src={productTransition.image} alt="" />
            ) : (
              <div className="qurbi-product-transition-placeholder">No image</div>
            )}
          </div>
          <div className="qurbi-product-transition-sheet">
            <p>{productTransition.label}</p>
            <div className="qurbi-product-transition-spinner" aria-hidden="true" />
            <span>Loading details...</span>
          </div>
        </div>
      )}
    </HeaderTransitionContext.Provider>
  );
}
