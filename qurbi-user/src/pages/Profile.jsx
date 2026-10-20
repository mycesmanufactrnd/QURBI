import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  User,
  MapPin,
  Clock,
  Check,
  Pencil,
  X,
  Mail,
  Phone,
  ShieldCheck,
  FileText,
  Headset,
  Languages,
  Monitor,
  Smartphone,
  Sparkles,
  Tractor,
  ArrowLeftRight,
  ArrowLeft,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useReveal } from "@/hooks/useReveal";
import AuthButtons from "@/components/AuthButtons";
import PageLoading from "@/components/PageLoading";
import { useHeaderTransition } from "@/components/HeaderTransitionProvider";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/lib/AuthContext";
import AuthRequiredState from "@/components/AuthRequiredState";
import { SettingsGroup, SettingsRow } from "@/components/account/SettingsGroup";
import { primaryBtn } from "@/components/account/buttons";
import { registerAsFarmer, switchToFarmerPortal } from "@/lib/portalSwitch";
import { useMounted } from "@/hooks/useMounted";
import { useDisplayMode } from "@/lib/display-mode-context";
import ProfileAvatar from "@/components/ProfileAvatar";

export default function Profile() {
  const location = useLocation();
  const {
    navigateFromIconPage,
    navigateWithTransition,
    requestIconClose,
  } = useHeaderTransition();
  const requireAuth = useRequireAuth();
  const { authChecked, isAuthenticated, user } = useAuth();
  const { profile, profileLoading, updateProfile } = useUserProfile();
  const { reveal } = useReveal();
  const { t, i18n } = useTranslation("profile");
  const { t: ta } = useTranslation("account");
  const { t: tc } = useTranslation("common");
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ name: "", phone: "" });
  const [showEdit, setShowEdit] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switching, setSwitching] = useState(false);
  const mounted = useMounted();
  const { displayMode, setDisplayMode } = useDisplayMode();
  const isFarmerAccount = user?.availableRoles?.includes("farmer");
  const originalLocation =
    location.state?.profileReturnLocation || location.state?.backgroundLocation;
  const hasValidOriginalLocation = Boolean(
    originalLocation?.pathname &&
      originalLocation.pathname.startsWith("/") &&
      originalLocation.pathname !== "/profile",
  );
  const profileReturnTo = hasValidOriginalLocation
    ? `${originalLocation.pathname}${originalLocation.search || ""}${originalLocation.hash || ""}`
    : "/";
  const profileReturnState = hasValidOriginalLocation
    ? originalLocation.state
    : undefined;
  const handleProfileReturn = () => {
    if (requestIconClose("profile")) return;
    navigateWithTransition(profileReturnTo, {
      navigateOptions:
        profileReturnState !== undefined
          ? { state: profileReturnState }
          : undefined,
    });
  };

  const goToFarmerSide = async () => {
    if (switching) return;
    if (
      !isFarmerAccount &&
      !window.confirm(
        ta("profile.farmer.confirm", "Register this account as a farmer? You will continue in the QURBI Farmer app to submit your farm details for verification. You can still buy as before."),
      )
    ) {
      return;
    }
    setSwitching(true);
    setSwitchError("");
    try {
      await (isFarmerAccount ? switchToFarmerPortal() : registerAsFarmer());
    } catch (error) {
      setSwitching(false);
      setSwitchError(error.message || ta("profile.farmer.error", "Could not switch account. Please try again."));
    }
  };

  const inputCls =
    "w-full min-h-12 bg-transparent py-3.5 pl-11 pr-4 text-base font-medium text-white placeholder:text-white/60 outline-none";
  const inputWrapCls =
    "relative mt-1.5 overflow-hidden rounded-2xl border border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/15 transition focus-within:border-white/80 focus-within:ring-2 focus-within:ring-[#41362D]/20";
  const inputIconCls =
    "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E3C19F]";
  const labelCls = "block text-sm font-bold text-[#41362D]";
  const errorCls = "mt-1 text-sm font-semibold text-[#9A2E0C]";

  const handleSave = async () => {
    if (saving) return;
    const errors = {
      name: form.name?.trim() ? "" : ta("profile.nameRequired"),
      phone:
        form.phone && form.phone.replace(/\D/g, "").length < 7
          ? ta("profile.phoneInvalid")
          : "",
    };
    setFieldErrors(errors);
    if (errors.name || errors.phone) return;
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
      setSaveError(error.message || t("profile.editModal.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    setForm(profile);
    setFieldErrors({ name: "", phone: "" });
    setSaveError("");
    setShowEdit(true);
  };

  const returnButton = (
    <header className="mx-auto w-full max-w-2xl px-4 pt-5 sm:pt-6">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleProfileReturn}
          aria-label={tc("appHeader.goBack")}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] text-white shadow-sm transition-transform active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#41362D]/70">
              QURBI
            </p>

            <h1 className="text-2xl font-bold leading-tight text-[#41362D]">
              {t(
                "profile.pageTitle"
              )}
            </h1>
          </div>
      </div>  
    </header>
  );

  if (!authChecked || profileLoading) {
    return (
      <div className="qurbi-page">
        {returnButton}
        <PageLoading contentOnly message={t("profile.loading")} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthRequiredState
        title={t("profile.pageTitle")}
        message={t("profile.authRequiredMessage")}
        returnTo="/profile"
      />
    );
  }

  const infoRows = [
    { icon: Mail, label: t("profile.accountInfo.email"), value: profile.email },
    { icon: Phone, label: t("profile.accountInfo.phone"), value: profile.phone },
  ];
  const languages = [
    { code: "en", label: t("language.english") },
    { code: "ms", label: t("language.malay") },
  ];
  const displayModes = [
    { value: "auto", icon: Sparkles, label: t("displayMode.auto") },
    { value: "desktop", icon: Monitor, label: t("displayMode.desktop") },
    { value: "mobile", icon: Smartphone, label: t("displayMode.mobile") },
  ];

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
      {returnButton}

      <div className="qurbi-content mx-auto max-w-2xl space-y-6">
        {/* Account */}
        <section
          className={reveal()}
          style={{ animationDelay: "80ms" }}
          aria-labelledby="account-group-title"
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 id="account-group-title" className="text-sm font-bold text-[#41362D]/80">
              {ta("profile.groups.account")}
            </h2>
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-[#41362D] to-[#6B594A] px-3 text-sm font-bold text-[#F7EDE2] shadow-sm transition-transform active:scale-95"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {ta("profile.editDetails")}
            </button>
          </div>
          <div className="qurbi-card qurbi-header-background relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
            <div className="relative z-10 flex min-w-0 items-center gap-3.5">
              <ProfileAvatar
                src={profile.avatarUrl || user?.avatarUrl || user?.avatar_url}
                name={profile.name}
                className="h-14 w-14 rounded-2xl text-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E3C19F]">
                  {t("profile.buyerAccount")}
                </p>
                <p className="mt-1 break-words text-xl font-extrabold leading-tight text-white">
                  {profile.name || t("profile.guestBuyer")}
                </p>
                <p className="mt-1 break-all text-sm text-white/80">
                  {profile.email || t("profile.noEmailSet")}
                </p>
                <p className="mt-1 break-all text-sm text-white/80">
                  {profile.phone || t("profile.phone")}
                </p>
              </div>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-white/15 overflow-hidden rounded-[1.5rem] border border-[#E3C19F]/30 bg-gradient-to-br from-[#41362D] to-[#6B594A] shadow-md shadow-[#41362D]/20">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-h-[76px] items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]">
                  <Icon className="h-5 w-5 text-black" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-sm text-white/75">{label}</dt>
                  <dd className="break-words text-[15px] font-semibold text-white [overflow-wrap:anywhere]">
                    {value || ta("profile.notSet")}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* Edit popup */}
        {showEdit && mounted && createPortal((
          <>
            <div
              className="fixed inset-0 z-[290] bg-[#241D18]/55 backdrop-blur-[3px] profile-backdrop"
              onClick={() => !saving && setShowEdit(false)}
            />
            <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto overscroll-contain p-4 pointer-events-none sm:p-5">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-profile-title"
                className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[28px] border border-[#E3C19F]/70 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-[0_24px_70px_rgba(34,27,22,0.42)] pointer-events-auto profile-modal sm:max-h-[calc(100dvh-2.5rem)]"
              >
                <div className="flex items-center justify-between bg-gradient-to-br from-[#41362D] to-[#6B594A] px-5 py-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-[#F7EDE2]/50 bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] shadow-lg">
                      <Pencil className="h-5 w-5 text-[#41362D]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        id="edit-profile-title"
                        className="text-lg font-bold leading-tight text-white"
                      >
                        {t("profile.editModal.title")}
                      </h3>
                      <p className="mt-1 text-xs text-white/75">
                        {t("profile.editModal.subtitle")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEdit(false)}
                    aria-label={ta("profile.closeEdit")}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form
                  className="space-y-5 p-5"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                  <div>
                    <label htmlFor="profile-name" className={labelCls}>
                      {t("profile.accountInfo.name")} <span className="text-[#9A2E0C]">*</span>
                    </label>
                    <div className={inputWrapCls}>
                      <User className={inputIconCls} aria-hidden="true" />
                    <input
                      id="profile-name"
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder={t("profile.editModal.fullNamePlaceholder")}
                      autoComplete="name"
                      aria-invalid={Boolean(fieldErrors.name)}
                      className={inputCls}
                    />
                    </div>
                    {fieldErrors.name && <p className={errorCls}>{fieldErrors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="profile-phone" className={labelCls}>
                      {t("profile.accountInfo.phone")}
                    </label>
                    <div className={inputWrapCls}>
                      <Phone className={inputIconCls} aria-hidden="true" />
                    <input
                      id="profile-phone"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder={t("profile.editModal.phonePlaceholder")}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={Boolean(fieldErrors.phone)}
                      className={inputCls}
                    />
                    </div>
                    {fieldErrors.phone && <p className={errorCls}>{fieldErrors.phone}</p>}
                  </div>

                  <div>
                    <label htmlFor="profile-email" className={labelCls}>
                      {t("profile.accountInfo.email")}
                    </label>
                    <div className={inputWrapCls}>
                      <Mail className={inputIconCls} aria-hidden="true" />
                    <input
                      id="profile-email"
                      value={profile.email}
                      placeholder={t("profile.editModal.emailPlaceholder")}
                      type="email"
                      readOnly
                      aria-readonly="true"
                      aria-describedby="profile-email-help"
                      className={`${inputCls} cursor-not-allowed text-white/75`}
                    />
                    </div>
                    <p id="profile-email-help" className="mt-1 text-[13px] text-[#5A493C]">
                      {ta("profile.emailLocked")}
                    </p>
                  </div>
                  {saveError && (
                    <p role="alert" className="rounded-xl bg-[#FBE4E1] px-3 py-2 text-center text-sm font-semibold text-[#8A1C12]">
                      {saveError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className={`${primaryBtn} w-full`}
                  >
                    {saving ? (
                      t("profile.editModal.saving")
                    ) : saved ? (
                      <>
                        <Check className="w-4 h-4" /> {t("profile.editModal.saved")}
                      </>
                    ) : (
                      t("profile.editModal.saveChanges")
                    )}
                  </button>
                </form>
              </div>
            </div>
          </>
        ), document.body)}

        {/* Orders & delivery */}
        <SettingsGroup
          title={ta("profile.groups.ordersDelivery")}
          className={reveal()}
          style={{ animationDelay: "140ms" }}
        >
          <SettingsRow
            icon={MapPin}
            title={t("profile.addressBookCard.title")}
            subtitle={t("profile.addressBookCard.subtitle")}
            onClick={() =>
              requireAuth(() =>
                navigateFromIconPage("/address-book", {
                  state: { addressBookFromProfile: true },
                }),
              )
            }
          />
          <SettingsRow
            icon={Clock}
            title={t("profile.transactionHistoryCard.title")}
            subtitle={t("profile.transactionHistoryCard.subtitle")}
            onClick={() =>
              requireAuth(() => navigateWithTransition("/transaction-history"))
            }
          />
        </SettingsGroup>

        {/* Farmer account */}
        <SettingsGroup
          title={ta("profile.groups.farmer", "Selling")}
          className={reveal()}
          style={{ animationDelay: "170ms" }}
        >
          <SettingsRow
            icon={isFarmerAccount ? ArrowLeftRight : Tractor}
            title={
              isFarmerAccount
                ? ta("profile.farmer.switchTitle", "Switch to farmer account")
                : ta("profile.farmer.registerTitle", "Register as a farmer")
            }
            subtitle={
              switching
                ? ta("profile.farmer.opening", "Opening the farmer app...")
                : isFarmerAccount
                  ? ta("profile.farmer.switchSubtitle", "Manage your livestock and orders")
                  : ta("profile.farmer.registerSubtitle", "Sell your livestock on QURBI")
            }
            onClick={goToFarmerSide}
          />
          {switchError && (
            <p role="alert" className="px-4 py-2 text-sm font-semibold text-[#FBE4E1]">{switchError}</p>
          )}
        </SettingsGroup>

        {/* Language */}
        <section
          className={reveal()}
          style={{ animationDelay: "200ms" }}
          aria-labelledby="language-title"
        >
          <h2 id="language-title" className="mb-2 px-1 text-sm font-bold text-[#41362D]/80">
            {t("language.title")}
          </h2>
          <div className="qurbi-card rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2]">
                <Languages className="h-5 w-5 text-[#41362D]" aria-hidden="true" />
              </span>
              <p className="text-sm text-white/85">{t("language.subtitle")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="language-title">
              {languages.map(({ code, label }) => {
                const selected = i18n.resolvedLanguage === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => i18n.changeLanguage(code)}
                    className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-[15px] font-bold transition-colors ${selected ? "border-[#E3C19F] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D]" : "border-white/25 bg-white/10 text-white"}`}
                  >
                    {selected && <Check className="h-4 w-4 flex-none" aria-hidden="true" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Display mode */}
        <section
          className={reveal()}
          style={{ animationDelay: "230ms" }}
          aria-labelledby="display-mode-title"
        >
          <h2 id="display-mode-title" className="mb-2 px-1 text-sm font-bold text-[#41362D]/80">
            {t("displayMode.title")}
          </h2>
          <div className="qurbi-card rounded-2xl p-4">
            <p className="mb-3 text-sm leading-relaxed text-white/80">
              {t("displayMode.subtitle")}
            </p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="display-mode-title">
              {displayModes.map(({ value, icon: Icon, label }) => {
                const selected = displayMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDisplayMode(value)}
                    className={`flex min-h-[72px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-center text-xs font-bold transition-all duration-200 sm:text-sm ${
                      selected
                        ? "border-[#E3C19F] bg-gradient-to-br from-[#E3C19F] to-[#F7EDE2] text-[#41362D] shadow-md"
                        : "border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-none" aria-hidden="true" />
                    <span className="max-w-full truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Help & legal */}
        <SettingsGroup
          title={ta("profile.groups.helpLegal")}
          className={reveal()}
          style={{ animationDelay: "260ms" }}
        >
          <SettingsRow
            icon={Headset}
            title={t("profile.customerSupportCard.title")}
            subtitle={t("profile.customerSupportCard.subtitle")}
            onClick={() => navigateFromIconPage("/support")}
          />
          <SettingsRow
            icon={ShieldCheck}
            title={t("profile.privacyPolicyCard.title")}
            subtitle={t("profile.privacyPolicyCard.subtitle")}
            onClick={() => navigateFromIconPage("/privacy-policy")}
          />
          <SettingsRow
            icon={FileText}
            title={t("profile.termsConditionsCard.title")}
            subtitle={t("profile.termsConditionsCard.subtitle")}
            onClick={() => navigateFromIconPage("/terms-conditions")}
          />
        </SettingsGroup>

        {/* Sign out */}
        <div className={reveal()} style={{ animationDelay: "320ms" }}>
          <AuthButtons />
        </div>
      </div>
    </div>
  );
}
