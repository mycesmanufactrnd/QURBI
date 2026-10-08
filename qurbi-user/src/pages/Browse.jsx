import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  X,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { loadLivestockWithFarmers } from "@/lib/farmerClient";
import { MALAYSIAN_STATES } from "@/lib/livestock-data";
import FilterSidebar from "@/components/FilterSidebar";
import { useReveal } from "@/hooks/useReveal";
import AppHeader from "@/components/AppHeader";
import PageLoading from "@/components/PageLoading";
import LivestockCard from "@/components/shop/LivestockCard";
import { useCart } from "@/lib/cart-context";
import { isProductExpired } from "@/lib/product-expiry";
import {
  genderLabel,
  listingState,
} from "@/lib/listing-display";

const BROWSE_FILTERS_KEY = "qurbi_browse_filters";

function readBrowseFilters() {
  if (typeof sessionStorage === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(BROWSE_FILTERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function matchesBrowseFilters(livestock, filters) {
  if (isProductExpired(livestock)) return false;
  if (filters.activeSpecies !== "All" && livestock.species !== filters.activeSpecies) return false;
  if (filters.filterBreed && livestock.breed !== filters.filterBreed) return false;
  if (filters.filterGender && livestock.gender !== filters.filterGender) return false;
  if (filters.filterAge && livestock.age !== filters.filterAge) return false;
  if (filters.filterLocation && listingState(livestock) !== filters.filterLocation) return false;
  if (filters.priceMin && (livestock.price || 0) < Number(filters.priceMin)) return false;
  if (filters.priceMax && (livestock.price || 0) > Number(filters.priceMax)) return false;

  if (!filters.searchQuery) return true;
  const query = filters.searchQuery.toLowerCase();
  return [
    livestock.name,
    livestock.title,
    livestock.breed,
    livestock.species,
    livestock.earTag,
    livestock.rfid,
    livestock.farmLocation,
    livestock.farmer_name,
    livestock.description,
    livestock.specialNotes,
  ].some((value) => String(value || "").toLowerCase().includes(query));
}

export default function Browse() {
  const { cartItems } = useCart();
  const { t } = useTranslation("shop");
  const { t: tf } = useTranslation("shopflow");
  const location = useLocation();
  const searchInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [savedFilters] = useState(readBrowseFilters);

  const [livestock, setLivestock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState(savedFilters.searchQuery || "");

  // Species filter
  const [activeSpecies, setActiveSpecies] = useState(savedFilters.activeSpecies || "All");

  const [filterBreed, setFilterBreed] = useState(savedFilters.filterBreed || "");
  const [filterGender, setFilterGender] = useState(savedFilters.filterGender || "");
  const [filterAge, setFilterAge] = useState(savedFilters.filterAge || "");
  const [filterLocation, setFilterLocation] = useState(savedFilters.filterLocation || "");
  const [priceMin, setPriceMin] = useState(savedFilters.priceMin || "");
  const [priceMax, setPriceMax] = useState(savedFilters.priceMax || "");
  const [sortBy, setSortBy] = useState(savedFilters.sortBy || "newest");
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    filterBreed: savedFilters.filterBreed || "",
    filterGender: savedFilters.filterGender || "",
    filterAge: savedFilters.filterAge || "",
    filterLocation: savedFilters.filterLocation || "",
    priceMin: savedFilters.priceMin || "",
    priceMax: savedFilters.priceMax || "",
    sortBy: savedFilters.sortBy || "newest",
  }));
  const [showFilters, setShowFilters] = useState(false);

  const { mounted, reveal } = useReveal();

  /*
   * =========================================================
   * RECEIVE SPECIES FILTER FROM HOME
   * =========================================================
   *
   * Home sends:
   *
   * <Link
   *   to="/browse"
   *   state={{ species: "Cow" }}
   * >
   *
   * This sets the Browse species filter without putting
   * anything into the URL.
   */
  useEffect(() => {
    const speciesFromHome = location.state?.species;
    const queryFromHome = location.state?.query;
    const focusFromHome = location.state?.focusSearch;

    if (!speciesFromHome && !queryFromHome && !focusFromHome) return;

    if (speciesFromHome) setActiveSpecies(speciesFromHome);
    if (typeof queryFromHome === "string") setSearchQuery(queryFromHome);
    if (focusFromHome) {
      window.setTimeout(() => searchInputRef.current?.focus(), 350);
    }

    /*
     * Clear the navigation state after reading it.
     * This prevents the filter from being reapplied if
     * Browse is refreshed.
     */
    window.history.replaceState(
      { ...window.history.state, usr: null },
      document.title,
    );
  }, [location.state]);

  useEffect(() => {
    try {
      sessionStorage.setItem(BROWSE_FILTERS_KEY, JSON.stringify({
        searchQuery,
        activeSpecies,
        ...appliedFilters,
      }));
    } catch {
      // Session storage may be unavailable in restricted browser contexts.
    }
  }, [searchQuery, activeSpecies, appliedFilters]);

  /*
   * =========================================================
   * LOAD LIVESTOCK
   * =========================================================
   */

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    loadLivestockWithFarmers()
      .then(setLivestock)
      .catch((e) =>
        setError(
          e.message || t("browse.error.defaultMessage"),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /*
   * =========================================================
   * FILTER OPTIONS
   * =========================================================
   */

  const speciesList = useMemo(
    () => [
      "All",
      ...new Set(
        livestock
          .map((l) => l.species)
          .filter(Boolean),
      ),
    ],
    [livestock],
  );

  const breedOptions = useMemo(
    () =>
      [
        ...new Set(
          livestock
            .map((l) => l.breed)
            .filter(Boolean),
        ),
      ].sort(),
    [livestock],
  );

  const genderOptions = useMemo(
    () =>
      [
        ...new Set(
          livestock
            .map((l) => l.gender)
            .filter(Boolean),
        ),
      ]
        .sort()
        .map((value) => ({ value, label: genderLabel(tf, value) })),
    [livestock, tf],
  );

  const ageOptions = useMemo(
    () =>
      [
        ...new Set(
          livestock
            .map((l) => l.age)
            .filter(Boolean),
        ),
      ].sort(),
    [livestock],
  );

  const locationOptions = useMemo(
    () => MALAYSIAN_STATES,
    [],
  );

  /*
   * =========================================================
   * FILTER LIVESTOCK
   * =========================================================
   */

  const filtered = useMemo(() => {
    let result = livestock.filter((item) => matchesBrowseFilters(item, {
      activeSpecies,
      searchQuery,
      ...appliedFilters,
    }));

    /*
     * =======================================================
     * SORT
     * =======================================================
     */

    if (appliedFilters.sortBy === "price-asc") {
      result = [...result].sort(
        (a, b) =>
          (a.price || 0) -
          (b.price || 0),
      );
    } else if (appliedFilters.sortBy === "price-desc") {
      result = [...result].sort(
        (a, b) =>
          (b.price || 0) -
          (a.price || 0),
      );
    } else {
      result = [...result].sort(
        (a, b) =>
          new Date(b.created_date).getTime() -
          new Date(a.created_date).getTime(),
      );
    }

    return result;
  }, [
    livestock,
    activeSpecies,
    appliedFilters,
    searchQuery,
  ]);

  const draftResultCount = useMemo(
    () => livestock.filter((item) => matchesBrowseFilters(item, {
      activeSpecies,
      searchQuery,
      filterBreed,
      filterGender,
      filterAge,
      filterLocation,
      priceMin,
      priceMax,
    })).length,
    [
      livestock,
      activeSpecies,
      searchQuery,
      filterBreed,
      filterGender,
      filterAge,
      filterLocation,
      priceMin,
      priceMax,
    ],
  );

  /*
   * =========================================================
   * FILTER COUNTS
   * =========================================================
   */

  const hasFilters =
    activeSpecies !== "All" ||
    appliedFilters.filterBreed ||
    appliedFilters.filterGender ||
    appliedFilters.filterAge ||
    appliedFilters.filterLocation ||
    appliedFilters.priceMin ||
    appliedFilters.priceMax ||
    searchQuery;

  const activeFilterCount = [
    activeSpecies !== "All"
      ? activeSpecies
      : "",
    appliedFilters.filterBreed,
    appliedFilters.filterGender,
    appliedFilters.filterAge,
    appliedFilters.filterLocation,
    appliedFilters.priceMin,
    appliedFilters.priceMax,
  ].filter(Boolean).length;

  /*
   * =========================================================
   * CLEAR ALL FILTERS
   * =========================================================
   */

  const clearAllFilters = () => {
    setActiveSpecies("All");
    setFilterBreed("");
    setFilterGender("");
    setFilterAge("");
    setFilterLocation("");
    setPriceMin("");
    setPriceMax("");
    setSortBy("newest");
    setAppliedFilters({
      filterBreed: "",
      filterGender: "",
      filterAge: "",
      filterLocation: "",
      priceMin: "",
      priceMax: "",
      sortBy: "newest",
    });
    setSearchQuery("");
  };

  const syncDraftFilters = useCallback((nextFilters = appliedFilters) => {
    setFilterBreed(nextFilters.filterBreed);
    setFilterGender(nextFilters.filterGender);
    setFilterAge(nextFilters.filterAge);
    setFilterLocation(nextFilters.filterLocation);
    setPriceMin(nextFilters.priceMin);
    setPriceMax(nextFilters.priceMax);
    setSortBy(nextFilters.sortBy);
  }, [appliedFilters]);

  const openFilterPanel = () => {
    syncDraftFilters();
    setShowFilters(true);
  };

  const closeFilterPanel = useCallback(() => {
    syncDraftFilters();
    setShowFilters(false);
  }, [syncDraftFilters]);

  const applyDraftFilters = () => {
    setAppliedFilters({
      filterBreed,
      filterGender,
      filterAge,
      filterLocation,
      priceMin,
      priceMax,
      sortBy,
    });
    setShowFilters(false);
  };

  const clearDraftFilters = () => {
    setFilterBreed("");
    setFilterGender("");
    setFilterAge("");
    setFilterLocation("");
    setPriceMin("");
    setPriceMax("");
    setSortBy("newest");
  };

  /*
   * =========================================================
   * STYLES / ANIMATIONS
   * =========================================================
   */

  const sharedStyles = (
    <style>{`
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes softPulse {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(4,120,87,0.35);
        }

        50% {
          box-shadow: 0 0 0 5px rgba(4,120,87,0);
        }
      }

      .animate-fade-in-up {
        animation: fadeInUp 0.45s ease-out both;
      }

      .animate-soft-pulse {
        animation: softPulse 2s ease-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .animate-fade-in-up,
        .animate-soft-pulse {
          animation: none;
        }

        * {
          transition-duration: 0.01ms !important;
        }
      }
    `}</style>
  );

  /*
   * =========================================================
   * ERROR STATE
   * =========================================================
   */

  if (error && !livestock.length) {
    return (
      <div className="aisyah-page flex flex-col items-center justify-center gap-4 p-8">
        {sharedStyles}

        <AlertCircle aria-hidden="true" className="h-12 w-12 text-[#6B594A]" />

        <p className="text-center text-lg font-bold text-[#41362D]">
          {t("browse.error.title")}
        </p>

        <p className="max-w-xs text-center text-sm text-[#6B594A]">
          {error}
        </p>

        <button
          type="button"
          onClick={loadData}
          className="aisyah-primary-button flex min-h-12 items-center gap-2 px-6"
        >
          <RefreshCw className="h-4 w-4" />
          {t("browse.error.retry")}
        </button>
      </div>
    );
  }

  /*
   * =========================================================
   * MAIN UI
   * =========================================================
   */

  return (
    <main className="aisyah-page pb-32">
      {sharedStyles}

      <AppHeader
        sticky
        thresholdShrink
        title={t("browse.headerTitle")}
        search={
          <div className="flex gap-2">
            {/* Search */}
            <label className="qurbi-search flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border pl-3 focus-within:ring-2 focus-within:ring-[#E3C19F]">
              <Search aria-hidden="true" className="h-5 w-5 flex-none text-[#41362D]" />
              <span className="sr-only">{tf("browse.searchLabel")}</span>

              <input
                ref={searchInputRef}
                type="search"
                enterKeyHint="search"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                placeholder={t("browse.searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  aria-label={t("browse.clearSearch")}
                  className="-ml-3 flex h-11 w-11 flex-none items-center justify-center rounded-xl"
                >
                  <X className="h-4 w-4 text-[#41362D]" />
                </button>
              )}
            </label>

            {/* Filter button */}
            <button
              type="button"
              onClick={openFilterPanel}
              aria-label={t("browse.openFilters")}
              className="relative flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#E3C19F] text-[#41362D] shadow-md transition-transform active:scale-90"
            >
              <SlidersHorizontal className="h-5 w-5" />

              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#F7EDE2] bg-[#41362D] px-1 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        }
      >
        {/* Species filter */}
        <div className="horizontal-filter-scroll no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
          {speciesList.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() =>
                setActiveSpecies(sp)
              }
              aria-pressed={activeSpecies === sp}
              className={`min-h-11 flex-shrink-0 rounded-full px-5 text-sm font-semibold transition-all active:scale-95 ${
                activeSpecies === sp
                  ? "bg-[#E3C19F] text-[#41362D] shadow-md"
                  : "border border-white/25 bg-white/10 text-white"
              }`}
            >
              {sp === "All"
                ? t("browse.allSpecies")
                : t(`home.species.${String(sp).toLowerCase()}`, { defaultValue: sp })}
            </button>
          ))}
        </div>
      </AppHeader>

      {loading && !livestock.length ? (
        <PageLoading contentOnly message={t("browse.loadingLivestock")} />
      ) : (
        <>
          {/* Result count */}
          <div
            className={`mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 ${reveal()}`}
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-sm font-semibold text-[#41362D]" aria-live="polite">
              {t("browse.resultsCount", { count: filtered.length })}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="min-h-11 rounded-xl px-2 text-sm font-bold text-[#41362D] underline underline-offset-4"
              >
                {t("browse.clearFilters")}
              </button>
            )}
          </div>

          {/* Results */}
          <div className="mx-auto max-w-6xl space-y-4 px-4 pt-3">
            {filtered.length === 0 ? (
              <div className="flex animate-fade-in-up flex-col items-center justify-center py-16 text-center">
                <Search aria-hidden="true" className="mb-3 h-10 w-10 text-[#6B594A]" />
                <p className="text-base font-bold text-[#41362D]">{t("browse.noLivestockFound")}</p>
                <p className="mt-1 max-w-xs text-sm text-[#6B594A]">
                  {hasFilters ? tf("browse.emptyWithFilters") : tf("browse.emptyNoListings")}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="aisyah-primary-button mt-4 min-h-12 px-6"
                  >
                    {t("browse.clearFilters")}
                  </button>
                ) : (
                  <Link to="/bulk-buy" className="aisyah-primary-button mt-4 inline-flex min-h-12 items-center px-6">
                    {tf("browse.tryBulkBuy")}
                  </Link>
                )}
              </div>
            ) : (
              <div
                key={`${searchQuery}-${activeSpecies}`}
                className="grid animate-fade-in-up grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
              >
                {filtered.map((l, idx) => (
                  <LivestockCard
                    key={l.id}
                    livestock={l}
                    inCart={cartItems.some((item) => item.item_type !== "bulk" && String(item.livestock_id || item.id) === String(l.id))}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Filter Sidebar */}
      <FilterSidebar
        open={showFilters}
        onClose={closeFilterPanel}
        onApply={applyDraftFilters}
        resultCount={draftResultCount}
        filters={{
          filterBreed,
          setFilterBreed,
          filterGender,
          setFilterGender,
          filterAge,
          setFilterAge,
          filterLocation,
          setFilterLocation,
          priceMin,
          setPriceMin,
          priceMax,
          setPriceMax,
          sortBy,
          setSortBy,
          clearAllFilters: clearDraftFilters,
        }}
        options={{
          breedOptions,
          genderOptions,
          ageOptions,
          locationOptions,
        }}
      />
    </main>
  );
}
