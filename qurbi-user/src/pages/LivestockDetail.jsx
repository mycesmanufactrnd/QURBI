import React, { useState, useEffect } from "react";
import {
  useParams,
  Link,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart,
  Check,
  PackageCheck,
  MapPin,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Zap,
  Home,
  User,
  Leaf,
  Play,
} from "lucide-react";
import {
  loadLivestockById,
  loadLivestockWithFarmers,
} from "@/lib/farmerClient";
import { useCart } from "@/lib/cart-context";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useReveal } from "@/hooks/useReveal";
import { checkLivestockAvailability } from "@/lib/livestock-availability";
import ImageLightbox from "@/components/ImageLightbox";
import {
  DarkInfoTile,
  DetailOuterSheet,
  LightDetailCard,
} from "@/components/DetailsSurface";
import DetailPageLoading from "@/components/DetailPageLoading";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import StickyActionBar from "@/components/shop/StickyActionBar";
import StatusChip from "@/components/shop/StatusChip";
import { formatRM } from "@/lib/format";
import {
  ageLabel,
  genderLabel,
  listingState,
  listingTitle,
} from "@/lib/listing-display";
import {
  animateProductToCart,
  captureCartAnimationSource,
} from "@/lib/cart-animation";
import ProductImage from "@/components/ProductImage";
import { recentPageOr } from "@/lib/navigation";
import { qurbiApi } from "@/api/qurbiClient";
import { useAuth } from "@/lib/AuthContext";
import { orderBlocksRepurchase } from "@/components/account/orderStatus";
import { analyticsSource, trackBuyerActivity } from "@/lib/buyer-analytics";

const SPECIES_VALUE_KEYS = {
  cow: "cow",
  cattle: "cow",
  lembu: "cow",
  goat: "goat",
  kambing: "goat",
  sheep: "sheep",
  bebiri: "sheep",
  buffalo: "buffalo",
  kerbau: "buffalo",
};

const COLOR_VALUE_KEYS = {
  black: "black",
  white: "white",
  brown: "brown",
  red: "red",
  cream: "cream",
  grey: "grey",
  gray: "grey",
  golden: "golden",
  tan: "tan",
  beige: "beige",
  spotted: "spotted",
  mixed: "mixed",
  "black and white": "blackAndWhite",
  "black & white": "blackAndWhite",
  "brown and white": "brownAndWhite",
  "brown & white": "brownAndWhite",
  "red and white": "redAndWhite",
  "red & white": "redAndWhite",
};

function translatedListingValue(t, group, keyMap, value) {
  const original = String(value || "").trim();
  if (!original) return "";
  const key = keyMap[original.toLowerCase()];
  return key
    ? t(`livestockDetail.${group}.${key}`, { defaultValue: original })
    : original;
}

function AvailabilityModal({ state, onClose, onBrowse, backLabel }) {
  const { t } = useTranslation("listings");
  if (!state) return null;
  const unavailable = state === "unavailable";
  const reserved = ["reserved", "reserved_by_you"].includes(state);
  const returnToOrders = state === "reserved_by_you";
  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900">
          {reserved
            ? t("livestockDetail.reservedTitle")
            : unavailable
              ? t("livestockDetail.unavailableTitle")
              : t("livestockDetail.verifyFailTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {reserved
            ? returnToOrders
              ? t("livestockDetail.reservedByYouMessage")
              : t("livestockDetail.reservedMessage")
            : unavailable
              ? t("livestockDetail.unavailableMessage")
              : t("livestockDetail.verifyFailMessage")}
        </p>
        <button
          type="button"
          onClick={reserved || unavailable ? onBrowse : onClose}
          className="aisyah-primary-button mt-5 min-h-12 w-full"
        >
          {returnToOrders
            ? t("livestockDetail.viewMyOrders")
            : reserved || unavailable
              ? backLabel
              : t("livestockDetail.close")}
        </button>
      </div>
    </div>
  );
}

export default function LivestockDetail() {
  const { t } = useTranslation("listings");
  const { t: tf } = useTranslation("shopflow");
  const { id } = useParams();
  const {
    navigateWithTransition,
    navigateFromProductCard,
    completeProductTransition,
  } = useHeaderTransition();
  const [searchParams] = useSearchParams();
  const openedFromCart = searchParams.get("from") === "cart";
  const openedFromOrders = ["order", "orders"].includes(searchParams.get("from"));
  const openedFromPayment = searchParams.get("from") === "payment";
  const requestedReturnTo = searchParams.get("returnTo");
  const paymentReturnPath =
    requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/payment";
  const returnPath = openedFromCart
    ? "/cart"
    : openedFromPayment
      ? paymentReturnPath
      : openedFromOrders
        ? "/orders"
        : "/browse";
  const returnLabel = openedFromCart
    ? t("livestockDetail.backToCart")
    : openedFromPayment
      ? t("livestockDetail.backToPayment")
      : openedFromOrders
        ? t("livestockDetail.backToOrders")
        : t("livestockDetail.backToBrowse");
  const { addToCart, buyNow, cartItems } = useCart();
  const { user, isAuthenticated, authChecked } = useAuth();
  const requireAuth = useRequireAuth();
  const { reveal } = useReveal();
  const [livestock, setLivestock] = useState(null);
  const [relatedLivestock, setRelatedLivestock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMedia, setActiveMedia] = useState(0);
  const farmSectionRef = React.useRef(null);
  const farmViewTracked = React.useRef(false);
  useEffect(() => {
    setActiveMedia(0);
    farmViewTracked.current = false;
  }, [id]);
  const [previewImage, setPreviewImage] = useState("");
  const [availabilityModal, setAvailabilityModal] = useState("");
  const [detailsRaised, setDetailsRaised] = useState(false);
  const [orderCheck, setOrderCheck] = useState({ loading: false, ordered: false });

  const load = () => {
    setLoading(true);
    setLivestock(null);
    setError(null);
    loadLivestockById(id)
      .then(async (selected) => {
        setLivestock(selected);
        try {
          const allLivestock = await loadLivestockWithFarmers();
          const selectedBreed = String(selected?.breed || "")
            .trim()
            .toLowerCase();
          setRelatedLivestock(
            (allLivestock || [])
              .filter(
                (candidate) =>
                  String(candidate.id) !== String(selected?.id) &&
                  selectedBreed &&
                  String(candidate.breed || "").trim().toLowerCase() ===
                    selectedBreed &&
                  !["reserved", "sold", "unavailable"].includes(
                    String(candidate.status || "").toLowerCase(),
                  ),
              )
              .slice(0, 10),
          );
        } catch {
          setRelatedLivestock([]);
        }
      })
      .catch((e) => setError(e.message || t("livestockDetail.loadError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!livestock?.id) return;
    trackBuyerActivity({
      eventType: "listing_view",
      targetType: "livestock",
      targetId: livestock.id,
      source: analyticsSource(searchParams),
    });
  }, [livestock?.id]);

  useEffect(() => {
    const farmerId = livestock?.ownerId || livestock?.created_by_id;
    const element = farmSectionRef.current;
    if (!farmerId || !element || farmViewTracked.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || farmViewTracked.current) return;
      farmViewTracked.current = true;
      trackBuyerActivity({
        eventType: "farmer_profile_view",
        targetType: "farmer",
        targetId: farmerId,
        source: "livestock_detail",
      });
      observer.disconnect();
    }, { threshold: 0.6 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [livestock?.ownerId, livestock?.created_by_id]);

  useEffect(() => {
    let active = true;
    if (!authChecked || !isAuthenticated || !user?.id) {
      setOrderCheck({ loading: !authChecked, ordered: false });
      return () => { active = false; };
    }

    setOrderCheck({ loading: true, ordered: false });
    qurbiApi.functions.invoke("fetchMyOrders", {})
      .then((response) => {
        if (!active) return;
        const ordered = (response.data?.orders || []).some(
          (order) => orderBlocksRepurchase(order) && (order.items || []).some(
            (item) => String(item.livestock_id || item.livestockId || "") === String(id),
          ),
        );
        setOrderCheck({ loading: false, ordered });
      })
      .catch(() => {
        if (active) setOrderCheck({ loading: false, ordered: false });
      });

    return () => { active = false; };
  }, [authChecked, id, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!loading && (livestock || error)) completeProductTransition();
  }, [completeProductTransition, error, livestock, loading]);

  useEffect(() => {
    const handleScroll = () => setDetailsRaised(window.scrollY > 36);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isInCart = cartItems.some((i) => i.key === id);

  const buildCartItem = () => ({
    id: livestock.id,
    animal: livestock.species,
    breed: livestock.breed,
    title: listingTitle(livestock),
    state: listingState(livestock),
    price_per_head: Number(livestock.price) || 0,
    weight_min: livestock.weight ? Number(livestock.weight) : 0,
    weight_max: livestock.weight ? Number(livestock.weight) : 0,
    farmer_id: livestock.ownerId || livestock.created_by_id || "",
    farmer_name: livestock.farmer_name || "Unknown Farmer",
    farm_name: livestock.farm_name || livestock.farmName || "",
    farm_location:
      livestock.farm_location ||
      livestock.farmLocation ||
      livestock.farm_address ||
      livestock.farm_state ||
      "",
    farm_state: livestock.farm_state || livestock.state || "",
    image: livestock.coverImage || livestock.images?.[0] || "",
    created_date: livestock.created_date || "",
    listingPublishedAt: livestock.listingPublishedAt || "",
    listingExpiresAt: livestock.listingExpiresAt || "",
    listingRenewedAt: livestock.listingRenewedAt || "",
  });

  const handleAddToCart = (event) => {
    if (!livestock) return;
    const animationSource = captureCartAnimationSource(
      event.currentTarget,
      livestock.coverImage || livestock.images?.[0],
    );
    requireAuth(async () => {
      try {
        const latest = await checkLivestockAvailability([livestock.id]);
        const result = latest[livestock.id];
        if (result?.state !== "available") {
          setAvailabilityModal(
            ["reserved", "reserved_by_you"].includes(result?.state)
              ? result.state
              : result?.state === "unavailable"
                ? "unavailable"
                : "verification",
          );
          load();
          return;
        }
      } catch {
        setAvailabilityModal("verification");
        return;
      }
      if (!addToCart(buildCartItem())) {
        alert(t("livestockDetail.alreadyInCart"));
      } else {
        trackBuyerActivity({
          eventType: "add_to_cart",
          targetType: "livestock",
          targetId: livestock.id,
          source: analyticsSource(searchParams),
        });
        animateProductToCart(animationSource);
      }
    });
  };

  const handleBuyNow = (event) => {
    if (!livestock) return;
    const animationSource = captureCartAnimationSource(
      event.currentTarget,
      livestock.coverImage || livestock.images?.[0],
    );
    requireAuth(async () => {
      try {
        const latest = await checkLivestockAvailability([livestock.id]);
        const result = latest[livestock.id];
        if (result?.state !== "available") {
          setAvailabilityModal(
            ["reserved", "reserved_by_you"].includes(result?.state)
              ? result.state
              : result?.state === "unavailable"
                ? "unavailable"
                : "verification",
          );
          load();
          return;
        }
      } catch {
        setAvailabilityModal("verification");
        return;
      }
      buyNow(buildCartItem());
      trackBuyerActivity({
        eventType: "buy_now",
        targetType: "livestock",
        targetId: livestock.id,
        source: analyticsSource(searchParams),
      });
      animateProductToCart(animationSource);
      navigateWithTransition("/payment?source=buy-now");
    });
  };

  if (loading && !livestock) {
    return (
      <DetailPageLoading
        message={t("livestockDetail.loading")}
        backTo={returnPath}
        backLabel={returnLabel}
      />
    );
  }

  if (error) {
    return (
      <div className="aisyah-page flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle aria-hidden="true" className="h-12 w-12 text-[#6B594A]" />
        <p className="text-center text-lg font-bold text-[#41362D]">
          {t("livestockDetail.loadError")}
        </p>
        <p className="max-w-xs text-center text-sm text-[#6B594A]">{error}</p>
        <button
          type="button"
          onClick={load}
          className="aisyah-primary-button flex min-h-12 items-center gap-2 px-6"
        >
          <RefreshCw className="h-4 w-4" /> {t("livestockDetail.retry")}
        </button>
        <Link
          to={returnPath}
          className="inline-flex min-h-11 items-center text-sm font-bold text-[#41362D] underline underline-offset-4"
        >
          {returnLabel}
        </Link>
      </div>
    );
  }

  if (!livestock) return null;

  const title = listingTitle(livestock, t("livestockDetail.livestockFallback"));
  const allImages = [livestock.coverImage, ...(livestock.images || [])].filter(
    (image, index, images) => image && images.indexOf(image) === index,
  );
  const media = [
    ...allImages.map((url) => ({ type: "image", url })),
    ...(livestock.videos || []).filter(Boolean).map((url) => ({ type: "video", url })),
  ];
  const selectedMedia = media[activeMedia] || media[0];
  const price = formatRM(livestock.price);
  const listedState = listingState(livestock);

  const infoItems = [
    {
      label: t("livestockDetail.species"),
      value: translatedListingValue(t, "speciesValues", SPECIES_VALUE_KEYS, livestock.species),
    },
    { label: t("livestockDetail.breed"), value: livestock.breed },
    { label: t("livestockDetail.gender"), value: genderLabel(tf, livestock.gender) },
    { label: t("livestockDetail.age"), value: ageLabel(tf, livestock) },
    {
      label: t("livestockDetail.weight"),
      value: livestock.weight ? `${livestock.weight} kg` : null,
    },
    { label: tf("detail.grade"), value: livestock.grade },
    {
      label: t("livestockDetail.height"),
      value: livestock.height ? `${livestock.height} cm` : null,
    },
    {
      label: t("livestockDetail.bodyLength"),
      value: livestock.bodyLength ? `${livestock.bodyLength} cm` : null,
    },
    {
      label: t("livestockDetail.chestGirth"),
      value: livestock.chestGirth ? `${livestock.chestGirth} cm` : null,
    },
    {
      label: t("livestockDetail.color"),
      value: translatedListingValue(t, "colorValues", COLOR_VALUE_KEYS, livestock.color),
    },
    { label: t("livestockDetail.earTag"), value: livestock.earTag },
    { label: t("livestockDetail.rfid"), value: livestock.rfid },
  ].filter((i) => i.value);

  const farmRows = [
    { icon: MapPin, label: tf("detail.listedIn"), value: listedState },
    { icon: Home, label: tf("detail.farm"), value: livestock.farm_name },
    { icon: User, label: t("livestockDetail.farmer"), value: livestock.farmer_name === "Unknown Farmer" ? "" : livestock.farmer_name },
  ].filter((row) => row.value);

  return (
    <div
      data-cart-product
      className="min-h-screen bg-gradient-to-br from-[#41362D] to-[#6B594A]"
    >
      {/* Shared image/video gallery. Bottom space keeps controls above the raised sheet. */}
      <div
        className={`qurbi-page-header relative pb-24 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] ${reveal()}`}
      >
        <button
          type="button"
          onClick={() => navigateWithTransition(recentPageOr(returnPath))}
          aria-label={returnLabel}
          className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-[#41362D]/80 text-white shadow-lg backdrop-blur-sm active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-none absolute inset-x-0 top-5 z-10 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#F7EDE2]/70 bg-[#41362D]/55 shadow-sm backdrop-blur-sm">
            <Leaf aria-hidden="true" className="h-3.5 w-3.5 text-white" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white drop-shadow">
            QURBI
          </p>
        </div>
        {selectedMedia?.type === "video" ? (
          <video key={selectedMedia.url} src={selectedMedia.url} controls playsInline preload="metadata"
            className="block h-72 w-full bg-[#41362D] object-contain sm:h-96">
            {t("livestockDetail.videoUnsupported")}
          </video>
        ) : selectedMedia ? (
          <button
            type="button"
            onClick={() => setPreviewImage(selectedMedia.url)}
            aria-label={tf("detail.enlargePhoto")}
            className="block h-72 w-full sm:h-96"
          >
            <img
              data-cart-product-image
              src={selectedMedia.url}
              alt={title}
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <div className="flex h-72 w-full items-center justify-center bg-[#F7EDE2] text-sm font-bold text-[#41362D]">
            {t("livestockDetail.noImage")}
          </div>
        )}
        {media.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto p-3">
            {media.map((item, index) => (
              <button key={item.type + item.url} type="button"
                onClick={() => setActiveMedia(index)}
                aria-label={item.type === "video" ? t("livestockDetail.videos") + " " + (index - allImages.length + 1) : tf("detail.showPhoto", { number: index + 1, total: allImages.length })}
                aria-pressed={selectedMedia === item}
                className={`flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl border-2 bg-[#41362D] text-white ${selectedMedia === item ? "border-[#41362D] ring-2 ring-[#41362D]/40" : "border-[#E3C19F] opacity-80"}`}>
                {item.type === "image" ? <img src={item.url} alt="" className="h-full w-full object-cover" /> : <Play aria-hidden="true" className="h-6 w-6" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <DetailOuterSheet raised={detailsRaised} withActionBar>
        {/* Title + price + status */}
        <section className={reveal()} style={{ animationDelay: "80ms" }} aria-labelledby="livestock-title">
          <h1 id="livestock-title" className="break-words text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            {title}
          </h1>
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-3xl font-extrabold text-white sm:text-4xl">
              {price}
            </p>
            <StatusChip status={livestock.status || "unavailable"} />
          </div>
          {listedState && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-white/85">
              <MapPin aria-hidden="true" className="h-4 w-4" />
              {tf("detail.listedInState", { state: listedState })}
            </p>
          )}
        </section>

        {/* Farm & location */}
        {farmRows.length > 0 && (
          <div ref={farmSectionRef}>
          <LightDetailCard title={tf("detail.farmAndLocation")} className={reveal()}>
            <dl className="space-y-3" style={{ animationDelay: "140ms" }}>
              {farmRows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#F7EDE2]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A]">
                    <Icon aria-hidden="true" className="h-5 w-5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-sm font-semibold text-black/70">{label}</dt>
                    <dd className="break-words text-base font-bold text-black">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </LightDetailCard>
          </div>
        )}

        {/* Info grid */}
        <LightDetailCard title={t("livestockDetail.livestockDetails")} className={reveal()}>
          <div
            className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-3"
            style={{ animationDelay: "200ms" }}
          >
            {infoItems.map((item) => (
              <DarkInfoTile
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </LightDetailCard>

        {/* Health records */}
        {(livestock.healthRecord || livestock.vaccinationRecord) && (
          <LightDetailCard title={t("livestockDetail.healthRecords")} className={reveal()}>
            <div className="space-y-3" style={{ animationDelay: "260ms" }}>
              {livestock.healthRecord && (
                <div>
                  <p className="text-sm font-semibold text-black/70">{t("livestockDetail.healthRecord")}</p>
                  <p className="text-base text-black">{livestock.healthRecord}</p>
                </div>
              )}
              {livestock.vaccinationRecord && (
                <div>
                  <p className="text-sm font-semibold text-black/70">{t("livestockDetail.vaccination")}</p>
                  <p className="text-base text-black">{livestock.vaccinationRecord}</p>
                </div>
              )}
            </div>
          </LightDetailCard>
        )}

        {/* Notes */}
        {(livestock.description || livestock.specialNotes) && (
          <LightDetailCard title={t("livestockDetail.notes")} className={reveal()}>
            <div className="space-y-3" style={{ animationDelay: "320ms" }}>
              {livestock.description && (
                <p className="text-base leading-relaxed text-black">{livestock.description}</p>
              )}
              {livestock.specialNotes && (
                <div>
                  <p className="text-sm font-semibold text-black/70">{t("livestockDetail.specialNotes")}</p>
                  <p className="text-base leading-relaxed text-black">{livestock.specialNotes}</p>
                </div>
              )}
            </div>
          </LightDetailCard>
        )}

        {relatedLivestock.length > 0 && (
          <section
            className={`${reveal()} mt-6 border-t border-white/20 pt-5`}
            aria-labelledby="related-products-title"
          >
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E3C19F]">
                  {t("livestockDetail.sameBreed")}
                </p>
                <h2
                  id="related-products-title"
                  className="text-xl font-extrabold text-white"
                >
                  {t("livestockDetail.relatedTitle")}
                </h2>
              </div>
              <span className="text-xs font-semibold text-white/60">
                {t("livestockDetail.swipeToExplore")}
              </span>
            </div>
            <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
              {relatedLivestock.map((item) => {
                const image = item.coverImage || item.images?.[0] || "";
                const label = item.breed || translatedListingValue(t, "speciesValues", SPECIES_VALUE_KEYS, item.species) || t("livestockDetail.livestockFallback");
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(event) =>
                      navigateFromProductCard(
                        `/livestock/${encodeURIComponent(item.id)}`,
                        event.currentTarget,
                        { image, label },
                      )
                    }
                    className="w-40 flex-none snap-start overflow-hidden rounded-2xl border border-[#E3C19F]/55 bg-gradient-to-br from-[#41362D] to-[#6B594A] text-left shadow-lg shadow-black/20 transition-transform duration-200 active:scale-[0.98] sm:w-48"
                  >
                    <ProductImage
                      src={image}
                      alt={label}
                      fallbackLabel={t("livestockDetail.noImage")}
                      className="h-28 w-full rounded-none border-0 sm:h-32"
                    />
                    <div className="p-3">
                      <p className="truncate text-sm font-extrabold text-white">
                        {label}
                      </p>
                      <p className="mt-1 text-base font-extrabold text-[#F7EDE2]">
                        {formatRM(item.price)}
                      </p>
                      <span className="mt-2 inline-flex rounded-lg border border-[#F7EDE2]/70 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">
                        {t("livestockDetail.viewItem")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </DetailOuterSheet>

      {/* Primary actions stay reachable above the bottom nav */}
      <StickyActionBar tone="light" label={tf("detail.actionsLabel")} className="gap-2">
        <div className="min-w-0 flex-none">
          <p className="text-xs font-semibold text-[#6B594A]">{tf("detail.price")}</p>
          <p className="whitespace-nowrap text-lg font-extrabold leading-tight text-[#41362D]">{price}</p>
        </div>
        {orderCheck.loading ? (
          <div className="flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-xl border-2 border-[#E3C19F] bg-[#F7EDE2] px-3 text-center text-sm font-bold text-[#41362D]">
            {t("livestockDetail.checkingOrders")}
          </div>
        ) : orderCheck.ordered ? (
          <button
            type="button"
            onClick={() => navigateWithTransition("/orders")}
            className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] px-3 text-sm font-bold text-white"
          >
            <PackageCheck aria-hidden="true" className="h-4 w-4 flex-none" />
            {t("livestockDetail.alreadyOrdered")}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={isInCart ? () => navigateWithTransition("/cart") : handleAddToCart}
              aria-label={isInCart ? tf("detail.inCartViewAria") : tf("detail.addToCartAria", { title })}
              className="flex min-h-12 flex-none items-center justify-center gap-1.5 rounded-xl border-2 border-[#41362D] bg-[#F7EDE2] px-2.5 text-sm font-bold leading-tight text-[#41362D] transition-all duration-200 ease-out active:scale-[0.98]"
            >
              {isInCart ? (
                <>
                  <Check aria-hidden="true" className="h-4 w-4" /> {t("livestockDetail.inCart")}
                </>
              ) : (
                <>
                  <ShoppingCart aria-hidden="true" className="h-4 w-4" /> {t("livestockDetail.add")}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-3 text-sm font-bold text-white shadow-md shadow-black/20 transition-all duration-200 ease-out active:scale-[0.98]"
            >
              <Zap aria-hidden="true" className="hidden h-4 w-4 flex-none min-[420px]:block" />
              <span className="text-center leading-tight">{t("livestockDetail.buyNow")}</span>
            </button>
          </>
        )}
      </StickyActionBar>

      <ImageLightbox
        image={previewImage}
        alt={title}
        onClose={() => setPreviewImage("")}
      />
      <AvailabilityModal
        state={availabilityModal}
        onClose={() => setAvailabilityModal("")}
        onBrowse={() =>
          navigateWithTransition(
            availabilityModal === "reserved_by_you" ? "/orders" : returnPath,
          )
        }
        backLabel={returnLabel}
      />
    </div>
  );
}
