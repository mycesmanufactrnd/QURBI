export function recentPageOr(fallback = "/") {
  const historyIndex = Number(window.history.state?.idx);
  return Number.isInteger(historyIndex) && historyIndex > 0 ? -1 : fallback;
}
