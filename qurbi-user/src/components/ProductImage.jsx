import React, { useEffect, useState } from "react";

export default function ProductImage({
  src,
  alt = "Product",
  fallbackLabel = "No image",
  className = "h-12 w-12",
  imageClassName = "h-full w-full object-cover",
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const hasImage = Boolean(src) && !imageFailed;

  return (
    <div
      className={`flex flex-none items-center justify-center overflow-hidden rounded-xl ${className} ${
        hasImage
          ? ""
          : "border-2 border-[#E3C19F] bg-gradient-to-br from-[#41362D] to-[#6B594A]"
      }`}
    >
      {hasImage ? (
        <img
          src={src}
          alt={alt}
          className={imageClassName}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="px-1 text-center text-[9px] font-bold leading-tight text-white">
          {fallbackLabel}
        </span>
      )}
    </div>
  );
}
