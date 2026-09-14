import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  X,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { loadLivestockWithFarmers } from "@/lib/farmerClient";
import {
  SPECIES_EMOJIS,
  STATUS_COLORS,
  extractState,
  MALAYSIAN_STATES,
} from "@/lib/livestock-data";
import FilterSidebar from "@/components/FilterSidebar";
import { useReveal } from "@/hooks/useReveal";
import AppHeader from "@/components/AppHeader";
import ViewCartCard from "@/components/ViewCartCard";
import PageLoading from "@/components/PageLoading";

function LivestockCard({ livestock, index = 0 }) {
  const navigate = useNavigate();

  const emoji = SPECIES_EMOJIS[livestock.species] || "🐾";
  const img = livestock.coverImage || livestock.images?.[0] || "";

  const productName =
    livestock.name ||
    livestock.breed ||
    livestock.species ||
    "Livestock";

  const details = [livestock.species, livestock.breed]
    .filter(Boolean)
    .filter(
      (value, position, values) =>
        values.indexOf(value) === position,
    )
    .join(" · ");

  return (
    <div
      onClick={() => navigate(`/livestock/${livestock.id}`)}
      className="flex min-h-[300px] cursor-pointer flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/30 animate-fade-in-up active:scale-[0.98] transition-transform"
      style={{
        animationDelay: `${Math.min(index * 40, 300)}ms`,
      }}
    >
      {/* Image */}
      <div className="relative h-32 flex-none cursor-pointer">
        {img ? (
          <img
            src={img}
            alt={livestock.breed}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#E3C19F] text-3xl text-[#41362D]">
            {emoji}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Status */}
        <span
          className={`absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[13px] font-bold ${
            STATUS_COLORS[livestock.status]
          }`}
        >
          {livestock.status || "N/A"}
        </span>
      </div>

      {/* Details */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 break-words text-sm font-bold leading-tight text-white">
            RM {(livestock.price || 0).toLocaleString()}
          </span>

          {livestock.gender && (
            <span
              className="flex-none rounded-2xl px-2 py-0.5 text-[12px] font-bold"
              style={{
                background: "linear-gradient(to bottom right, #E3C19F, #F7EDE2)",
                color: "#000000",
              }}
            >
              {livestock.gender}
          </span>
          )}
        </div>

        <p className="line-clamp-2 min-h-[28px] break-words text-[15px] font-bold leading-[14px] text-white/80">
          {details || "Livestock details unavailable"}
        </p>

        <div className="mt-auto flex min-w-0 items-start gap-1 text-[5px] leading-[14px] text-white/70">
          <MapPin className="mt-0.5 h-2.5 w-2.5 flex-shrink-0" />

          <span className="min-w-0 flex-1 whitespace-normal break-words [overflow-wrap:anywhere] text-[15px] text-white/80">
            {(livestock.farmLocation || "No location").toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Browse() {
  const navigate = useNavigate();
  const location = useLocation();

  const [livestock, setLivestock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { totalItems, totalPrice } = useCart();

  const [searchQuery, setSearchQuery] = useState("");

  // Species filter
  const [activeSpecies, setActiveSpecies] = useState("All");

  const [filterBreed, setFilterBreed] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState("newest");
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

    if (!speciesFromHome) return;

    setActiveSpecies(speciesFromHome);

    /*
     * Clear the navigation state after reading it.
     * This prevents the filter from being reapplied if
     * Browse is refreshed.
     */
    window.history.replaceState({}, document.title);
  }, [location.state]);

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
          e.message || "Failed to load livestock",
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
      ].sort(),
    [livestock],
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

  const statusOptions = useMemo(
    () =>
      [
        ...new Set(
          livestock
            .map((l) => l.status)
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
    let result = livestock.filter((l) => {
      // Species
      if (
        activeSpecies !== "All" &&
        l.species !== activeSpecies
      ) {
        return false;
      }

      // Breed
      if (
        filterBreed &&
        l.breed !== filterBreed
      ) {
        return false;
      }

      // Gender
      if (
        filterGender &&
        l.gender !== filterGender
      ) {
        return false;
      }

      // Age
      if (
        filterAge &&
        l.age !== filterAge
      ) {
        return false;
      }

      // Status
      if (
        filterStatus &&
        l.status !== filterStatus
      ) {
        return false;
      }

      // Location
      if (
        filterLocation &&
        extractState(l.farmLocation) !==
          filterLocation
      ) {
        return false;
      }

      // Minimum price
      if (
        priceMin &&
        (l.price || 0) < Number(priceMin)
      ) {
        return false;
      }

      // Maximum price
      if (
        priceMax &&
        (l.price || 0) > Number(priceMax)
      ) {
        return false;
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();

        const matches =
          (l.breed || "")
            .toLowerCase()
            .includes(q) ||
          (l.species || "")
            .toLowerCase()
            .includes(q) ||
          (l.earTag || "")
            .toLowerCase()
            .includes(q) ||
          (l.rfid || "")
            .toLowerCase()
            .includes(q) ||
          (l.farmLocation || "")
            .toLowerCase()
            .includes(q) ||
          (l.farmer_name || "")
            .toLowerCase()
            .includes(q) ||
          (l.description || "")
            .toLowerCase()
            .includes(q) ||
          (l.specialNotes || "")
            .toLowerCase()
            .includes(q);

        if (!matches) return false;
      }

      return true;
    });

    /*
     * =======================================================
     * SORT
     * =======================================================
     */

    if (sortBy === "price-asc") {
      result = [...result].sort(
        (a, b) =>
          (a.price || 0) -
          (b.price || 0),
      );
    } else if (sortBy === "price-desc") {
      result = [...result].sort(
        (a, b) =>
          (b.price || 0) -
          (a.price || 0),
      );
    } else {
      result = [...result].sort(
        (a, b) =>
          new Date(b.created_date) -
          new Date(a.created_date),
      );
    }

    return result;
  }, [
    livestock,
    activeSpecies,
    filterBreed,
    filterGender,
    filterAge,
    filterStatus,
    filterLocation,
    priceMin,
    priceMax,
    searchQuery,
    sortBy,
  ]);

  /*
   * =========================================================
   * FILTER COUNTS
   * =========================================================
   */

  const hasFilters =
    activeSpecies !== "All" ||
    filterBreed ||
    filterGender ||
    filterAge ||
    filterStatus ||
    filterLocation ||
    priceMin ||
    priceMax ||
    searchQuery;

  const activeFilterCount = [
    activeSpecies !== "All"
      ? activeSpecies
      : "",
    filterBreed,
    filterGender,
    filterAge,
    filterStatus,
    filterLocation,
    priceMin,
    priceMax,
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
    setFilterStatus("");
    setFilterLocation("");
    setPriceMin("");
    setPriceMax("");
    setSearchQuery("");
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8">
        {sharedStyles}

        <AlertCircle className="h-12 w-12 text-red-400" />

        <p className="text-center font-semibold text-gray-600">
          Failed to load livestock
        </p>

        <p className="max-w-xs text-center text-sm text-gray-400">
          {error}
        </p>

        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-all active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
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
    <div className="qurbi-page pb-32">
      {sharedStyles}

      <AppHeader
        sticky
        title="Browse Livestock"
        search={
          <div className="flex gap-2">
            {/* Search */}
            <label className="qurbi-search flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 focus-within:ring-2 focus-within:ring-[#E3C19F]">
              <Search className="h-4 w-4 flex-none text-[#41362D]" />

              <input
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                placeholder="Search name, tag, breed, farmer..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-[#41362D]" />
                </button>
              )}
            </label>

            {/* Filter button */}
            <button
              type="button"
              onClick={() =>
                setShowFilters(true)
              }
              aria-label="Open filters"
              className="relative flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#E3C19F] text-[#41362D] shadow-md transition-transform active:scale-90"
            >
              <SlidersHorizontal className="h-4 w-4" />

              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
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
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
                activeSpecies === sp
                  ? "bg-[#E3C19F] text-[#41362D] shadow-md"
                  : "bg-white/10 text-white/80"
              }`}
            >
              {sp === "All"
                ? "All"
                : `${SPECIES_EMOJIS[sp] || "🐾"} ${sp}`}
            </button>
          ))}
        </div>
      </AppHeader>

      {loading && !livestock.length ? (
        <PageLoading contentOnly message="Loading livestock..." />
      ) : (
        <>
          <ViewCartCard totalItems={totalItems} totalPrice={totalPrice} />

          {/* Result count */}
          <div
            className={`flex items-center justify-between px-4 pt-3 ${reveal()}`}
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-xs text-gray-400">
              {`${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Results */}
          <div className="space-y-4 px-4 pt-3">
            {filtered.length === 0 ? (
              <div className="flex animate-fade-in-up flex-col items-center justify-center py-16 text-center">
                <Search className="mb-2 h-10 w-10 text-emerald-100" />
                <p className="text-sm text-gray-400">No livestock found.</p>
                {hasFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-2 text-sm font-semibold text-emerald-700 transition-all active:scale-95"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div
                key={`${searchQuery}-${activeSpecies}`}
                className="grid animate-fade-in-up grid-cols-2 gap-2.5 sm:grid-cols-3"
              >
                {filtered.map((l, idx) => (
                  <LivestockCard
                    key={l.id}
                    livestock={l}
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
        onClose={() =>
          setShowFilters(false)
        }
        filters={{
          filterBreed,
          setFilterBreed,
          filterGender,
          setFilterGender,
          filterAge,
          setFilterAge,
          filterStatus,
          setFilterStatus,
          filterLocation,
          setFilterLocation,
          priceMin,
          setPriceMin,
          priceMax,
          setPriceMax,
          sortBy,
          setSortBy,
          clearAllFilters,
        }}
        options={{
          breedOptions,
          genderOptions,
          ageOptions,
          statusOptions,
          locationOptions,
        }}
      />
    </div>
  );
}
