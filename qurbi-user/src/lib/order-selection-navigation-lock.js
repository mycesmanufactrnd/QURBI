const LOCK_ATTRIBUTE = "data-orders-selection-navigation-locked";

export function setOrderSelectionNavigationLocked(locked) {
  if (typeof document === "undefined") return;
  if (locked) document.documentElement.setAttribute(LOCK_ATTRIBUTE, "true");
  else document.documentElement.removeAttribute(LOCK_ATTRIBUTE);
}

export function isOrderSelectionNavigationLocked() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute(LOCK_ATTRIBUTE) === "true"
  );
}

export function preventNavigationWhileSelecting(event) {
  if (!isOrderSelectionNavigationLocked()) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.nativeEvent?.stopImmediatePropagation?.();
  return true;
}

