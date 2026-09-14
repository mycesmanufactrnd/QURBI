import React, { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Check,
  Star,
  Phone,
  Mail,
  User,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useReveal } from "@/hooks/useReveal";
import AppHeader from "@/components/AppHeader";
import PageLoading from "@/components/PageLoading";

const EMPTY = {
  label: "",
  name: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
  isDefault: false,
};

const inputCls =
  "w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-300 text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition";

function AddressForm({ initial, onSave, onCancel }) {
  const { profile } = useUserProfile();
  const [form, setForm] = useState({
    ...EMPTY,
    name: profile?.name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    ...(initial || {}),
  });
  const set = (k) => (e) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.street.trim()) return alert("Street address is required.");
    if (!form.city.trim()) return alert("City is required.");
    onSave(form);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Form Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
        <h3 className="text-white font-bold">
          {initial?.id ? "Edit Address" : "Add New Address"}
        </h3>
        <p className="text-xs text-white">
          Fill in the delivery contact & location
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="text-gray-500 text-xs font-semibold mb-1.5 block">
            ADDRESS LABEL
          </label>
          <input
            value={form.label}
            onChange={set("label")}
            placeholder='e.g. "Home", "Office", "Farm"'
            className={inputCls}
          />
        </div>

        {/* Contact Info Section */}
        <div className="space-y-2">
          <label className="text-gray-500 text-xs font-semibold block">
            CONTACT INFORMATION
          </label>

          <div className="relative">
            <User className="absolute left-3 top-3.5 h-4 w-4 text-white" />
            <input
              value={profile?.name || ""}
              readOnly
              placeholder="Full Name *"
              className={inputCls + " pl-9 bg-gray-100 cursor-not-allowed"}
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white" />
            <input
              value={profile?.email || ""}
              readOnly
              placeholder="Email Address"
              type="email"
              className={inputCls + " pl-9 bg-gray-100 cursor-not-allowed"}
            />
          </div>

          <div className="relative">
            <Phone className="absolute left-3 top-3.5 h-4 w-4 text-white" />
            <input
              value={profile?.phone || ""}
              readOnly
              placeholder="Phone / WhatsApp"
              type="tel"
              className={inputCls + " pl-9 bg-gray-100 cursor-not-allowed"}
            />
          </div>
        </div>

        {/* Address Section */}

        <div className="space-y-2">
          <label className="text-gray-500 text-xs font-semibold block">
            DELIVERY ADDRESS *
          </label>
          <input
            value={form.street}
            onChange={set("street")}
            placeholder="Street / Unit / Building *"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.city}
              onChange={set("city")}
              placeholder="City *"
              className={inputCls}
            />
            <input
              value={form.state}
              onChange={set("state")}
              placeholder="State"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.postcode}
              onChange={set("postcode")}
              placeholder="Postcode"
              className={inputCls}
            />
            <input
              value={form.country}
              onChange={set("country")}
              placeholder="Country"
              className={inputCls}
            />
          </div>
        </div>

        {/* Default Toggle */}
        <button
          onClick={() => setForm((p) => ({ ...p, isDefault: !p.isDefault }))}
          className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${form.isDefault ? "border-[#E3C19F] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]" : "border-gray-100 bg-gray-50"}`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${form.isDefault ? "border-[#41362D] bg-gradient-to-br from-[#41362D] to-[#6B594A]" : "border-gray-300"}`}
          >
            {form.isDefault && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="text-left">
            <p
              className={`text-sm font-semibold ${form.isDefault ? "text-[#41362D]" : "text-gray-600"}`}
            >
              Set as default address
            </p>
            <p
              className={`text-xs ${form.isDefault ? "text-[#6B594A]" : "text-gray-400"}`}
            >
              Auto-selected in cart checkout
            </p>
          </div>
          {form.isDefault && (
            <Star className="ml-auto h-4 w-4 fill-[#41362D] text-[#41362D]" />
          )}
        </button>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm active:scale-95 transition-transform shadow-sm shadow-emerald-200"
          >
            Save Address
          </button>
        </div>
      </div>
    </div>
  );
}

function AddressCard({
  addr,
  isSelected,
  onEdit,
  onDelete,
  onSetDefault,
  onSelect,
}) {
  return (
    <div className="rounded-2xl border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-lg shadow-black/20 transition-all duration-200 ease-out">
      {/* Top Bar */}
      <div className="flex items-center justify-between rounded-t-2xl bg-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {addr.label ? (
            <span className="text-sm font-bold text-white">{addr.label}</span>
          ) : (
            <span className="text-sm text-white/70">No label</span>
          )}
          {addr.isDefault && (
            <span className="flex items-center gap-1 rounded-full border border-[#F7EDE2]/60 bg-gradient-to-br from-[#41362D] to-[#6B594A] px-2 py-0.5 text-[10px] font-bold text-white">
              <Star className="w-2.5 h-2.5 fill-white" /> DEFAULT
            </span>
          )}
          {isSelected && !addr.isDefault && (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              SELECTED
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(addr)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-black transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
          >
            <Pencil className="h-4 w-4 text-black" />
          </button>
          <button
            onClick={() => onDelete(addr.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-700 shadow-sm shadow-red-950/25 transition-transform active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2">
        {/* Contact */}
        <div className="space-y-1">
          {addr.name && (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 flex-shrink-0 text-white" />
              <span className="text-sm font-semibold text-white">
                {addr.name}
              </span>
            </div>
          )}
          {addr.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 flex-shrink-0 text-white" />
              <span className="text-sm text-white/80">{addr.phone}</span>
            </div>
          )}
          {addr.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 flex-shrink-0 text-white" />
              <span className="text-xs text-white/70">{addr.email}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-50" />

        {/* Location */}
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white" />
          <div>
            <p className="text-sm text-white">{addr.street}</p>
            <p className="text-xs text-white/70">
              {[addr.city, addr.state, addr.postcode, addr.country]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {!addr.isDefault && (
            <button
              onClick={() => onSetDefault(addr.id)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#E3C19F] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] py-2 text-xs font-semibold text-[#41362D] transition-transform active:scale-95"
            >
              <Star className="w-3 h-3" /> Set Default
            </button>
          )}
          <button
            onClick={() => onSelect(addr.id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl border border-[#F7EDE2]/60 py-2 text-xs font-bold transition-transform active:scale-95 ${
              isSelected
                ? "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white"
                : "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-sm"
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-3 h-3" /> Selected
              </>
            ) : (
              "Use This Address"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AddressBook() {
  const {
    addresses,
    addAddress,
    updateAddress,
    deleteAddress,
    selectedAddressId,
    setSelectedAddressId,
    profileLoading,
  } = useUserProfile();
  const { reveal } = useReveal();
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const handleSave = (form) => {
    if (editingAddress) {
      updateAddress(editingAddress.id, form);
      setEditingAddress(null);
    } else {
      const newAddr = addAddress(form);
      setShowForm(false);
    }
  };

  const handleSetDefault = (id) => {
    const addr = addresses.find((a) => a.id === id);
    if (addr) updateAddress(id, { ...addr, isDefault: true });
    setSelectedAddressId(id);
  };

  if (profileLoading) {
    return (
      <div className="qurbi-page pb-10">
        <AppHeader
          title="Address Book"
          backTo="/profile"
          subtitle="Manage your delivery addresses"
        />
        <PageLoading contentOnly message="Loading your address book..." />
      </div>
    );
  }

  return (
    <div className="qurbi-page pb-10">
      <AppHeader
        title="Address Book"
        backTo="/profile"
        subtitle={`${addresses.length} saved address${addresses.length !== 1 ? "es" : ""}`}
      />

      <div className="qurbi-content">
        {/* Add / Edit Form */}
        {showForm && !editingAddress && (
          <div className={reveal()} style={{ animationDelay: "80ms" }}>
            <AddressForm
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Address Cards */}
        {addresses.map((addr, idx) =>
          editingAddress?.id === addr.id ? (
            <AddressForm
              key={addr.id}
              initial={addr}
              onSave={handleSave}
              onCancel={() => setEditingAddress(null)}
            />
          ) : (
            <div
              key={addr.id}
              className={reveal()}
              style={{ animationDelay: `${80 + idx * 60}ms` }}
            >
              <AddressCard
                addr={addr}
                isSelected={selectedAddressId === addr.id}
                onEdit={setEditingAddress}
                onDelete={deleteAddress}
                onSetDefault={handleSetDefault}
                onSelect={setSelectedAddressId}
              />
            </div>
          ),
        )}

        {/* Empty state */}
        {addresses.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <MapPin className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-gray-800 font-bold">No addresses yet</p>
            <p className="text-gray-400 text-sm text-center">
              Add a delivery address to use during checkout
            </p>
          </div>
        )}

        {/* Add button */}
        {!showForm && !editingAddress && (
          <button
            onClick={() => setShowForm(true)}
            className={`w-full py-4 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-500 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform bg-emerald-50/30 ${reveal()}`}
            style={{ animationDelay: "200ms" }}
          >
            <Plus className="w-4 h-4" /> Add New Address
          </button>
        )}
      </div>
    </div>
  );
}
