import React, { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { uploadApi } from "@/api/apiClient";
import { cn } from "@/lib/utils";

/**
 * Private uploads can only be fetched with the courier's token, so they are
 * downloaded into a blob url instead of being used as a plain <img src>.
 * @param {{ src: string, alt: string, className?: string }} props
 */
export default function PrivateImage({ src, alt, className }) {
  const [state, setState] = useState({ url: "", loading: true, failed: false });

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    setState({ url: "", loading: true, failed: false });
    uploadApi.getPrivateFile(src)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, loading: false, failed: false });
      })
      .catch(() => { if (!cancelled) setState({ url: "", loading: false, failed: true }); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);

  if (state.loading) return <div className={cn("flex items-center justify-center bg-muted", className)} aria-busy="true"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (state.failed) return <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)} role="img" aria-label={alt}><ImageOff className="h-5 w-5" /></div>;
  return <img src={state.url} alt={alt} className={cn("object-cover", className)} />;
}
