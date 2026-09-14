import React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MapPin, Check, User, Phone } from "lucide-react";

export default function AddressPickerModal({ addresses, selectedId, onSelect, onClose }) {
  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="address-picker-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-3xl pb-4 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden shadow-2xl">
        {/* Handle */}
        <div className="pt-3 pb-4 px-5 border-b border-gray-50 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <h3 id="address-picker-title" className="text-gray-900 font-bold text-lg">Select Delivery Address</h3>
          <p className="text-gray-400 text-xs mt-0.5">{addresses.length} saved address{addresses.length !== 1 ? "es" : ""}</p>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MapPin className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-gray-400 text-sm">No addresses saved yet.</p>
              <Link to="/address-book" onClick={onClose} className="text-emerald-500 font-semibold text-sm mt-2 block">
                + Add an address
              </Link>
            </div>
          ) : (
            addresses.map((addr) => {
              const isSelected = selectedId === addr.id;
              return (
                <button
                  key={addr.id}
                  onClick={() => { onSelect(addr.id); onClose(); }}
                  className={`w-full text-left rounded-2xl border-2 overflow-hidden transition-all ${isSelected ? "border-emerald-400" : "border-gray-100"}`}
                >
                  <div className={`px-4 py-2 flex items-center justify-between ${isSelected ? "bg-emerald-50" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-2">
                      {addr.label && <span className={`font-bold text-sm ${isSelected ? "text-emerald-700" : "text-gray-700"}`}>{addr.label}</span>}
                      {addr.isDefault && <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">DEFAULT</span>}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    {addr.name && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <span className="text-gray-800 text-sm font-semibold">{addr.name}</span>
                      </div>
                    )}
                    {addr.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <span className="text-gray-600 text-sm">{addr.phone}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-500 text-sm">{addr.street}, {[addr.city, addr.state, addr.postcode].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
