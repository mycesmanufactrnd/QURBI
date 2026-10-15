import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Mars, Star, Venus } from "lucide-react";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { formatRM } from "@/lib/format";
import {
  ageLabel,
  genderKey,
  genderLabel,
  listingState,
  listingTitle,
} from "@/lib/listing-display";

/** Marketplace card for one animal (Browse grid + Home featured row). */
export default function LivestockCard({ livestock, index = 0, className = "", showFeatured = false, inCart = false }) {
  const { t } = useTranslation("shop");
  const { t: tf } = useTranslation("shopflow");
  const { navigateFromProductCard } = useHeaderTransition();
  const imageReferences = useMemo(() => {
    const additionalImages = Array.isArray(livestock.images)
      ? livestock.images
      : livestock.images
        ? [livestock.images]
        : [];

    return [livestock.coverImage, ...additionalImages]
      .map((image) => {
        if (typeof image === "string") return image.trim();
        return image?.url || image?.file_url || image?.src || "";
      })
      .filter((image, position, images) => image && images.indexOf(image) === position);
  }, [livestock.coverImage, livestock.images]);
  const [imageIndex, setImageIndex] = useState(0);
  const cardRef = useRef(null);
  const img = imageReferences[imageIndex] || "";

  useEffect(() => {
    setImageIndex(0);
  }, [livestock.id]);

  const title = listingTitle(livestock, t("browse.livestockFallback"));
  const gender = genderKey(livestock.gender);
  const GenderIcon = gender === "male" ? Mars : gender === "female" ? Venus : null;
  const state = listingState(livestock);
  const age = ageLabel(tf, livestock);
  const price = formatRM(livestock.price);

  const open = () =>
    navigateFromProductCard(`/livestock/${livestock.id}`, cardRef.current, { image: img, label: title });

  return (
    <article
      ref={cardRef}
      className={`group relative flex min-h-[232px] w-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] text-left shadow-lg shadow-[#41362D]/30 animate-fade-in-up transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#41362D] active:scale-[0.98] sm:min-h-[280px] ${className}`}
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
    >
      <button
        type="button"
        onClick={open}
        aria-label={tf("card.openAria", { title, price })}
        className="relative block aspect-[3/2] w-full flex-none overflow-hidden bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#41362D]"
      >
        {img ? (
          <img
            src={img}
            alt={title}
            loading="lazy"
            onError={() => setImageIndex((current) => current + 1)}
            className="absolute inset-0 h-full w-full object-fill"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#41362D]">
            {t("listings:livestockDetail.noImage")}
          </span>
        )}
        <span className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full border border-[#41362D]/40 bg-[#F7EDE2]/95 px-2 py-1 text-xs font-bold leading-none text-[#41362D] shadow-sm">
          <MapPin aria-hidden="true" className="h-3 w-3 flex-none" />
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {state || t("browse.locationUnavailable")}
          </span>
        </span>
        {showFeatured && livestock.isFeatured && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#41362D]/90 px-2 py-1 text-xs font-bold leading-none text-[#F7EDE2]">
            <Star aria-hidden="true" className="h-3 w-3 fill-current" />
            {tf("card.featured")}
          </span>
        )}
        {inCart && (
          <span className="absolute right-2 top-2 rounded-full border border-[#E3C19F] bg-[#41362D]/95 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm">
            {t("listings:livestockDetail.inCart")}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={open}
        aria-label={tf("card.openAria", { title, price })}
        className="flex min-w-0 flex-1 flex-col gap-1 px-3 pb-3 pt-2.5 text-left text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E3C19F] sm:px-4 sm:pb-4"
      >
        <span className="line-clamp-2 min-h-[2.5rem] break-words text-base font-extrabold leading-tight sm:min-h-[3rem] sm:text-lg">
          {title}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] font-medium text-white/85 sm:text-sm">
          {GenderIcon && (
            <span className="inline-flex items-center gap-0.5">
              <GenderIcon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
              {genderLabel(tf, livestock.gender)}
            </span>
          )}
          {GenderIcon && age && <span aria-hidden="true">·</span>}
          {age && <span className="whitespace-nowrap">{age}</span>}
          {livestock.grade && (
            <>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{tf("card.grade", { grade: livestock.grade })}</span>
            </>
          )}
        </span>
        <span className="mt-1 block text-lg font-extrabold leading-tight text-[#F7EDE2] sm:text-xl">{price}</span>
      </button>
    </article>
  );
}
