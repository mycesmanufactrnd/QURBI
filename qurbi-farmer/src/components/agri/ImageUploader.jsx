import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ImagePlus, X, Star, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Image } from "@/components/ui/image";

const MAX_IMAGES = 10;
const MAX_DIMENSION = 1280;

// Downscale an image file client-side before upload (lightweight compression).
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
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
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

export default function ImageUploader({ value = [], cover, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const images = value || [];
  const coverUrl = cover || images[0] || null;

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).slice(0, MAX_IMAGES - images.length);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const compressed = await compressFile(file);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: compressed });
          return file_url;
        })
      );
      const next = [...images, ...uploads];
      onChange(next, coverUrl || next[0] || null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (idx) => {
    const next = images.filter((_, i) => i !== idx);
    const removedWasCover = images[idx] === coverUrl;
    onChange(next, removedWasCover ? next[0] || null : coverUrl);
  };

  const setCover = (url) => onChange(images, url);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {images.map((url) => (
          <div key={url} className="relative group rounded-2xl overflow-hidden border border-border aspect-square bg-muted">
            <Image src={url} fittingType="fill" className="w-full h-full" />
            <button
              type="button"
              onClick={() => removeAt(images.indexOf(url))}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCover(url)}
              className={cn(
                "absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-colors",
                url === coverUrl ? "bg-primary text-primary-foreground" : "bg-black/55 text-white"
              )}
            >
              <Star className={cn("w-3 h-3", url === coverUrl && "fill-current")} />
              {url === coverUrl ? "Cover" : "Set"}
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-6 h-6" />
                <span className="text-[10px] font-medium mt-1">{images.length}/{MAX_IMAGES}</span>
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5" />
        Tap a photo to set it as the cover. Up to {MAX_IMAGES} images.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}