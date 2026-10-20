// Burns the proof details INTO the photo's pixels so the evidence travels with
// the image itself (a screenshot of a form can be edited; a stamped photo that
// was also checked against the server's timestamp and hash is much harder to
// fake). The same details are sent separately to the server as metadata, which
// is what the server actually validates.

const MYT = "Asia/Kuala_Lumpur";

/** "11 Oct 2026, 3:42:07 pm" in Malaysia time, whatever the phone's own zone is. */
export function formatStampTime(date) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: MYT,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatCoordinates(latitude, longitude, accuracy) {
  const lat = `${Math.abs(latitude).toFixed(6)}° ${latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(longitude).toFixed(6)}° ${longitude >= 0 ? "E" : "W"}`;
  const accuracyText = Number.isFinite(accuracy) ? ` (±${Math.round(accuracy)} m)` : "";
  return `${lat}, ${lng}${accuracyText}`;
}

/**
 * The text block printed on the photo, top line first.
 * @param {{ capturedAt: Date, latitude: number, longitude: number, accuracy?: number, address?: string | null, orderNumber?: string, stageLabel?: string }} details
 * @returns {string[]}
 */
export function buildStampLines({ capturedAt, latitude, longitude, accuracy, address, orderNumber, stageLabel }) {
  const lines = [];
  const heading = [orderNumber ? `Order #${orderNumber}` : "", stageLabel || ""].filter(Boolean).join(" · ");
  if (heading) lines.push(heading);
  lines.push(formatStampTime(capturedAt));
  lines.push(formatCoordinates(latitude, longitude, accuracy));
  if (address) lines.push(address);
  return lines;
}

/** Breaks a line into rows no wider than `maxWidth` (used for long addresses). */
export function wrapLine(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const rows = [];
  let row = "";
  for (const word of words) {
    const candidate = row ? `${row} ${word}` : word;
    if (row && ctx.measureText(candidate).width > maxWidth) {
      rows.push(row);
      row = word;
    } else {
      row = candidate;
    }
  }
  if (row) rows.push(row);
  return rows;
}

/**
 * Draws a dark band along the bottom of the canvas with the stamp lines on it.
 * Scales with the image so it is equally readable on a 720p and a 4000px photo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {string[]} lines
 */
export function drawStamp(ctx, width, height, lines) {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.032));
  const padding = Math.round(fontSize * 0.7);
  const lineHeight = Math.round(fontSize * 1.3);

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "top";
  const maxWidth = width - padding * 2;
  const rows = lines.flatMap((line) => wrapLine(ctx, line, maxWidth));

  const bandHeight = rows.length * lineHeight + padding * 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(0, height - bandHeight, width, bandHeight);

  ctx.fillStyle = "#ffffff";
  rows.forEach((row, index) => {
    ctx.fillText(row, padding, height - bandHeight + padding + index * lineHeight, maxWidth);
  });
  ctx.restore();
  return { bandHeight, rows };
}
