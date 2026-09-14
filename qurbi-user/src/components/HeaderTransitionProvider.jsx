import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { UNSAFE_NavigationContext, useLocation } from "react-router-dom";

const HEADER_TRANSITION_MS = 700;
const HeaderTransitionContext = createContext({
  isContracting: false,
  isIconClosing: false,
  iconOrigin: null,
  beginIconTransition: () => {},
  navigateFromIconPage: () => {},
});

export function useHeaderTransition() {
  return useContext(HeaderTransitionContext);
}

/** Delays route changes until the current header has contracted. */
export default function HeaderTransitionProvider({ children }) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const [isContracting, setIsContracting] = useState(false);
  const [isIconClosing, setIsIconClosing] = useState(false);
  const [iconOrigin, setIconOrigin] = useState(null);
  const transitionRunning = useRef(false);
  const timer = useRef(null);

  const beginIconTransition = (type, element) => {
    if (!element || transitionRunning.current) return;
    const bounds = element.getBoundingClientRect();
    setIconOrigin({
      type,
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
  };

  const navigateFromIconPage = useCallback(
    (destination) => {
      const completeNavigation = () => {
        if (typeof destination === "number") navigator.go(destination);
        else navigator.push(destination);
      };

      // The history blocker below already coordinates this when it is exposed
      // by the active router implementation.
      if (typeof navigator.block === "function") {
        completeNavigation();
        return;
      }

      const currentType =
        location.pathname === "/notifications"
          ? "notification"
          : location.pathname === "/profile"
            ? "profile"
            : null;
      const canAnimate = Boolean(
        currentType && iconOrigin?.type === currentType,
      );

      if (!canAnimate) {
        completeNavigation();
        return;
      }
      if (transitionRunning.current) return;

      transitionRunning.current = true;
      setIsContracting(false);
      setIsIconClosing(true);

      timer.current = window.setTimeout(
        completeNavigation,
        currentType === "profile" ? 650 : 620,
      );
    },
    [iconOrigin, location.pathname, navigator],
  );

  useLayoutEffect(() => {
    if (typeof navigator.block !== "function") return undefined;

    const unblock = navigator.block((transition) => {
      if (transitionRunning.current) return;

      transitionRunning.current = true;
      setIsContracting(true);
      const currentType =
        location.pathname === "/notifications"
          ? "notification"
          : location.pathname === "/profile"
            ? "profile"
            : null;
      const isClosingFromIcon = Boolean(
        currentType && iconOrigin?.type === currentType,
      );
      setIsIconClosing(isClosingFromIcon);

      const transitionDelay = isClosingFromIcon
        ? currentType === "profile"
          ? 650
          : 620
        : HEADER_TRANSITION_MS;

      timer.current = window.setTimeout(() => {
        unblock();
        transition.retry();
      }, transitionDelay);
    });

    return () => {
      unblock();
    };
  }, [navigator, location.key, location.pathname, iconOrigin]);

  // BrowserRouter does not expose navigator.block. In that setup, delay normal
  // in-app link navigation here so the current header can finish contracting.
  useEffect(() => {
    if (typeof navigator.block === "function") return undefined;

    const handleLinkClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      ) {
        return;
      }

      const destinationUrl = new URL(link.href, window.location.href);
      if (destinationUrl.origin !== window.location.origin) return;

      const destination = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (destination === current) return;

      if (transitionRunning.current) {
        event.preventDefault();
        return;
      }

      const iconPages = ["/notifications", "/profile"];
      const leavingIconPage = iconPages.includes(window.location.pathname);
      const enteringIconPage = iconPages.includes(destinationUrl.pathname);

      // Entering these pages retains the existing icon-origin animation.
      if (enteringIconPage) {
        return;
      }

      // Leaving reverses that animation before committing the navigation.
      if (leavingIconPage) {
        event.preventDefault();
        navigateFromIconPage(destination);
        return;
      }

      event.preventDefault();
      transitionRunning.current = true;
      setIsContracting(true);

      timer.current = window.setTimeout(
        () => navigator.push(destination),
        HEADER_TRANSITION_MS,
      );
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [navigateFromIconPage, navigator]);

  useEffect(() => {
    transitionRunning.current = false;
    setIsContracting(false);
    setIsIconClosing(false);

    const destinationType =
      location.pathname === "/notifications"
        ? "notification"
        : location.pathname === "/profile"
          ? "profile"
          : null;
    if (!destinationType) setIconOrigin(null);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [location.key]);

  return (
    <HeaderTransitionContext.Provider
      value={{
        isContracting,
        isIconClosing,
        iconOrigin,
        beginIconTransition,
        navigateFromIconPage,
      }}
    >
      {children}
    </HeaderTransitionContext.Provider>
  );
}
