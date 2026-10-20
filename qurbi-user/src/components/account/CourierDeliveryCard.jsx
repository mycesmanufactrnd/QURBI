import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bike, KeyRound, PackageCheck, Star, TriangleAlert } from "lucide-react";
import { qurbiApi } from "@/api/qurbiClient";
import { accountMediaUrl } from "@/components/account/media";
import { usePrivateImageUrls } from "@/lib/private-images";

const cardCls = "qurbi-dark-surface rounded-2xl border p-4 shadow-md";
const POLL_MS = 20_000;
const ACTIVE = ["accepted", "picked_up", "in_transit"];
const STAGE_KEYS = ["pickup", "transit", "delivery", "failed"];

/** "123456" -> "123 456", easier to read out loud at the door. */
export const formatDeliveryCode = (code) => String(code || "").replace(/^(\d{3})(\d{3})$/, "$1 $2");

/**
 * What the buyer sees about the courier on a delivery order: who is bringing
 * the animal, where they are in the trip, the handover code to give them at
 * the door, and the live photos they took along the way.
 *
 * @param {{ order: any, onPreview: (image: string, alt: string) => void, formatTime: (value: string) => string }} props
 */
export default function CourierDeliveryCard({ order, onPreview, formatTime }) {
  const { t } = useTranslation("orders");
  const [summary, setSummary] = useState(null);
  const [code, setCode] = useState(null);

  const orderId = order.id;
  const relevant = order.fulfillment_method === "delivery" && order.payment_status === "paid" && !["cancelled", "refunded"].includes(order.status);
  const state = summary?.state || "not_requested";

  const load = useCallback(async () => {
    try {
      const response = await qurbiApi.functions.invoke("fetchCourierSummary", { orderId });
      setSummary(response.data);
      if (response.data?.state === "in_transit") {
        const codeResponse = await qurbiApi.functions.invoke("fetchDeliveryCode", { orderId });
        setCode(codeResponse.data?.code || null);
      } else {
        setCode(null);
      }
    } catch {
      // The card is extra information; a failed refresh keeps what is on screen.
    }
  }, [orderId]);

  useEffect(() => { if (relevant) load(); }, [relevant, load, order.status]);

  // Follow the trip while it is moving.
  useEffect(() => {
    if (!relevant || (!ACTIVE.includes(state) && state !== "waiting_for_courier")) return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [relevant, state, load]);

  const events = (order.tracking_events || []).filter((event) => event.stage && Array.isArray(event.images) && event.images.length);
  const imageUrls = events.flatMap((event) => event.images.map((image) => accountMediaUrl(image)));
  const resolved = usePrivateImageUrls(imageUrls);

  if (!relevant || (state === "not_requested" && !events.length && !summary)) return null;

  const courier = summary?.courier;
  const tone = state === "failed" ? "text-red-200" : "text-white";

  return (
    <section className={cardCls} aria-labelledby="courier-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/10 text-white" aria-hidden="true">
          {state === "failed" ? <TriangleAlert className="h-5 w-5" /> : state === "delivered" ? <PackageCheck className="h-5 w-5" /> : <Bike className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="courier-title" className="text-base font-bold text-white">{t("orderDetail.courier.title")}</h2>
          <p className={`mt-0.5 text-sm font-bold ${tone}`}>{t(`orderDetail.courier.state.${state}.title`)}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/80">{t(`orderDetail.courier.state.${state}.body`)}</p>
        </div>
      </div>

      {courier && (
        <div className="mt-3 rounded-xl bg-white/10 p-3">
          <p className="break-words font-bold text-white">{courier.name}</p>
          <p className="mt-0.5 text-sm text-white/80">{courier.vehicle_type || courier.vehicleType} · {courier.vehicle_plate || courier.vehiclePlate}</p>
          {Number(courier.rating_count ?? courier.ratingCount) > 0 && (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-white">
              <Star className="h-4 w-4 fill-[#E3C19F] text-[#E3C19F]" aria-hidden="true" />
              {Number(courier.rating_average ?? courier.ratingAverage).toFixed(1)}
              <span className="font-normal text-white/70">({courier.rating_count ?? courier.ratingCount})</span>
            </p>
          )}
        </div>
      )}

      {state === "in_transit" && code && (
        <div className="mt-3 rounded-2xl border-2 border-[#E3C19F] bg-[#F7EDE2] p-4 text-center text-[#41362D]">
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold"><KeyRound className="h-4 w-4" aria-hidden="true" />{t("orderDetail.courier.codeTitle")}</p>
          <p className="mt-1 text-4xl font-extrabold tracking-[0.18em]" aria-label={String(code).split("").join(" ")}>{formatDeliveryCode(code)}</p>
          <p className="mt-2 text-xs leading-relaxed text-[#5A493C]">{t("orderDetail.courier.codeHint")}</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-white/15 pt-3">
          <h3 className="text-sm font-bold text-white">{t("orderDetail.courier.photosTitle")}</h3>
          {events.map((event) => {
            const stage = STAGE_KEYS.includes(event.stage) ? event.stage : "pickup";
            return (
              <div key={event.id}>
                <p className="text-sm font-bold text-white">
                  {t(`orderDetail.courier.stage.${stage}`)}
                  <span className="ml-2 text-xs font-normal text-white/70">{formatTime(event.captured_at || event.capturedAt || event.created_at || event.createdAt)}</span>
                </p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {event.images.map((image) => {
                    const raw = accountMediaUrl(image);
                    const src = resolved[raw];
                    const alt = t("orderDetail.courier.photoAlt", { stage: t(`orderDetail.courier.stage.${stage}`) });
                    return src ? (
                      <button key={raw} type="button" onClick={() => onPreview(src, alt)} className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3C19F]">
                        <img src={src} alt={alt} className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <span key={raw} className="h-20 w-20 flex-none animate-pulse rounded-xl bg-white/10" aria-hidden="true" />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
