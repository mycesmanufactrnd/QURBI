import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, ScanLine, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MALAYSIA_STATES } from "@/lib/agri";
import { combineLivestockDocuments, parseLivestockDocument } from "@/lib/livestockOcr";
import { addUniqueOcrFiles, buildKnownBreeds, recognizeLivestockFiles } from "@/lib/livestockOcrWorker";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;

export default function BulkOcrImporter({ managedBreeds = [], onApply }) {
  const { t } = useTranslation("bulk");
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const knownBreeds = useMemo(() => buildKnownBreeds(managedBreeds), [managedBreeds]);

  const addFiles = (fileList) => {
    setError("");
    setNotice("");
    setResult(null);
    const added = addUniqueOcrFiles(files, fileList, MAX_FILES);
    if (added.invalidCount) setError(t("ocr.invalidFile"));
    if (added.duplicateCount) setNotice(t("ocr.duplicateFilesSkipped", { count: added.duplicateCount }));
    setFiles(added.files);
    if (inputRef.current) inputRef.current.value = "";
  };

  const runOcr = async () => {
    if (!files.length || processing) return;
    setProcessing(true);
    setError("");
    setNotice("");
    setResult(null);
    setProgress(0);
    try {
      const pages = await recognizeLivestockFiles(files, setProgress);
      const pageResults = pages.map((page) => parseLivestockDocument(page.text, knownBreeds, page.confidence, MALAYSIA_STATES));
      const combined = combineLivestockDocuments(pageResults);
      setResult(combined);
      if (!combined.groups.length) setError(t("ocr.noBulkData"));
    } catch (ocrError) {
      setError(ocrError?.message || t("ocr.failed"));
    } finally {
      setProcessing(false);
    }
  };

  const apply = () => {
    if (!result?.groups.length) return;
    onApply(result);
    setOpen(false);
    setFiles([]);
    setResult(null);
    setProgress(0);
    setNotice("");
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="soft-card mt-5 flex min-h-[82px] w-full items-center gap-3 p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/25">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><ScanLine className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><strong className="block text-base">{t("ocr.entryTitle")}</strong><span className="mt-0.5 block text-sm text-muted-foreground">{t("ocr.entryDescription")}</span></span>
      </button>

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!processing) setOpen(nextOpen); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("ocr.title")}</DialogTitle><DialogDescription>{t("ocr.description")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-900"><p className="font-bold">{t("ocr.privateTitle")}</p><p className="mt-1">{t("ocr.privateDescription")}</p></div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => addFiles(event.target.files)} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={processing || files.length >= MAX_FILES} className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border px-4 text-center transition-colors hover:border-primary/50">
              <Upload className="h-6 w-6 text-primary" /><span className="mt-2 text-sm font-bold">{t("ocr.chooseImages")}</span><span className="mt-1 text-xs text-muted-foreground">{t("ocr.fileHelp", { count: MAX_FILES })}</span>
            </button>
            {files.length > 0 && <ul className="space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-muted/55 px-3"><FileText className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{file.name}</span><button type="button" disabled={processing} onClick={() => { setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)); setResult(null); setError(""); }} aria-label={t("ocr.removeFile", { name: file.name })} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-background"><X className="h-4 w-4" /></button></li>)}</ul>}
            {processing && <Progress progress={progress} label={t("ocr.processing")} />}
            {notice && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{notice}</p>}
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            {result && <OcrReview result={result} t={t} />}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={processing} className="h-11">{t("ocr.cancel")}</Button>
            {!result ? <Button type="button" onClick={runOcr} disabled={!files.length || processing} className="h-11">{processing ? t("ocr.processing") : t("ocr.scan")}</Button> : <Button type="button" onClick={apply} disabled={!result.groups.length} className="h-11"><CheckCircle2 className="mr-2 h-4 w-4" />{t("ocr.apply")}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Progress({ progress, label }) {
  return <div className="rounded-2xl bg-muted/50 p-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-bold"><Loader2 className="h-4 w-4 animate-spin" />{label}</span><span>{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div></div>;
}

function OcrReview({ result, t }) {
  const fields = [
    [t("ocr.fields.documentType"), t(`ocr.documentTypes.${result.documentType}`)],
    [t("ocr.fields.certificateNumber"), result.certificateNumber],
    [t("ocr.fields.animalId"), result.animalId],
    [t("ocr.fields.species"), result.species],
    [t("ocr.fields.breed"), result.breed],
    [t("ocr.fields.male"), result.maleCount || ""],
    [t("ocr.fields.female"), result.femaleCount || ""],
    [t("ocr.fields.birthDate"), result.birthDate],
    [t("ocr.fields.state"), result.state],
    [t("ocr.fields.veterinaryOfficer"), result.veterinaryOfficer],
  ];
  return <div className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{t("ocr.reviewTitle")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("ocr.reviewDescription")}</p></div><span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", result.confidence >= 75 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>{t("ocr.confidence", { count: result.confidence })}</span></div><p className="mt-3 text-sm font-semibold text-muted-foreground">{t("ocr.documentsRead", { count: result.documentCount })}</p>{result.duplicateCount > 0 && <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900">{t("ocr.duplicateDocumentsIgnored", { count: result.duplicateCount })}</p>}<dl className="mt-2 divide-y divide-border/60">{fields.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 py-2.5 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className={cn("break-words text-right font-bold", !value && "text-amber-700")}>{value || t("ocr.notDetected")}</dd></div>)}</dl>{result.groups.length > 0 && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("ocr.detectedGroups")}</p><div className="mt-2 space-y-2">{result.groups.map((group) => <div key={`${group.species}:${group.breed}`} className="flex items-center justify-between gap-3 rounded-xl bg-muted/55 p-3 text-sm"><span className="font-bold">{group.species} · {group.breed}</span><span className="text-muted-foreground">{t("ocr.groupCount", { male: group.maleCount, female: group.femaleCount })}</span></div>)}</div></div>}<p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t("ocr.notVerification")}</p></div>;
}
