import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

// options: array of strings OR { value, label } objects
// value: currently selected value (string)
// onSelect: (value) => void
// allowEmpty: if true, shows an "All {title}" option that selects ""
export default function FilterDropdown({
  title,
  options,
  value,
  onSelect,
  allowEmpty = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const normalize = (opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt;

  const normalized = options.map(normalize);
  const isActive = !!value;
  const selectedLabel =
    normalized.find((o) => o.value === value)?.label ||
    (allowEmpty ? `All ${title}` : normalized[0]?.label || "");

  return (
    <div>
      {title && (
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B594A]">
          {title}
        </h3>
      )}
      <div className="relative" ref={ref}>
        {/* Trigger */}
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between rounded-2xl border-2 border-[#41362D]/70 pl-3.5 pr-3 py-3 text-sm font-medium transition-all duration-200 ${
            isActive
              ? "bg-[#E3C19F] text-[#41362D]"
              : "bg-[#E3C19F] text-black hover:border-[#41362D]"
          } ${open ? "border-[#41362D] ring-4 ring-[#E3C19F]/40" : ""}`}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform duration-300 ${open ? "rotate-180" : ""} ${
              isActive ? "text-[#41362D]" : "text-[#6B594A]"
            }`}
          />
        </button>

        {/* Panel */}
        <div
          className={`absolute top-full left-0 right-0 mt-1.5 z-50 origin-top transition-all duration-200 ease-out ${
            open
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-[#E3C19F] bg-[#E3C19F] py-1 shadow-xl shadow-black/15">
            {allowEmpty && (
              <button
                onClick={() => {
                  onSelect("");
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-colors duration-150 ${
                  !value
                    ? "bg-[#F7EDE2] text-[#41362D] font-bold"
                    : "text-[#6B594A] hover:bg-[#F7EDE2]"
                }`}
              >
                All {title}
                {!value && <Check className="w-4 h-4 flex-shrink-0" />}
              </button>
            )}
            {normalized.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-colors duration-150 ${
                  value === opt.value
                    ? "bg-[#F7EDE2] text-[#41362D] font-bold"
                    : "text-[#6B594A] hover:bg-[#F7EDE2]"
                }`}
              >
                {opt.label}
                {value === opt.value && (
                  <Check className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
