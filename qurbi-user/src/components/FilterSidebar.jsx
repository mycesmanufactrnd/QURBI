import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, SlidersHorizontal, RotateCcw } from "lucide-react";
import FilterDropdown from "@/components/FilterDropdown";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
];

export default function FilterSidebar({ open, onClose, filters, options }) {
  const {
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
  } = filters;

  useEffect(() => {
    if (!open) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-gradient-to-br from-[#F7EDE2] to-[#E3C19F] shadow-2xl shadow-[#41362D]/20 transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3C19F] flex-shrink-0 bg-gradient-to-br from-[#41362D] to-[#6B594A]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-white" />
            <h2 className="text-white font-bold text-lg">Filters & Sort</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAllFilters}
              className="px-4 h-9 rounded-full border border-[#E3C19F] bg-white/10 text-white font-bold text-sm flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overscroll-y-contain overflow-y-auto px-5 py-4 space-y-5 touch-pan-y">
          {/* Sort */}
          <FilterDropdown
            title="Sort By"
            options={SORT_OPTIONS}
            value={sortBy}
            onSelect={setSortBy}
            allowEmpty={false}
          />

          {/* Price Range */}
          <div>
            <h3 className="text-gray-500 font-semibold text-xs uppercase tracking-wide mb-1.5">
              Price Range (RM)
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min"
                className="w-full rounded-2xl border-2 border-[#41362D]/70 bg-[#F7EDE2] px-3.5 py-3 text-sm font-medium text-black transition-all duration-200 focus:border-[#41362D] focus:outline-none focus:ring-4 focus:ring-[#E3C19F]/70"
              />
              <span className="text-gray-300 text-sm font-medium">—</span>
              <input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max"
                className="w-full rounded-2xl border-2 border-[#41362D]/70 bg-[#F7EDE2] px-3.5 py-3 text-sm font-medium text-black transition-all duration-200 focus:border-[#41362D] focus:outline-none focus:ring-4 focus:ring-[#E3C19F]/70"
              />
            </div>
          </div>

          <FilterDropdown
            title="Breed"
            options={options.breedOptions}
            value={filterBreed}
            onSelect={setFilterBreed}
          />
          <FilterDropdown
            title="Gender"
            options={options.genderOptions}
            value={filterGender}
            onSelect={setFilterGender}
          />
          <FilterDropdown
            title="Age"
            options={options.ageOptions}
            value={filterAge}
            onSelect={setFilterAge}
          />
          <FilterDropdown
            title="Status"
            options={options.statusOptions}
            value={filterStatus}
            onSelect={setFilterStatus}
          />
          <FilterDropdown
            title="Location"
            options={options.locationOptions}
            value={filterLocation}
            onSelect={setFilterLocation}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
