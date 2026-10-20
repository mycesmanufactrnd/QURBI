import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CheckCircle2, FileImage, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, ErrorNotice, PageHeader } from "@/components/ui-kit";
import { courierApi, uploadApi } from "@/api/apiClient";
import { prepareImageForUpload } from "@/lib/image";
import { errorText } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";

const DOCS = [
  { key: "icFront", capture: "environment" },
  { key: "icBack", capture: "environment" },
  { key: "selfie", capture: "user" },
  { key: "licence", capture: "environment" },
];

export default function Verify() {
  const { t } = useTranslation(["verification", "common"]);
  const { logout } = useAuth();
  // key -> { url, previewUrl } once uploaded
  const [uploaded, setUploaded] = useState({});
  const [busyKey, setBusyKey] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const previewUrls = useRef([]);

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const handleFile = async (key, file) => {
    if (!file) return;
    setBusyKey(key);
    setErrors((current) => ({ ...current, [key]: "" }));
    try {
      const prepared = await prepareImageForUpload(file);
      const url = await uploadApi.upload(prepared, `${key}.jpg`);
      const previewUrl = URL.createObjectURL(prepared);
      previewUrls.current.push(previewUrl);
      setUploaded((current) => ({ ...current, [key]: { url, previewUrl } }));
    } catch (error) {
      setErrors((current) => ({ ...current, [key]: errorText(error, t) || t("verify.uploadFailed", { ns: "verification" }) }));
    } finally {
      setBusyKey("");
    }
  };

  const complete = DOCS.every(({ key }) => uploaded[key]);

  const submit = async () => {
    if (!complete || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await courierApi.submitVerification({
        documents: Object.fromEntries(DOCS.map(({ key }) => [key, uploaded[key].url])),
      });
      // Full load so the app re-reads the new "pending" state.
      window.location.assign("/pending");
    } catch (error) {
      setSubmitError(errorText(error, t) || t("verify.failed", { ns: "verification" }));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-12 pt-8">
      <PageHeader title={t("verify.title", { ns: "verification" })} description={t("verify.subtitle", { ns: "verification" })} />
      <p className="mt-3 rounded-2xl bg-secondary/60 p-3 text-sm text-primary">{t("verify.photoTip", { ns: "verification" })}</p>

      <div className="mt-5 space-y-4">
        {DOCS.map(({ key, capture }) => (
          <DocSlot
            key={key}
            docKey={key}
            capture={capture}
            value={uploaded[key]}
            busy={busyKey === key}
            error={errors[key]}
            onFile={(file) => handleFile(key, file)}
          />
        ))}
      </div>

      {submitError && <div className="mt-4"><ErrorNotice message={submitError} /></div>}
      {!complete && <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">{t("verify.missing", { ns: "verification" })}</p>}
      <Button className="mt-3 h-12 w-full" onClick={submit} disabled={!complete || submitting || Boolean(busyKey)}>
        {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />{t("verify.submitting", { ns: "verification" })}</> : t("verify.submit", { ns: "verification" })}
      </Button>
      <button type="button" onClick={() => logout()} className="mt-4 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-muted-foreground underline underline-offset-4">{t("logOut", { ns: "common" })}</button>
    </div>
  );
}

function DocSlot({ docKey, capture, value, busy, error, onFile }) {
  const { t } = useTranslation("verification");
  const cameraInput = useRef(null);
  const fileInput = useRef(null);
  const change = (event) => {
    onFile(event.target.files?.[0]);
    event.target.value = ""; // allow choosing the same file again
  };

  return (
    <Card title={t(`verify.docs.${docKey}.label`)} description={t(`verify.docs.${docKey}.hint`)}>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
          {value ? <img src={value.previewUrl} alt={t(`verify.docs.${docKey}.label`)} className="h-full w-full object-cover" /> : <FileImage className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {busy ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />{t("verify.uploading")}</p>
          ) : (
            <>
              {value && <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t("verify.uploaded")}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={value ? "outline" : "default"} className="h-11" onClick={() => cameraInput.current?.click()}>
                  {value ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {value ? t("verify.replace") : t("verify.takePhoto")}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => fileInput.current?.click()}>{t("verify.choosePhoto")}</Button>
              </div>
            </>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        </div>
      </div>
      <input ref={cameraInput} type="file" accept="image/*" capture={capture} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={change} />
      <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={change} />
    </Card>
  );
}
