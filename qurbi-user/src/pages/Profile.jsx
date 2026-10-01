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
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";

export default function Profile() {
  const { navigateFromIconPage } = useHeaderTransition();
  const requireAuth = useRequireAuth();
  const { authChecked, isAuthenticated } = useAuth();
  const { profile, profileLoading, updateProfile } = useUserProfile();
  const { reveal } = useReveal();
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showEdit, setShowEdit] = useState(false);

  const inputCls =
    "w-full bg-transparent py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder:text-white/45 outline-none";
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
    requireAuth(() => {
      setForm(profile);
      setShowEdit(true);
    });
  };

  if (!authChecked || profileLoading) {
    return (
      <div className="aisyah-page">
        <AppHeader title="Profile" subtitle="Manage your details" />
        <PageLoading contentOnly message="Loading your profile..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthRequiredState title="Profile" message="Sign in to view and manage your profile." returnTo="/profile" />;
  }

  return (
    <div className="aisyah-page">
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

      <div className="aisyah-content">
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
              className="fixed inset-0 z-40 bg-[#241D18]/55 backdrop-blur-[3px] profile-backdrop"
              onClick={() => setShowEdit(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none">
              <div
                className="w-full max-w-sm overflow-hidden rounded-[28px] border border-[#E3C19F]/70 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-[0_24px_70px_rgba(34,27,22,0.42)] pointer-events-auto profile-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-personal-info-title"
              >
                <div className="flex items-center justify-between bg-gradient-to-br from-[#41362D] to-[#6B594A] px-5 py-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-[#F7EDE2]/50 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-lg">
                      <Pencil className="h-5 w-5 text-[#41362D]" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        id="edit-personal-info-title"
                        className="text-lg font-bold leading-tight text-white"
                      >
                        Edit Personal Info
                      </h3>
                      <p className="mt-1 text-xs text-white/65">
                        Keep your contact details up to date
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEdit(false)}
                    aria-label="Close edit personal info"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form
                  className="space-y-5 p-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                  <div className="space-y-2">
                    <label htmlFor="profile-full-name" className="block text-sm font-bold text-[#41362D]">
                      Full Name
                    </label>
                    <div className="relative overflow-hidden rounded-2xl border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/15 transition focus-within:border-white/80 focus-within:ring-2 focus-within:ring-[#41362D]/20">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E3C19F]" />
                      <input
                        id="profile-full-name"
                        value={form.name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Enter your full name"
                        autoComplete="name"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="profile-phone" className="block text-sm font-bold text-[#41362D]">
                      Phone Number
                    </label>
                    <div className="relative overflow-hidden rounded-2xl border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/15 transition focus-within:border-white/80 focus-within:ring-2 focus-within:ring-[#41362D]/20">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E3C19F]" />
                      <input
                        id="profile-phone"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, phone: e.target.value }))
                        }
                        placeholder="e.g. 012-345 6789"
                        type="tel"
                        autoComplete="tel"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {saveError && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-xs font-medium text-red-700">
                      {saveError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#41362D]/25 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
                </form>
              </div>
            </div>
          </>
        )}

        {/* Address Book */}
        <button
          onClick={() => requireAuth(() => navigateFromIconPage("/address-book"))}
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
          onClick={() => requireAuth(() => navigateFromIconPage("/history"))}
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
