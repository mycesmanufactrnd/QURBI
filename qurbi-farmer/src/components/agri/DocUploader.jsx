import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Upload, X, Loader2, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 1280;

async function compressFile(file) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await window.createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return await new Promise((resolve) =>
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        const name = (file.name || "upload").replace(/\.(jpe?g|png|webp|heic|gif|bmp)$/i, "") + ".jpg";
        resolve(new File([blob], name, { type: "image/jpeg" }));
      }, "image/jpeg", 0.82)
    );
  } catch {
    return file;
  }
}

export default function DocUploader({
  label,
  value,
  onChange,
  hint,
  required = false,
  capture,
  aspectClassName = "aspect-[16/10]",
  fittingType = "fit",
  uploadLabel = "Tap to upload",
  replaceLabel = "Replace",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const compressed = await compressFile(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
      if (!file_url) throw new Error("Upload returned no URL");
      onChange(file_url);
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-1.5">{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</p>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-muted", aspectClassName)}>
          <Image src={value} fittingType={fittingType} className="w-full h-full" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 left-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <FileCheck2 className="w-3.5 h-3.5" /> {replaceLabel}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors",
            aspectClassName,
            uploading && "opacity-70"
          )}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Upload className="w-6 h-6" />
          )}
          <span className="text-xs font-medium">{uploading ? "Uploading..." : uploadLabel}</span>
        </button>
      )}
    </div>
  );
}
