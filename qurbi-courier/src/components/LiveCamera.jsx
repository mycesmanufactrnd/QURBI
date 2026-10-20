import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Camera, Check, Loader2, MapPin, RotateCcw, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GEO_ERRORS, MAX_ACCURACY_METERS, getPosition, isAccurateEnough, reverseGeocode, watchPosition } from "@/lib/geo";
import {
  cameraErrorKey,
  canUseCamera,
  captureStampedPhoto,
  deviceInfoString,
  isFreshFix,
  isUsableFix,
  startCameraStream,
  stopStream,
} from "@/lib/capture";

const GEO_ERROR_KEYS = {
  [GEO_ERRORS.denied]: "gpsDenied",
  [GEO_ERRORS.unsupported]: "gpsUnsupported",
  [GEO_ERRORS.unavailable]: "gpsUnavailable",
  [GEO_ERRORS.timeout]: "gpsUnavailable",
};

/**
 * Full-screen live camera for proof photos. There is deliberately NO gallery
 * or file picker anywhere in here: a photo only exists if the camera took it
 * right now, with a GPS fix, and gets the time and place printed on it.
 *
 * @param {{
 *   orderNumber?: string,
 *   stageLabel?: string,
 *   photoLabel?: string,
 *   step?: { current: number, total: number },
 *   onUse: (photo: { blob: Blob, previewUrl: string, meta: object }) => void,
 *   onClose: () => void,
 * }} props
 */
export default function LiveCamera({ orderNumber, stageLabel, photoLabel, step, onUse, onClose }) {
  const { t } = useTranslation("proof");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fixRef = useRef(null);
  // Url of the photo handed to the caller; the caller owns (and revokes) it.
  const acceptedUrlRef = useRef(null);
  const [phase, setPhase] = useState(canUseCamera() ? "starting" : "error");
  const [errorKey, setErrorKey] = useState(canUseCamera() ? "" : "unsupported");
  const [fix, setFix] = useState(null);
  const [geoErrorKey, setGeoErrorKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState(null);

  const releaseCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  // Camera
  useEffect(() => {
    if (!canUseCamera()) return undefined;
    let cancelled = false;
    startCameraStream()
      .then((stream) => {
        if (cancelled) { stopStream(stream); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
        // Not "live" yet: the shutter must wait until the first frame has real
        // dimensions (see onLoadedMetadata below), or the photo comes out empty.
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorKey(cameraErrorKey(error));
        setPhase("error");
      });
    return () => { cancelled = true; releaseCamera(); };
  }, [releaseCamera]);

  // Live GPS, so the courier sees the accuracy improve before pressing the button.
  useEffect(() => watchPosition(
    (next) => { fixRef.current = next; setFix(next); setGeoErrorKey(""); },
    (error) => setGeoErrorKey(GEO_ERROR_KEYS[error.code] || "gpsUnavailable"),
  ), []);

  // Revoke the preview url when it is replaced or the camera closes.
  useEffect(() => () => {
    if (shot?.previewUrl && acceptedUrlRef.current !== shot.previewUrl) URL.revokeObjectURL(shot.previewUrl);
  }, [shot]);

  // A phone that is standing still may stop sending GPS updates, so an old
  // reading must not lock the shutter for good; it is refreshed at capture time.
  const ready = phase === "live" && isAccurateEnough(fix);

  const capture = async () => {
    if (busy || !videoRef.current || !isAccurateEnough(fixRef.current)) return;
    setBusy(true);
    try {
      let current = fixRef.current;
      if (!isFreshFix(current)) {
        try {
          current = await getPosition({ timeout: 5000 });
          fixRef.current = current;
          setFix(current);
        } catch (error) {
          // Could not get a new reading: a permission problem must be shown,
          // but a mere timeout can fall back to the last reading if it is recent.
          if (error.code === GEO_ERRORS.denied || !isUsableFix(current)) {
            setGeoErrorKey(GEO_ERROR_KEYS[error.code] || "gpsUnavailable");
            return;
          }
        }
        if (!isAccurateEnough(current)) return;
      }
      const result = await captureStampedPhoto({
        video: videoRef.current,
        fix: current,
        orderNumber,
        stageLabel,
        deviceInfo: deviceInfoString(),
        getAddress: reverseGeocode,
      });
      setShot(result);
    } catch {
      setErrorKey("capture");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  };

  const retake = () => {
    setShot(null);
    // The <video> element stays mounted while reviewing, so the stream is still running.
    videoRef.current?.play().catch(() => {});
  };

  const accept = () => {
    if (!shot) return;
    // Hand over the url; the caller owns it from here (and revokes it when done).
    const accepted = shot;
    acceptedUrlRef.current = accepted.previewUrl;
    setShot(null);
    releaseCamera();
    onUse(accepted);
  };

  const close = () => { releaseCamera(); onClose(); };

  let gpsText;
  let gpsTone = "text-white/90";
  if (geoErrorKey) {
    gpsText = t(`camera.errors.${geoErrorKey}`);
    gpsTone = "text-red-200";
  } else if (!fix) {
    gpsText = t("camera.gps.searching");
  } else if (!isAccurateEnough(fix)) {
    gpsText = t("camera.gps.weak", { meters: Math.round(fix.accuracy) });
    gpsTone = "text-amber-200";
  } else {
    gpsText = t("camera.gps.good", { meters: Math.round(fix.accuracy) });
    gpsTone = "text-emerald-200";
  }

  // Rendered straight into <body>: the pages animate with a CSS transform, and a
  // transformed ancestor traps `position: fixed` (and its z-index) inside it,
  // which left the bottom navigation on top of the shutter button.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("camera.title")} className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <header className="flex items-start gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          {step && <p className="text-xs font-bold uppercase tracking-wider text-white/70">{t("camera.step", { current: step.current, total: step.total })}</p>}
          <p className="truncate text-base font-extrabold">{photoLabel || t("camera.title")}</p>
          <p className={cn("mt-1 flex items-center gap-1.5 text-sm font-semibold", gpsTone)} role="status" aria-live="polite">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{gpsText}
          </p>
        </div>
        <button type="button" onClick={close} aria-label={t("camera.close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {/* Always mounted so the stream survives a retake. */}
        <video ref={videoRef} playsInline muted autoPlay onLoadedMetadata={() => setPhase((current) => (current === "starting" ? "live" : current))} className={cn("h-full w-full object-cover", shot && "invisible")} />
        {shot && <img src={shot.previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />}

        {phase === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold" role="status">
            <Loader2 className="h-5 w-5 animate-spin" />{t("camera.starting")}
          </div>
        )}

        {phase === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center">
            <ShieldAlert className="h-10 w-10 text-amber-300" aria-hidden="true" />
            <p className="max-w-sm text-sm leading-6">{t(`camera.errors.${errorKey || "generic"}`)}</p>
            <button type="button" onClick={close} className="min-h-12 rounded-2xl bg-white px-6 text-sm font-bold text-black">{t("camera.close")}</button>
          </div>
        )}
      </div>

      <footer className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {!shot ? (
          <>
            <p className="mb-3 text-center text-xs text-white/60">{t("camera.liveOnly")}</p>
            {phase === "live" && !ready && fix && !isAccurateEnough(fix) && (
              <p className="mb-3 text-center text-xs font-semibold text-amber-200">{t("camera.gps.needed", { max: MAX_ACCURACY_METERS })}</p>
            )}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={capture}
                disabled={!ready || busy}
                aria-label={t("camera.capture")}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={retake} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/15 text-base font-bold hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <RotateCcw className="h-5 w-5" />{t("camera.retake")}
            </button>
            <button type="button" onClick={accept} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Check className="h-5 w-5" />{t("camera.usePhoto")}
            </button>
          </div>
        )}
      </footer>
    </div>,
    document.body,
  );
}
