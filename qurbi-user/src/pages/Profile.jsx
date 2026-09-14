import React, { useState } from "react";
import {
  User,
  MapPin,
  Package,
  ChevronRight,
  Check,
  Pencil,
  X,
  Mail,
  Phone,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useReveal } from "@/hooks/useReveal";
import AuthButtons from "@/components/AuthButtons";
import AppHeader from "@/components/AppHeader";
import PageLoading from "@/components/PageLoading";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";

export default function Profile() {
  const { navigateFromIconPage } = useHeaderTransition();
  const { profile, profileLoading, updateProfile } = useUserProfile();
  const { reveal } = useReveal();
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showEdit, setShowEdit] = useState(false);

  const inputCls =
    "w-full rounded-xl border border-[#E3C19F] bg-[#F7EDE2] px-4 py-3 text-sm text-black placeholder-black/70 outline-none focus:border-[#6B594A] focus:ring-1 focus:ring-[#6B594A]";
  const cardGradientCls =
    "rounded-2xl bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-xl shadow-[#41362D]/25";

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await updateProfile({ name: form.name, phone: form.phone });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowEdit(false);
      }, 1200);
    } catch (error) {
      setSaveError(error.message || "Could not save your details.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    setForm(profile);
    setShowEdit(true);
  };

  if (profileLoading) {
    return (
      <div className="qurbi-page">
        <AppHeader title="Profile" subtitle="Manage your details" />
        <PageLoading contentOnly message="Loading your profile..." />
      </div>
    );
  }

  return (
    <div className="qurbi-page">
      <style>{`
        @keyframes profileFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes profilePopIn {
          0% { opacity: 0; transform: translateY(16px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .profile-backdrop { animation: profileFadeIn 0.25s ease-out both; }
        .profile-modal { animation: profilePopIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .profile-backdrop, .profile-modal { animation: none; }
        }
      `}</style>
      <AppHeader title="Profile" subtitle="Manage your details" />

      <div className="qurbi-content">
        {/* Avatar */}
        <div
          className={`${cardGradientCls} p-5 flex items-center gap-4 ${reveal()}`}
          style={{ animationDelay: "80ms" }}
        >
          <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">
              {profile.name || "Guest Buyer"}
            </p>
            <p className="text-[#F7EDE2]/75 text-sm">
              {profile.email || "No email set"}
            </p>
          </div>
        </div>

        {/* Account Info — read-only card with edit button */}
        <div
          className={`${cardGradientCls} p-4 ${reveal()}`}
          style={{ animationDelay: "140ms" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">Account Info</h3>
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] px-3 py-2 text-xs font-semibold text-black transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-[#F7EDE2] flex-shrink-0" />
              <p className="text-[#F7EDE2]/75 text-xs w-16">Name</p>
              <p className="text-white text-sm font-medium break-words">
                {profile.name || "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#F7EDE2] flex-shrink-0" />
              <p className="text-[#F7EDE2]/75 text-xs w-16">Email</p>
              <p className="text-white text-sm font-medium break-words">
                {profile.email || "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#F7EDE2] flex-shrink-0" />
              <p className="text-[#F7EDE2]/75 text-xs w-16">Phone</p>
              <p className="text-white text-sm font-medium break-words">
                {profile.phone || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Edit popup */}
        {showEdit && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm profile-backdrop"
              onClick={() => setShowEdit(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
              <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl pointer-events-auto profile-modal">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="text-gray-900 font-bold text-lg">
                    Edit Personal Info
                  </h3>
                  <button
                    onClick={() => setShowEdit(false)}
                    className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Full Name"
                    className={inputCls}
                  />
                  <input
                    value={profile.email}
                    placeholder="Email Address"
                    type="email"
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded-xl border border-[#E3C19F] bg-[#E3C19F] px-4 py-3 text-sm text-black/70 cursor-not-allowed"
                  />
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="Phone Number"
                    type="tel"
                    className={inputCls}
                  />
                  {saveError && (
                    <p className="text-red-500 text-xs text-center">
                      {saveError}
                    </p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ${saved ? "bg-[#E3C19F] text-[#41362D]" : "bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white"}`}
                  >
                    {saving ? (
                      "Saving..."
                    ) : saved ? (
                      <>
                        <Check className="w-4 h-4" /> Saved!
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Address Book */}
        <button
          onClick={() => navigateFromIconPage("/address-book")}
          className={`w-full ${cardGradientCls} p-4 flex items-center gap-4 active:bg-white/10 transition ${reveal()}`}
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]">
            <MapPin className="h-5 w-5 text-black" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-semibold text-sm">Address Book</p>
            <p className="text-[#F7EDE2]/75 text-xs">
              Manage delivery addresses
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#F7EDE2]" />
        </button>

        {/* Order History */}
        <button
          onClick={() => navigateFromIconPage("/history")}
          className={`w-full ${cardGradientCls} p-4 flex items-center gap-4 active:bg-white/10 transition ${reveal()}`}
          style={{ animationDelay: "260ms" }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]">
            <Package className="h-5 w-5 text-[#41362D]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-semibold text-sm">Order History</p>
            <p className="text-[#F7EDE2]/75 text-xs">View all past orders</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#F7EDE2]" />
        </button>

        {/* Auth actions */}
        <div className={reveal()} style={{ animationDelay: "380ms" }}>
          <AuthButtons />
        </div>
      </div>
    </div>
  );
}
