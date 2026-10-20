import { buildStampLines, drawStamp } from "@/lib/stamp";

/** Maps a getUserMedia failure to one of the keys under proof:camera.errors. */
export function cameraErrorKey(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return "notFound";
    case "NotReadableError":
    case "TrackStartError":
      return "inUse";
    default:
      return "generic";
  }
}

export function canUseCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function startCameraStream() {
  return navigator.mediaDevices.getUserMedia({
    // "ideal" so a phone without a back camera still opens the front one;
    // the courier is never blocked just because of the lens.
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** A GPS fix older than this is not "where I am when I pressed the button". */
export const MAX_FIX_AGE_MS = 10_000;

export const isFreshFix = (fix, now = Date.now()) => Boolean(fix) && now - fix.timestamp <= MAX_FIX_AGE_MS;

/**
 * If a brand-new reading cannot be had (some devices only serve one GPS request
 * at a time while a watch is running), the last good reading is still used as
 * long as it is no older than this. A courier standing at a doorway has not
 * moved in two minutes; one who has will have a newer reading from the watch.
 */
export const MAX_FALLBACK_FIX_AGE_MS = 120_000;

export const isUsableFix = (fix, now = Date.now()) => Boolean(fix) && now - fix.timestamp <= MAX_FALLBACK_FIX_AGE_MS;

/**
 * Freezes the current video frame into a canvas right away (so a slow
 * geocoder can never delay or blur the shot), then prints the stamp on it and
 * returns the JPEG plus the metadata the server validates.
 *
 * @param {{
 *   video: HTMLVideoElement,
 *   fix: { latitude: number, longitude: number, accuracy: number },
 *   orderNumber?: string,
 *   stageLabel?: string,
 *   deviceInfo?: string,
 *   getAddress?: (latitude: number, longitude: number) => Promise<string | null>,
 *   now?: () => Date,
 * }} input
 */
export async function captureStampedPhoto({ video, fix, orderNumber, stageLabel, deviceInfo, getAddress, now = () => new Date() }) {
  const capturedAt = now();
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("camera-not-ready");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  ctx.drawImage(video, 0, 0, width, height);

  const address = getAddress ? await getAddress(fix.latitude, fix.longitude).catch(() => null) : null;
  drawStamp(ctx, width, height, buildStampLines({
    capturedAt,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    address,
    orderNumber,
    stageLabel,
  }));

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("encode-failed"))), "image/jpeg", 0.85);
  });

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    meta: {
      latitude: Number(fix.latitude.toFixed(7)),
      longitude: Number(fix.longitude.toFixed(7)),
      accuracy: Math.round(fix.accuracy),
      capturedAt: capturedAt.toISOString(),
      ...(deviceInfo ? { deviceInfo } : {}),
    },
  };
}

export const deviceInfoString = () => String(navigator.userAgent || "").slice(0, 255);
